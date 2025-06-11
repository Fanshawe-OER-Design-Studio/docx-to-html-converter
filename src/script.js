import {
  WASI,
  OpenFile,
  File,
  ConsoleStdout,
  PreopenDirectory,
} from "@bjorn3/browser_wasi_shim";

const form = document.getElementById("upload-form");
const output = document.getElementById("output");
const fileInput = document.getElementById("upload");
const btnGroup = document.getElementById("btn-group");
const convertAnotherBtn = document.getElementById("convert-another");

convertAnotherBtn.addEventListener("click", () => {
  form.classList.remove("hidden");
  form.classList.add("flex");
  output.classList.add("hidden");
  output.textContent = "";
  btnGroup.classList.add("hidden");
  btnGroup.classList.remove("flex");

  // Replace the file input
  const newFileInput = fileInput.cloneNode(true);
  fileInput.parentNode.replaceChild(newFileInput, fileInput);
  fileInput = newFileInput; // Update reference
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  output.textContent = ""; // Clear previous output

  const file = fileInput.files[0];
  if (!file) return;

  output.classList.add("hidden");

  const inputBytes = new Uint8Array(await file.arrayBuffer());

  // 1. Prepare virtual WASI files
  // inputFile contains the raw .docx bytes
  const inputFile = new File(inputBytes, "input.docx", {
    readonly: true,
  });
  // outputFile will hold the output html bytes
  const outputFile = new File(new Uint8Array(), "output.html", {
    readonly: false,
  });

  // Setup file descriptors (stdin, stdout, stderr, and virtual directories)
  const fds = [
    new OpenFile(new File(new Uint8Array(), { readonly: true })), // stdin
    ConsoleStdout.lineBuffered(
      (msg) => (output.textContent += `[stdout] ${msg}\n`)
    ),
    ConsoleStdout.lineBuffered(
      (msg) => (output.textContent += `[stderr] ${msg}\n`)
    ),
    new PreopenDirectory("/", [
      ["in", inputFile],
      ["out", outputFile],
    ]),
  ];

  const wasiArgs = ["pandoc.wasm", "+RTS", "-H64m", "-RTS"];

  // 3. Load WASI and instantiate WASM
  const wasi = new WASI(wasiArgs, [], fds, { debug: false });
  const { instance } = await WebAssembly.instantiateStreaming(
    fetch("https://tweag.github.io/pandoc-wasm/pandoc.wasm"),
    { wasi_snapshot_preview1: wasi.wasiImport }
  );

  wasi.initialize(instance);
  instance.exports.__wasm_call_ctors();

  const encoder = new TextEncoder();

  const pandocArgsString = "-f docx -t html";

  function memory_data_view() {
    return new DataView(instance.exports.memory.buffer);
  }

  const argc_ptr = instance.exports.malloc(4);
  memory_data_view().setUint32(argc_ptr, wasiArgs.length, true);
  const argv = instance.exports.malloc(4 * (wasiArgs.length + 1));
  for (let i = 0; i < wasiArgs.length; ++i) {
    const arg = instance.exports.malloc(wasiArgs[i].length + 1);
    new TextEncoder().encodeInto(
      wasiArgs[i],
      new Uint8Array(instance.exports.memory.buffer, arg, wasiArgs[i].length)
    );
    memory_data_view().setUint8(arg + wasiArgs[i].length, 0);
    memory_data_view().setUint32(argv + 4 * i, arg, true);
  }
  memory_data_view().setUint32(argv + 4 * wasiArgs.length, 0, true);
  const argv_ptr = instance.exports.malloc(4);
  memory_data_view().setUint32(argv_ptr, argv, true);

  instance.exports.hs_init_with_rtsopts(argc_ptr, argv_ptr);
  const encoded = new TextEncoder().encode(pandocArgsString);
  const argsPtr = instance.exports.malloc(encoded.length + 1);
  const argsBuf = new Uint8Array(
    instance.exports.memory.buffer,
    argsPtr,
    encoded.length + 1
  );
  argsBuf.set(encoded);
  argsBuf[encoded.length] = 0;

  // Call main
  instance.exports.wasm_main(argsPtr, encoded.length);

  // 7. Read the output from the virtual output file
  const htmlData = outputFile.data;

  output.classList.remove("hidden");
  btnGroup.classList.remove("hidden");
  btnGroup.classList.add("flex");

  form.classList.add("hidden");
  form.classList.remove("flex");

  if (htmlData && htmlData.length > 0) {
    const htmlString = new TextDecoder("utf-8").decode(htmlData);
    output.textContent += "\n--- OUTPUT FILE ---\n" + htmlString;
  } else {
    output.textContent += "\n--- NO OUTPUT FILE DATA ---\n";
  }
});

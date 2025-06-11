//  @ts-nocheck
import {
  WASI,
  OpenFile,
  File,
  ConsoleStdout,
  PreopenDirectory,
} from "@bjorn3/browser_wasi_shim";

const instructionsBtn = document.getElementById(
  "instructions"
) as HTMLButtonElement;

const form = document.getElementById("upload-form") as HTMLFormElement;
const output = document.getElementById("output") as HTMLElement;
let fileInput = document.getElementById("upload") as HTMLInputElement;
const btnGroup = document.getElementById("btn-group") as HTMLElement;
const convertAnotherBtn = document.getElementById(
  "convert-another"
) as HTMLButtonElement;

const formConvert = document.getElementById(
  "form-convert"
) as HTMLButtonElement;

fileInput.addEventListener("change", () => {
  if (fileInput.files && fileInput.files.length > 0) {
    formConvert.disabled = false;
    formConvert.classList.remove("disabled");
  } else {
    formConvert.disabled = true;
    formConvert.classList.add("disabled");
  }
});

const successModal = document.getElementById(
  "success-modal"
) as HTMLDialogElement;

const minifyBtn = document.getElementById("minify") as HTMLButtonElement;
const copyBtn = document.getElementById("copy") as HTMLButtonElement;

copyBtn.addEventListener("click", () => {
  if (output.textContent) {
    navigator.clipboard.writeText(output.textContent).then(() => {
      successModal.showModal();
    });
  } else {
    alert("No output to copy.");
  }
});

minifyBtn.addEventListener("click", () => {
  if (output.textContent) {
    const minifiedHtml = output.textContent.replace(/\s+/g, " ").trim();
    output.textContent = minifiedHtml;
  } else {
    output.textContent = "No output to minify.";
  }
});

convertAnotherBtn.addEventListener("click", () => {
  form.classList.remove("hidden");

  fileInput.value = ""; // Clear the file input value
  output.classList.add("hidden");
  output.textContent = "";
  btnGroup.classList.add("hidden");
  btnGroup.classList.remove("flex");
  instructionsBtn.classList.remove("hidden");
});

const downloadBtn = document.getElementById("download") as HTMLButtonElement;
downloadBtn.addEventListener("click", () => {
  if (output.textContent) {
    const blob = new Blob([output.textContent], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "output.html";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } else {
    alert("No output to download.");
  }
});

async function convert(inputBytes: Uint8Array<ArrayBuffer>) {
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

  return new TextDecoder().decode(htmlData);
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  output.textContent = "";

  const file = fileInput.files?.[0];
  if (!file) return;

  const inputBytes = new Uint8Array(await file.arrayBuffer());

  try {
    const html = await convert(inputBytes);

    output.classList.remove("hidden");
    btnGroup.classList.remove("hidden");
    btnGroup.classList.add("flex");

    form.classList.add("hidden");
    form.classList.remove("flex");
    instructionsBtn.classList.add("hidden");

    output.textContent += "\n--- OUTPUT FILE ---\n" + html;
  } catch (err) {
    output.textContent = `Error: ${(err as Error).message}`;
    output.classList.remove("hidden");
  }
});

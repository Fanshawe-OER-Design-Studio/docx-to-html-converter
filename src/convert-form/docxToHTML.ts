import { File, OpenFile, ConsoleStdout, PreopenDirectory, WASI } from '@bjorn3/browser_wasi_shim';

export async function convert(inputBytes: Uint8Array<ArrayBuffer>, outputElement: HTMLElement) {
  // 1. Prepare virtual WASI files
  // inputFile contains the raw .docx bytes

  // @ts-expect-error
  const inputFile = new File(inputBytes, 'input.docx', {
    readonly: true,
  });
  // outputFile will hold the output html bytes

  // @ts-expect-error
  const outputFile = new File(new Uint8Array(), 'output.html', {
    readonly: false,
  });

  // Setup file descriptors (stdin, stdout, stderr, and virtual directories)
  const fds = [
    new OpenFile(new File(new Uint8Array(), { readonly: true })), // stdin
    ConsoleStdout.lineBuffered((msg) => (outputElement.textContent += `[stdout] ${msg}\n`)),
    ConsoleStdout.lineBuffered((msg) => (outputElement.textContent += `[stderr] ${msg}\n`)),

    // @ts-expect-error
    new PreopenDirectory('/', [
      ['in', inputFile],
      ['out', outputFile],
    ]),
  ];

  const wasiArgs = ['pandoc.wasm', '+RTS', '-H64m', '-RTS'];

  // 3. Load WASI and instantiate WASM
  const wasi = new WASI(wasiArgs, [], fds, { debug: false });
  const { instance } = await WebAssembly.instantiateStreaming(
    fetch('https://tweag.github.io/pandoc-wasm/pandoc.wasm'),
    { wasi_snapshot_preview1: wasi.wasiImport }
  );

  // @ts-expect-error
  wasi.initialize(instance);
  // @ts-expect-error
  instance.exports.__wasm_call_ctors();

  const encoder = new TextEncoder();

  const pandocArgsString = '-f docx -t html';

  function memory_data_view() {
    // @ts-expect-error
    return new DataView(instance.exports.memory.buffer);
  }

  // @ts-expect-error
  const argc_ptr = instance.exports.malloc(4);
  memory_data_view().setUint32(argc_ptr, wasiArgs.length, true);

  // @ts-expect-error
  const argv = instance.exports.malloc(4 * (wasiArgs.length + 1));

  for (let i = 0; i < wasiArgs.length; ++i) {
    // @ts-expect-error
    const arg = instance.exports.malloc(wasiArgs[i].length + 1);
    new TextEncoder().encodeInto(
      wasiArgs[i],
      // @ts-expect-error
      new Uint8Array(instance.exports.memory.buffer, arg, wasiArgs[i].length)
    );
    memory_data_view().setUint8(arg + wasiArgs[i].length, 0);
    memory_data_view().setUint32(argv + 4 * i, arg, true);
  }
  memory_data_view().setUint32(argv + 4 * wasiArgs.length, 0, true);

  // @ts-expect-error
  const argv_ptr = instance.exports.malloc(4);
  memory_data_view().setUint32(argv_ptr, argv, true);

  // @ts-expect-error
  instance.exports.hs_init_with_rtsopts(argc_ptr, argv_ptr);
  const encoded = new TextEncoder().encode(pandocArgsString);

  // @ts-expect-error
  const argsPtr = instance.exports.malloc(encoded.length + 1);
  const argsBuf = new Uint8Array(
    // @ts-expect-error
    instance.exports.memory.buffer,
    argsPtr,
    encoded.length + 1
  );
  argsBuf.set(encoded);
  argsBuf[encoded.length] = 0;

  // Call main
  // @ts-expect-error
  instance.exports.wasm_main(argsPtr, encoded.length);

  // 7. Read the output from the virtual output file
  const htmlData = outputFile.data;

  return new TextDecoder().decode(htmlData);
}

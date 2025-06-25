// @ts-nocheck

/*
MIT License

Copyright (c) 2025 Aaron Po and Jason Benoit

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

import { File, OpenFile, ConsoleStdout, PreopenDirectory, WASI } from '@bjorn3/browser_wasi_shim';

export async function convert(inputBytes: Uint8Array<ArrayBuffer>, outputElement: HTMLElement) {
  // 1. Prepare virtual WASI files
  // inputFile contains the raw .docx bytes

  const inputFile = new File(inputBytes, 'input.docx', {
    readonly: true,
  });
  // outputFile will hold the output html bytes

  const outputFile = new File(new Uint8Array(), 'output.html', {
    readonly: false,
  });

  // Setup file descriptors (stdin, stdout, stderr, and virtual directories)
  const fds = [
    new OpenFile(new File(new Uint8Array(), { readonly: true })), // stdin
    ConsoleStdout.lineBuffered((msg) => (outputElement.textContent += `[stdout] ${msg}\n`)),
    ConsoleStdout.lineBuffered((msg) => (outputElement.textContent += `[stderr] ${msg}\n`)),

    new PreopenDirectory('/', [
      ['in', inputFile],
      ['out', outputFile],
    ]),
  ];

  const wasiArgs = ['pandoc.wasm', '+RTS', '-H64m', '-RTS'];

  // 3. Load WASI and instantiate WASM
  const wasi = new WASI(wasiArgs, [], fds, { debug: false });
  const { instance } = await WebAssembly.instantiateStreaming(fetch(import.meta.env.BASE_URL + 'pandoc.wasm'), {
    wasi_snapshot_preview1: wasi.wasiImport,
  });

  wasi.initialize(instance);

  instance.exports.__wasm_call_ctors();

  const encoder = new TextEncoder();

  const pandocArgsString = '-f docx -t html';

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
  const argsBuf = new Uint8Array(instance.exports.memory.buffer, argsPtr, encoded.length + 1);
  argsBuf.set(encoded);
  argsBuf[encoded.length] = 0;

  // Call main

  instance.exports.wasm_main(argsPtr, encoded.length);

  // 7. Read the output from the virtual output file
  const htmlData = outputFile.data;

  return new TextDecoder().decode(htmlData);
}

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

import { convert } from './convert-form/docxToHTML';
import beautify from 'js-beautify';

const instructionsBtn = document.getElementById('instructions') as HTMLButtonElement;
const output = document.getElementById('output') as HTMLElement;
const outputToolGroup = document.getElementById('btn-group') as HTMLElement;
const formSubmitBtn = document.getElementById('form-convert') as HTMLButtonElement;
const fileInput = document.getElementById('upload') as HTMLInputElement;

fileInput.addEventListener('change', () => {
  if (fileInput.files && fileInput.files.length > 0) {
    formSubmitBtn.disabled = false;
    formSubmitBtn.classList.remove('disabled');
  } else {
    formSubmitBtn.disabled = true;
    formSubmitBtn.classList.add('disabled');
  }
});

const successModal = document.getElementById('success-modal') as HTMLDialogElement;
const copyBtn = document.getElementById('copy') as HTMLButtonElement;
copyBtn.addEventListener('click', () => {
  if (!output.textContent) {
    return;
  }
  navigator.clipboard.writeText(output.textContent).then(() => {
    successModal.showModal();
  });
  output.focus();
});

const minifyBtn = document.getElementById('minify') as HTMLButtonElement;
minifyBtn.addEventListener('click', () => {
  if (output.textContent) {
    const minifiedHtml = output.textContent.replace(/\s+/g, ' ').trim();
    output.textContent = minifiedHtml;
  } else {
    output.textContent = 'No output to minify.';
  }
});

const convertAnotherBtn = document.getElementById('convert-another') as HTMLButtonElement;
convertAnotherBtn.addEventListener('click', () => {
  form.classList.remove('hidden');
  fileInput.value = ''; // Clear the file input value
  output.classList.add('hidden');
  output.textContent = '';
  outputToolGroup.classList.add('hidden');
  outputToolGroup.classList.remove('flex');
  instructionsBtn.classList.remove('hidden');
});

const downloadBtn = document.getElementById('download') as HTMLButtonElement;
downloadBtn.addEventListener('click', () => {
  if (output.textContent) {
    const blob = new Blob([output.textContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'output.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } else {
    alert('No output to download.');
  }
});

const form = document.getElementById('upload-form') as HTMLFormElement;
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  output.textContent = '';

  fileInput.disabled = true;
  formSubmitBtn.disabled = true;
  instructionsBtn.disabled = true;

  const file = fileInput.files?.[0];
  if (!file) return;

  const inputBytes = new Uint8Array(await file.arrayBuffer());

  try {
    const html = await convert(inputBytes, output);

    output.classList.remove('hidden');
    outputToolGroup.classList.remove('hidden');
    outputToolGroup.classList.add('flex');

    form.classList.add('hidden');
    form.classList.remove('flex');
    instructionsBtn.classList.add('hidden');

    instructionsBtn.disabled = false;
    output.textContent += html;
    fileInput.disabled = false;
    formSubmitBtn.disabled = true;
  } catch (err) {
    output.textContent = `Error: ${(err as Error).message}`;
    output.classList.remove('hidden');
  }
});

const beautifyBtn = document.getElementById('beautify') as HTMLButtonElement;
beautifyBtn.addEventListener('click', () => {
  if (!output.textContent) {
    output.textContent = 'No output to beautify.';
    return;
  }

  try {
    const beautifiedHtml = beautify.html(output.textContent, {
      indent_size: 4,
      wrap_line_length: 70,
    });
    output.textContent = beautifiedHtml;
  } catch (err) {
    output.textContent = `Error beautifying HTML: ${(err as Error).message}`;
  }
});

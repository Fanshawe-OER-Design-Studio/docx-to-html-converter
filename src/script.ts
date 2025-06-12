import { convert } from './convert-form/docxToHTML';

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

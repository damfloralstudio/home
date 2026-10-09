const dialog = document.querySelector('.lightbox');let opener;
document.querySelectorAll('[data-image]').forEach(button => button.addEventListener('click', () => {opener = button;const img = dialog.querySelector('img');img.src = button.dataset.image;img.alt = button.querySelector('img').alt;dialog.showModal();document.body.classList.add('modal-open');}));
dialog.querySelector('.close').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', e => {if(e.target === dialog){const r = dialog.getBoundingClientRect();if(e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialog.close();}});
dialog.addEventListener('close', () => {document.body.classList.remove('modal-open');opener?.focus();});
document.querySelector('#year').textContent = new Date().getFullYear();

const requestDialog = document.querySelector('.request-dialog');
const requestForm = document.querySelector('#request-form');
let requestOpener;
document.querySelectorAll('[data-request]').forEach(button => button.addEventListener('click', () => {
 requestOpener = button;
 requestForm.elements.service.value = button.dataset.request;
 document.querySelector('#request-status').textContent = '';
 requestDialog.showModal(); document.body.classList.add('modal-open');
}));
requestDialog.querySelector('.request-close').addEventListener('click', () => requestDialog.close());
requestDialog.addEventListener('close', () => { document.body.classList.remove('modal-open'); requestOpener?.focus(); });
requestForm.addEventListener('submit', event => {
 event.preventDefault(); if(!requestForm.reportValidity()) return;
 const f = new FormData(requestForm);
 const subject = `DAM Floral Studio — ${f.get('service')}`;
 const body = `Hello DAM Floral Studio,\n\nName: ${f.get('name')}\nEmail: ${f.get('email')}\nService: ${f.get('service')}\nPreferred date: ${f.get('date') || 'Not specified'}\nLocation: ${f.get('location') || 'Not specified'}\nEstimated budget: ${f.get('budget') || 'Not specified'}\n\n${f.get('message')}\n`;
 window.location.href = `mailto:damfloralstudio@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
 document.querySelector('#request-status').textContent = 'Your email draft is ready to open. Please press Send in your email app. If nothing opens, email damfloralstudio@gmail.com directly.';
});

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
// Arriving from the order page (order.html → ./#inquiry): open the inquiry form, filled in from the order.
// Details are handed over in sessionStorage (this tab only), read once and cleared; they are never in the URL.
function openInquiryFromOrder() {
 if (location.hash !== '#inquiry') return;
 history.replaceState(null, '', location.pathname + location.search);
 let prefill = {};
 try { prefill = JSON.parse(sessionStorage.getItem('dam-inquiry-prefill') || '{}') || {}; sessionStorage.removeItem('dam-inquiry-prefill'); } catch (err) { prefill = {}; }
 requestForm.elements.service.value = 'Custom order';
 for (const field of ['name', 'date', 'location', 'budget', 'message']) {
  const input = requestForm.elements[field];
  if (input && typeof prefill[field] === 'string') input.value = prefill[field].slice(0, input.maxLength > 0 ? input.maxLength : 4000);
 }
 document.querySelector('#request-status').textContent = '';
 requestDialog.showModal(); document.body.classList.add('modal-open');
 (requestForm.elements.name.value ? requestForm.elements.email : requestForm.elements.name).focus();
}
openInquiryFromOrder();
window.addEventListener('hashchange', openInquiryFromOrder);
requestDialog.querySelector('.request-close').addEventListener('click', () => requestDialog.close());
requestDialog.addEventListener('close', () => { document.body.classList.remove('modal-open'); requestOpener?.focus(); });
// Inquiries are delivered by Formspree (form action). Sent in the background so the visitor stays on the page.
requestForm.addEventListener('submit', async event => {
 event.preventDefault(); if(!requestForm.reportValidity()) return;
 const status = document.querySelector('#request-status');
 const submitButton = requestForm.querySelector('.request-button');
 requestForm.elements._subject.value = `DAM Floral Studio — ${requestForm.elements.service.value}`;
 submitButton.disabled = true; submitButton.textContent = 'Sending…'; status.textContent = '';
 try {
  const response = await fetch(requestForm.action, {method: 'POST', body: new FormData(requestForm), headers: {Accept: 'application/json'}});
  if(!response.ok) throw new Error(`Formspree responded ${response.status}: ${await response.text()}`);
  requestForm.reset();
  status.textContent = 'Thank you — your request has been sent. We’ll be in touch soon.';
 } catch(err) {
  console.error('Inquiry submission failed:', err);
  status.textContent = 'Something went wrong. Please try again or email damfloralstudio@gmail.com directly.';
 } finally {
  submitButton.disabled = false; submitButton.textContent = 'Send request';
 }
});

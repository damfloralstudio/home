// Thanksgiving pre-order page: quantities, pickup slot, name, then a checkout
// link from the pre-order API (Cloudflare Worker), which redirects to Square.
// Prices and limits here are for display only; the API enforces the real ones.
// `name`/`plural` are short names for the order summary line; the full product
// names (with "· Designer’s Choice") are on the product cards and in Square.

const CHECKOUT_URL = 'https://preorder-api.damfloralstudio.workers.dev/api/checkout';
const CLOSES_AT = '2026-11-15T23:59:59-05:00';
const REQUEST_TIMEOUT_MS = 15000;
const ERROR_MESSAGE = 'Something went wrong. Please try again or email damfloralstudio@gmail.com.';
const SUBMIT_LABEL = 'Continue to secure checkout';

const PRODUCTS = {
  bouquet: { name: 'Thanksgiving Bouquet', plural: 'Thanksgiving Bouquets', price: 50, max: 3 },
  arrangement: { name: 'Pumpkin Floral Arrangement', plural: 'Pumpkin Floral Arrangements', price: 60, max: 2 },
};

// Analytics must never break checkout (blocked script, slow load, errors).
function track(event, data) {
  try {
    if (window.umami && typeof window.umami.track === 'function') window.umami.track(event, data);
  } catch (err) { /* ignore */ }
}

const year = document.querySelector('#year');
if (year) year.textContent = new Date().getFullYear();

const form = document.querySelector('#tg-form');
if (form) initPreorder(form);

function initPreorder(form) {
  const closed = document.querySelector('#tg-closed');
  const summary = document.querySelector('#tg-summary');
  const submit = document.querySelector('#tg-submit');
  const status = document.querySelector('#tg-status');
  const nameInput = document.querySelector('#tg-name');
  const quantities = { bouquet: 0, arrangement: 0 };
  let started = false;
  let submitting = false;

  function showClosed() {
    form.hidden = true;
    closed.hidden = false;
  }

  if (Date.now() > Date.parse(CLOSES_AT)) {
    showClosed();
    return;
  }

  function markStarted() {
    if (started) return;
    started = true;
    track('start_order');
  }

  function selectedPickup() {
    const checked = form.querySelector('input[name="pickup"]:checked');
    return checked ? checked.value : null;
  }

  function subtotal() {
    return Object.entries(quantities).reduce((sum, [key, qty]) => sum + qty * PRODUCTS[key].price, 0);
  }

  function render() {
    for (const card of form.querySelectorAll('.tg-product')) {
      const key = card.dataset.product;
      const qty = quantities[key];
      card.querySelector('.tg-qty').textContent = qty;
      card.querySelector('[data-step="-1"]').disabled = submitting || qty <= 0;
      card.querySelector('[data-step="1"]').disabled = submitting || qty >= PRODUCTS[key].max;
      card.classList.toggle('is-selected', qty > 0);
    }
    const parts = Object.entries(quantities)
      .filter(([, qty]) => qty > 0)
      .map(([key, qty]) => `${qty} ${qty === 1 ? PRODUCTS[key].name : PRODUCTS[key].plural}`);
    summary.textContent = parts.length
      ? `${parts.join(' · ')} · Subtotal $${subtotal().toFixed(2)} · NJ sales tax added at checkout`
      : 'Choose at least one item to continue.';
    const ready = parts.length > 0 && selectedPickup() && nameInput.value.trim().length > 0;
    submit.disabled = submitting || !ready;
  }

  form.addEventListener('click', event => {
    const button = event.target.closest('.tg-step');
    if (!button || button.disabled) return;
    const key = button.closest('.tg-product').dataset.product;
    const next = quantities[key] + Number(button.dataset.step);
    if (next < 0 || next > PRODUCTS[key].max) return;
    quantities[key] = next;
    markStarted();
    status.textContent = '';
    render();
  });

  form.addEventListener('change', event => {
    if (event.target.name === 'pickup') markStarted();
    render();
  });
  nameInput.addEventListener('input', render);

  function setSubmitting(value, label = SUBMIT_LABEL) {
    submitting = value;
    submit.textContent = label;
    for (const input of form.querySelectorAll('input')) input.disabled = value;
    render();
  }

  function fail(reason) {
    track('checkout_error', { reason });
    status.textContent = ERROR_MESSAGE;
    setSubmitting(false);
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (submitting || submit.disabled) return;
    const pickup = selectedPickup();
    const name = nameInput.value.trim();
    track('checkout_click', { bouquets: quantities.bouquet, arrangements: quantities.arrangement, pickup, subtotal: subtotal() });
    status.textContent = '';
    setSubmitting(true, 'Preparing checkout…');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let response, data;
    try {
      response = await fetch(CHECKOUT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: { bouquet: quantities.bouquet, arrangement: quantities.arrangement }, pickup, name }),
        signal: controller.signal,
      });
      data = await response.json().catch(() => ({}));
    } catch (err) {
      clearTimeout(timer);
      console.error('Checkout request failed:', err);
      return fail(err.name === 'AbortError' ? 'timeout' : 'network');
    }
    clearTimeout(timer);

    if (response.status === 403 && data.error === 'preorders_closed') {
      track('checkout_error', { reason: 'preorders_closed' });
      setSubmitting(false);
      return showClosed();
    }

    let url = null;
    try {
      if (response.ok && data.url && new URL(data.url).protocol === 'https:') url = data.url;
    } catch (err) { /* invalid URL */ }
    if (!url) {
      console.error('Checkout API error:', response.status, data);
      return fail(data.error || `http_${response.status}`);
    }

    track('checkout_redirect');
    submit.textContent = 'Redirecting to Square…';
    window.location.assign(url);
  });

  // Coming back with the browser's Back button can restore a frozen page.
  window.addEventListener('pageshow', event => {
    if (event.persisted && submitting) setSubmitting(false);
  });

  render();
}

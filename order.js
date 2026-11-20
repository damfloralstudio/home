// Custom order page: quantities, date, pickup or delivery, name, then a checkout
// link from the order API (Cloudflare Worker), which redirects to Square.
// Prices, limits and the 3-day rule here are for display only; the API enforces
// the real ones. Delivery options come from the API's ZIP lookup, never from this file.

const API_BASE = 'https://preorder-api.damfloralstudio.workers.dev';
const CHECKOUT_URL = `${API_BASE}/api/checkout`;
const QUOTE_URL = `${API_BASE}/api/delivery-quote`;
const REQUEST_TIMEOUT_MS = 15000;
const LEAD_DAYS = 3;
const MAX_DAYS_AHEAD = 180;
const ERROR_MESSAGE = 'Something went wrong. Please try again or email damfloralstudio@gmail.com.';
const SUBMIT_LABEL = 'Continue to secure checkout';
// Handoff to the homepage inquiry form (read once by script.js, then cleared).
const PREFILL_KEY = 'dam-inquiry-prefill';

const PRODUCTS = {
  bouquet: { name: 'Bouquet', plural: 'Bouquets', price: 100, max: 3 },
  arrangement: { name: 'Arrangement', plural: 'Arrangements', price: 200, max: 2 },
};

// Analytics must never break checkout (blocked script, slow load, errors).
function track(event, data) {
  try {
    if (window.umami && typeof window.umami.track === 'function') window.umami.track(event, data);
  } catch (err) { /* ignore */ }
}

const year = document.querySelector('#year');
if (year) year.textContent = new Date().getFullYear();

// ---- Dates (Eastern calendar, same rule as the API) ----

function easternToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
function addDays(ymd, days) {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}
function dateLabel(ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

const form = document.querySelector('#tg-form');
if (form) initOrder(form);

function initOrder(form) {
  const closed = document.querySelector('#tg-closed');
  const summary = document.querySelector('#tg-summary');
  const submit = document.querySelector('#tg-submit');
  const status = document.querySelector('#tg-status');
  const nameInput = document.querySelector('#tg-name');
  const dateInput = document.querySelector('#tg-date');
  const addressBox = document.querySelector('#tg-address');
  const line1Input = document.querySelector('#tg-line1');
  const line2Input = document.querySelector('#tg-line2');
  const zipInput = document.querySelector('#tg-zip');
  const zoneBox = document.querySelector('#tg-zone');
  const zoneMessage = document.querySelector('#tg-zone-message');
  const zoneInquiry = document.querySelector('#tg-zone-inquiry');
  const moreInquiry = document.querySelector('#tg-more-inquiry');
  const quantities = { bouquet: 0, arrangement: 0 };
  let quote = null;        // { zip, mode, zone?, area?, feeCents? } for the current ZIP
  let quoteSeq = 0;
  let started = false;
  let submitting = false;

  const earliest = addDays(easternToday(), LEAD_DAYS);
  const latest = addDays(easternToday(), MAX_DAYS_AHEAD);
  dateInput.min = earliest;
  dateInput.max = latest;

  function showPaused() {
    form.hidden = true;
    closed.hidden = false;
  }

  function markStarted() {
    if (started) return;
    started = true;
    track('start_order');
  }

  const method = () => form.querySelector('input[name="method"]:checked')?.value ?? null;
  const zip = () => zipInput.value.trim();
  const dateOk = () => /^\d{4}-\d{2}-\d{2}$/.test(dateInput.value) && dateInput.value >= earliest && dateInput.value <= latest;
  const productsSubtotal = () => Object.entries(quantities).reduce((sum, [key, qty]) => sum + qty * PRODUCTS[key].price, 0);
  const deliveryFee = () => (method() === 'delivery' && quote?.zip === zip() && quote.mode === 'checkout') ? quote.feeCents / 100 : 0;
  const itemParts = () => Object.entries(quantities)
    .filter(([, qty]) => qty > 0)
    .map(([key, qty]) => `${qty} ${qty === 1 ? PRODUCTS[key].name : PRODUCTS[key].plural}`);

  function renderZone() {
    const isDelivery = method() === 'delivery';
    addressBox.hidden = !isDelivery;
    const current = quote && quote.zip === zip() ? quote : null;
    zoneBox.hidden = !isDelivery || !current;
    zoneInquiry.hidden = true;
    if (!current) return;
    zoneBox.dataset.mode = current.mode;
    if (current.mode === 'checkout') {
      zoneMessage.textContent = `Delivery to ${current.area}: $${(current.feeCents / 100).toFixed(2)}`;
    } else if (current.mode === 'inquiry') {
      zoneMessage.textContent = `We deliver to ${current.area}! The cost depends on your location, so please send us an inquiry and we’ll get back to you.`;
      zoneInquiry.hidden = false;
    } else if (current.mode === 'error') {
      zoneMessage.textContent = 'We couldn’t check that ZIP code. Please try again, or email damfloralstudio@gmail.com.';
    } else {
      zoneMessage.textContent = 'We don’t deliver there, but pickup is available.';
    }
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
    renderZone();

    const parts = itemParts();
    const fee = deliveryFee();
    if (parts.length) {
      // Same order as Square's checkout: flowers-only subtotal, then delivery, then tax.
      const segments = [...parts, `Subtotal $${productsSubtotal().toFixed(2)}`];
      if (fee) segments.push(`Delivery $${fee.toFixed(2)}`);
      segments.push('NJ sales tax added at checkout');
      summary.textContent = segments.join(' · ');
    } else {
      summary.textContent = 'Choose at least one item to continue.';
    }

    const m = method();
    const deliveryReady = m === 'delivery' && line1Input.value.trim().length > 0 && quote?.zip === zip() && quote.mode === 'checkout';
    const ready = parts.length > 0 && dateOk() && (m === 'pickup' || deliveryReady) && nameInput.value.trim().length > 0;
    submit.disabled = submitting || !ready;
    // Zone 2 / Manhattan: the inquiry form replaces checkout.
    submit.hidden = m === 'delivery' && quote?.zip === zip() && quote.mode === 'inquiry';
  }

  async function checkZip() {
    const value = zip();
    if (!/^\d{5}$/.test(value)) { quote = null; render(); return; }
    if (quote?.zip === value && quote.mode !== 'error') { render(); return; }
    const seq = ++quoteSeq;
    try {
      const response = await fetch(QUOTE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zip: value }),
        signal: AbortSignal.timeout ? AbortSignal.timeout(REQUEST_TIMEOUT_MS) : undefined,
      });
      const data = await response.json();
      if (!response.ok || !['checkout', 'inquiry', 'unavailable'].includes(data.mode)) throw new Error(`quote ${response.status}`);
      if (seq !== quoteSeq) return;
      quote = { zip: value, ...data };
      track('delivery_check', { mode: data.mode, zone: data.zone || 'none' });
    } catch (err) {
      if (seq !== quoteSeq) return;
      console.error('Delivery quote failed:', err);
      quote = { zip: value, mode: 'error' };
    }
    render();
  }

  // ---- Inquiry handoff (sessionStorage, never the URL) ----

  function saveInquiryPrefill() {
    const parts = itemParts();
    const m = method();
    const prefill = { service: 'Custom order' };
    if (nameInput.value.trim()) prefill.name = nameInput.value.trim();
    if (dateOk()) prefill.date = dateInput.value;
    if (m === 'delivery') {
      const street = [line1Input.value.trim(), line2Input.value.trim()].filter(Boolean).join(', ');
      prefill.location = [street, zip()].filter(Boolean).join(' ');
    }
    if (parts.length) prefill.budget = `$${productsSubtotal()} (${parts.join(', ')})${m === 'delivery' ? ' + delivery' : ''}`;
    const what = parts.length ? parts.join(' and ') : 'flowers';
    const where = m === 'delivery' && zip() ? ` delivered to ${zip()}` : '';
    const when = dateOk() ? ` on ${dateLabel(dateInput.value)}` : '';
    prefill.message = `I'd like ${what}${where}${when}.${m === 'delivery' ? ' Please let me know the delivery cost.' : ''}`;
    try { sessionStorage.setItem(PREFILL_KEY, JSON.stringify(prefill)); } catch (err) { /* storage blocked: form opens empty */ }
  }

  for (const link of [zoneInquiry, moreInquiry]) {
    link.addEventListener('click', () => {
      saveInquiryPrefill();
      track('inquiry_handoff', { zone: link === zoneInquiry ? (quote?.zone || 'none') : 'more' });
    });
  }

  // ---- Events ----

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
    if (event.target.name === 'method' || event.target.name === 'date') markStarted();
    if (event.target.name === 'method' && method() === 'delivery') checkZip();
    render();
  });
  for (const input of [nameInput, line1Input, line2Input, dateInput]) input.addEventListener('input', render);
  zipInput.addEventListener('input', () => {
    zipInput.value = zipInput.value.replace(/\D/g, '').slice(0, 5);
    checkZip();
  });

  function setSubmitting(value, label = SUBMIT_LABEL) {
    submitting = value;
    submit.textContent = label;
    for (const input of form.querySelectorAll('input')) input.disabled = value;
    render();
  }

  function fail(reason, message = ERROR_MESSAGE) {
    track('checkout_error', { reason });
    status.textContent = message;
    setSubmitting(false);
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (submitting || submit.disabled) return;
    const m = method();
    const body = {
      items: { bouquet: quantities.bouquet, arrangement: quantities.arrangement },
      method: m,
      date: dateInput.value,
      name: nameInput.value.trim(),
    };
    if (m === 'delivery') body.address = { line1: line1Input.value.trim(), line2: line2Input.value.trim(), zip: zip() };
    track('checkout_click', { bouquets: quantities.bouquet, arrangements: quantities.arrangement, method: m, subtotal: productsSubtotal() + deliveryFee() });
    status.textContent = '';
    setSubmitting(true, 'Preparing checkout…');

    let response, data;
    try {
      response = await fetch(CHECKOUT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout ? AbortSignal.timeout(REQUEST_TIMEOUT_MS) : undefined,
      });
      data = await response.json().catch(() => ({}));
    } catch (err) {
      console.error('Checkout request failed:', err);
      return fail(err.name === 'TimeoutError' || err.name === 'AbortError' ? 'timeout' : 'network');
    }

    if (response.status === 403 && data.error === 'orders_paused') {
      track('checkout_error', { reason: 'orders_paused' });
      setSubmitting(false);
      return showPaused();
    }
    if (data.error === 'invalid_date') {
      return fail('invalid_date', 'Please choose a date at least 3 days from today.');
    }
    if (data.error === 'delivery_inquiry' || data.error === 'delivery_unavailable') {
      quote = null;
      setSubmitting(false);
      return checkZip();
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

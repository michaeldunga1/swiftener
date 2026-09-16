export function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function formatDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function toast(message, { error = false } = {}) {
  const root = document.getElementById('toast-root');
  if (!root) return;
  const el = document.createElement('div');
  el.className = `toast${error ? ' error' : ''}`;
  el.textContent = message;
  root.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

export function setQuery(params) {
  const url = new URL(window.location.href);
  Object.entries(params).forEach(([k, v]) => {
    if (v == null || v === '') url.searchParams.delete(k);
    else url.searchParams.set(k, v);
  });
  window.history.replaceState({}, '', url);
}

export function getQuery() {
  const url = new URL(window.location.href);
  const out = {};
  url.searchParams.forEach((v, k) => {
    out[k] = v;
  });
  return out;
}

let passwordIdCounter = 0;

/** Password field with show/hide toggle. */
export function passwordInput({ name, required = false, minlength, autocomplete } = {}) {
  const id = `password-field-${++passwordIdCounter}`;
  const req = required ? ' required' : '';
  const min = minlength ? ` minlength="${minlength}"` : '';
  const ac = autocomplete ? ` autocomplete="${autocomplete}"` : '';
  return `<span class="password-wrap">
    <input type="password" id="${id}" name="${name}"${req}${min}${ac} />
    <button type="button" class="password-toggle" aria-label="Show password" aria-controls="${id}">Show</button>
  </span>`;
}

export function initPasswordToggles(root = document) {
  root.querySelectorAll('.password-wrap').forEach((wrap) => {
    const input = wrap.querySelector('input[type="password"], input[type="text"]');
    const btn = wrap.querySelector('.password-toggle');
    if (!input || !btn || btn.dataset.bound) return;
    btn.dataset.bound = '1';
    btn.addEventListener('click', () => {
      const hidden = input.type === 'password';
      input.type = hidden ? 'text' : 'password';
      btn.textContent = hidden ? 'Hide' : 'Show';
      btn.setAttribute('aria-label', hidden ? 'Hide password' : 'Show password');
    });
  });
}

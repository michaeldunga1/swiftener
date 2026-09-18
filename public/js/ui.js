export function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** URL-safe tag segment for /posts/:tag/:slug */
export function tagSlug(tag) {
  const s = String(tag || 'general')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return s || 'general';
}

function primaryTag(post) {
  if (Array.isArray(post?.tags) && post.tags.length) return post.tags[0];
  if (post?.category) return post.category;
  return 'general';
}

/** Canonical public post path: /posts/:tag/:slug */
export function postPath(post, { hash = '' } = {}) {
  const slug = post?.slug;
  if (!slug) return '/';
  const path = `/posts/${encodeURIComponent(tagSlug(primaryTag(post)))}/${encodeURIComponent(slug)}`;
  return hash ? `${path}${hash.startsWith('#') ? hash : `#${hash}`}` : path;
}

export function tagFilterHref(tag) {
  return `/?tag=${encodeURIComponent(tag)}`;
}

export function renderTagLinks(tags) {
  return (tags || [])
    .map((t) => `<a href="${tagFilterHref(t)}" data-link class="tag">${escapeHtml(t)}</a>`)
    .join('');
}

/** Link a name, username, or email to `/users/:id`. Falls back to plain text if no id. */
export function userLink(user, label) {
  const id = user != null && typeof user === 'object' ? user._id : user;
  const text =
    label != null
      ? label
      : user != null && typeof user === 'object'
        ? user.name || user.email || 'User'
        : 'User';
  if (id == null || id === '') return escapeHtml(text);
  return `<a href="/users/${encodeURIComponent(id)}" data-link class="user-link">${escapeHtml(text)}</a>`;
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

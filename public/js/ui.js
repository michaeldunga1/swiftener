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

/** Escape and wrap case-insensitive matches of `query` in <mark>. */
export function highlightMatch(text, query) {
  const source = String(text ?? '');
  const q = String(query ?? '').trim();
  if (!q) return escapeHtml(source);
  const escaped = escapeHtml(source);
  const safeQ = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  try {
    return escaped.replace(new RegExp(`(${safeQ})`, 'ig'), '<mark>$1</mark>');
  } catch {
    return escaped;
  }
}

/** Canonical public profile path: /users/:username (falls back to id). */
export function userPath(user) {
  if (user == null) return '/';
  if (typeof user === 'object') {
    if (user.username) return `/users/${encodeURIComponent(user.username)}`;
    if (user._id != null) return `/users/${encodeURIComponent(user._id)}`;
    return '/';
  }
  return `/users/${encodeURIComponent(user)}`;
}

/** Link a name, username, or email to `/users/:username`. Falls back to plain text if no id/username. */
export function userLink(user, label) {
  const text =
    label != null
      ? label
      : user != null && typeof user === 'object'
        ? user.name || user.email || 'User'
        : 'User';
  const href =
    user != null && typeof user === 'object'
      ? user.username || user._id
        ? userPath(user)
        : null
      : user != null && user !== ''
        ? userPath(user)
        : null;
  if (!href) return escapeHtml(text);
  return `<a href="${href}" data-link class="user-link">${escapeHtml(text)}</a>`;
}

export function formatDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

/** Join meta fragments with · separators, skipping empty ones. */
export function metaLine(...parts) {
  return parts.filter(Boolean).join('<span class="meta-sep" aria-hidden="true">·</span>');
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

/** Absolute page URL for sharing (uses site config when available). */
export function absoluteShareUrl(path = window.location.pathname + window.location.search) {
  const origin = (window.__SWIFTENER__?.siteUrl || window.location.origin || '').replace(/\/+$/, '');
  if (/^https?:\/\//i.test(path)) return path;
  return `${origin}${path.startsWith('/') ? path : `/${path}`}`;
}

/** Build share destination URLs for common networks. */
export function buildShareLinks(url, title = '') {
  const text = String(title || 'Swiftener');
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(text);
  return {
    x: `https://twitter.com/intent/tweet?text=${t}&url=${u}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${u}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${u}`,
    reddit: `https://www.reddit.com/submit?url=${u}&title=${t}`,
    whatsapp: `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`,
    email: `mailto:?subject=${t}&body=${u}`,
    link: url,
  };
}

const SHARE_NETWORKS = [
  { key: 'x', label: 'X' },
  { key: 'facebook', label: 'Facebook' },
  { key: 'linkedin', label: 'LinkedIn' },
  { key: 'reddit', label: 'Reddit' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'email', label: 'Email' },
  { key: 'link', label: 'Copy link', copy: true },
];

/** HTML for a social share button row. */
export function renderShareButtons({ url, title, className = '' } = {}) {
  const links = buildShareLinks(url, title);
  const buttons = SHARE_NETWORKS.map(({ key, label, copy }) => {
    if (copy) {
      return `<button type="button" class="share-btn" data-share="link" data-url="${escapeHtml(links.link)}">${escapeHtml(label)}</button>`;
    }
    return `<a class="share-btn" href="${escapeHtml(links[key])}" data-share="${escapeHtml(key)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`;
  }).join('');
  return `
    <div class="share-row${className ? ` ${className}` : ''}" role="group" aria-label="Share this page">
      <span class="share-label">Share</span>
      <div class="share-actions">${buttons}</div>
    </div>
  `;
}

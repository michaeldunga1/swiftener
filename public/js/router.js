const routes = [];
let afterRender = () => {};

export function setAfterRender(fn) {
  afterRender = fn;
}

export function route(pattern, handler) {
  routes.push({ pattern, handler });
}

function matchPath(pathname) {
  for (const { pattern, handler } of routes) {
    const m = pathname.match(pattern);
    if (m) return { handler, params: m.groups || {} };
  }
  return null;
}

export async function navigate(path, { replace = false } = {}) {
  if (path.startsWith('http')) {
    window.location.href = path;
    return;
  }
  const url = path.startsWith('/') ? path : `/${path}`;
  if (replace) window.history.replaceState({}, '', url);
  else window.history.pushState({}, '', url);
  await renderCurrent();
}

export async function renderCurrent() {
  const pathname = window.location.pathname.replace(/\/+$/, '') || '/';
  const match = matchPath(pathname);
  const app = document.getElementById('app');
  if (!app) return;
  app.innerHTML = '<p class="muted">Loading…</p>';
  try {
    if (match) await match.handler(app, match.params);
    else await routes[0].handler(app, {});
  } catch (err) {
    app.innerHTML = `<div class="panel"><h2>Something went wrong</h2><p>${err.message || 'Error'}</p></div>`;
  }
  afterRender();
}

export function initRouter() {
  document.body.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-link]');
    if (!a || a.target === '_blank') return;
    const href = a.getAttribute('href');
    if (!href || href.startsWith('http') || href.startsWith('mailto:')) return;
    e.preventDefault();
    navigate(href);
  });
  window.addEventListener('popstate', () => renderCurrent());
}

import { route, initRouter, renderCurrent, navigate, setAfterRender } from './router.js';
import { refreshUser, clearUser, getUser } from './state.js';
import { api } from './api.js';
import { toast, escapeHtml } from './ui.js';
import { renderHome } from './pages/home.js';
import { renderPost } from './pages/post.js';
import {
  renderLogin,
  renderRegister,
  renderForgotPassword,
  renderResetPassword,
  renderVerifyEmail,
} from './pages/auth.js';
import {
  renderProfile,
  renderProfileList,
  renderNotifications,
  renderPublicProfile,
} from './pages/profile.js';
import {
  renderAdminDashboard,
  renderAdminDrafts,
  renderAdminPostEditor,
  renderAdminUsers,
  renderAdminReports,
  renderAdminAnalytics,
  renderAdminErrors,
  renderAdminDatabase,
} from './pages/admin.js';
import {
  renderNewsletter,
  renderNewsletterVerify,
  renderNewsletterUnsubscribe,
} from './pages/newsletter.js';
import {
  renderAbout,
  renderContact,
  renderPrivacy,
  renderTerms,
} from './pages/static.js';

function renderNav() {
  const nav = document.getElementById('nav-main');
  const actions = document.getElementById('header-actions');
  const user = getUser();
  const path = window.location.pathname;

  nav.innerHTML = `
    <a href="/" data-link class="${path === '/' ? 'active' : ''}">Home</a>
    ${user ? `<a href="/profile" data-link class="${path.startsWith('/profile') ? 'active' : ''}">Profile</a>` : ''}
    ${user?.role === 'admin' ? `<a href="/admin" data-link class="${path.startsWith('/admin') ? 'active' : ''}">Admin</a>` : ''}
  `;

  if (user) {
    actions.innerHTML = `
      <a href="/users/${user._id}" data-link class="user-link muted" style="font-size:0.9rem">${escapeHtml(user.name)}</a>
      <button type="button" class="btn btn-ghost" id="logout-btn">Log out</button>
    `;
    actions.querySelector('#logout-btn').addEventListener('click', async () => {
      await api.post('/auth/logout');
      clearUser();
      toast('Logged out');
      renderNav();
      renderFooter();
      navigate('/');
    });
  } else {
    actions.innerHTML = `
      <a href="/login" data-link class="btn btn-ghost">Log in</a>
      <a href="/register" data-link class="btn btn-primary">Sign up</a>
    `;
  }
}

function renderFooter() {
  const nav = document.getElementById('footer-nav');
  const year = document.getElementById('footer-year');
  if (year) year.textContent = String(new Date().getFullYear());
  if (!nav) return;

  const user = getUser();
  const links = [
    ['/', 'Home'],
    ['/#search', 'Search'],
    ['/newsletter', 'Resources'],
    ['/#categories', 'Categories'],
    user ? ['/profile/saved', 'Saved'] : ['/login', 'Log in'],
    ['/about', 'About'],
    ['/contact', 'Contact'],
    ['/privacy', 'Privacy Policy'],
    ['/terms', 'Terms of Use'],
  ];

  nav.innerHTML = links
    .map(([href, label]) => `<a href="${href}" data-link>${label}</a>`)
    .join('');
}

route(/^\/$/, renderHome);
route(/^\/posts\/(?<tag>[^/]+)\/(?<slug>[^/]+)$/, (root, params) => renderPost(root, params));
route(/^\/posts\/(?<slug>[^/]+)$/, (root, params) => renderPost(root, params));
route(/^\/login$/, renderLogin);
route(/^\/register$/, renderRegister);
route(/^\/forgot-password$/, renderForgotPassword);
route(/^\/reset-password$/, renderResetPassword);
route(/^\/verify-email$/, renderVerifyEmail);
route(/^\/profile$/, renderProfile);
route(/^\/profile\/saved$/, (root) => renderProfileList(root, 'save', 'profile/saved'));
route(/^\/profile\/liked$/, (root) => renderProfileList(root, 'like', 'profile/liked'));
route(/^\/profile\/bookmarked$/, (root) => renderProfileList(root, 'bookmark', 'profile/bookmarked'));
route(/^\/profile\/notifications$/, renderNotifications);
route(/^\/users\/(?<id>\d+)$/, (root, params) => renderPublicProfile(root, params));
route(/^\/newsletter$/, renderNewsletter);
route(/^\/newsletter\/verify$/, renderNewsletterVerify);
route(/^\/newsletter\/unsubscribe$/, renderNewsletterUnsubscribe);
route(/^\/admin$/, renderAdminDashboard);
route(/^\/admin\/analytics$/, renderAdminAnalytics);
route(/^\/admin\/errors$/, renderAdminErrors);
route(/^\/admin\/database$/, renderAdminDatabase);
route(/^\/admin\/drafts$/, renderAdminDrafts);
route(/^\/admin\/posts\/new$/, (root) => renderAdminPostEditor(root, {}));
route(/^\/admin\/posts\/edit\/(?<id>\d+)$/, (root, params) => renderAdminPostEditor(root, params));
route(/^\/admin\/users$/, renderAdminUsers);
route(/^\/admin\/reports$/, renderAdminReports);
route(/^\/about$/, renderAbout);
route(/^\/contact$/, renderContact);
route(/^\/privacy$/, renderPrivacy);
route(/^\/terms$/, renderTerms);

function trackPageLoad() {
  const path = window.location.pathname || '/';
  if (path.startsWith('/api/')) return;

  const uaData = navigator.userAgentData;
  const platform =
    navigator.platform ||
    (uaData?.platform ? `${uaData.platform}${uaData.architecture ? ` ${uaData.architecture}` : ''}` : '') ||
    '';

  const payload = {
    path,
    fullUrl: window.location.href,
    queryString: window.location.search || '',
    referrer: document.referrer || '',
    language: navigator.language || (navigator.languages && navigator.languages[0]) || '',
    platform,
    screenWidth: window.screen?.width,
    screenHeight: window.screen?.height,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
    userAgent: navigator.userAgent || '',
  };
  // Fire-and-forget; do not block navigation
  api.post('/analytics/pageview', payload).catch(() => {});
}

function reportClientError(payload) {
  api.post('/analytics/error', {
    path: window.location.pathname || '/',
    fullUrl: window.location.href,
    referrer: document.referrer || '',
    userAgent: navigator.userAgent || '',
    ...payload,
  }).catch(() => {});
}

function initClientErrorLogging() {
  window.addEventListener('error', (event) => {
    reportClientError({
      type: 'error',
      message: event.message || String(event.error || 'Script error'),
      stack: event.error?.stack || '',
      filename: event.filename || '',
      lineno: event.lineno,
      colno: event.colno,
    });
  });
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    reportClientError({
      type: 'unhandledrejection',
      message: reason?.message || String(reason || 'Unhandled promise rejection'),
      stack: reason?.stack || '',
    });
  });
}

async function boot() {
  initClientErrorLogging();
  setAfterRender(() => {
    renderNav();
    renderFooter();
    trackPageLoad();
  });
  initRouter();
  try {
    await refreshUser();
  } catch {
    clearUser();
  }
  renderNav();
  renderFooter();
  await renderCurrent();
}

boot();

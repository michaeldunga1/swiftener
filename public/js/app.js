import { route, initRouter, renderCurrent, navigate, setAfterRender } from './router.js';
import { refreshUser, clearUser, getUser } from './state.js';
import { api } from './api.js';
import { toast } from './ui.js';
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
} from './pages/profile.js';
import {
  renderAdminDashboard,
  renderAdminDrafts,
  renderAdminPostEditor,
  renderAdminUsers,
  renderAdminReports,
} from './pages/admin.js';
import {
  renderNewsletter,
  renderNewsletterVerify,
  renderNewsletterUnsubscribe,
} from './pages/newsletter.js';

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
      <span class="muted" style="font-size:0.9rem">${user.name}</span>
      <button type="button" class="btn btn-ghost" id="logout-btn">Log out</button>
    `;
    actions.querySelector('#logout-btn').addEventListener('click', async () => {
      await api.post('/auth/logout');
      clearUser();
      toast('Logged out');
      renderNav();
      navigate('/');
    });
  } else {
    actions.innerHTML = `
      <a href="/login" data-link class="btn btn-ghost">Log in</a>
      <a href="/register" data-link class="btn btn-primary">Sign up</a>
    `;
  }
}

route(/^\/$/, renderHome);
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
route(/^\/newsletter$/, renderNewsletter);
route(/^\/newsletter\/verify$/, renderNewsletterVerify);
route(/^\/newsletter\/unsubscribe$/, renderNewsletterUnsubscribe);
route(/^\/admin$/, renderAdminDashboard);
route(/^\/admin\/drafts$/, renderAdminDrafts);
route(/^\/admin\/posts\/new$/, (root) => renderAdminPostEditor(root, {}));
route(/^\/admin\/posts\/edit\/(?<id>\d+)$/, (root, params) => renderAdminPostEditor(root, params));
route(/^\/admin\/users$/, renderAdminUsers);
route(/^\/admin\/reports$/, renderAdminReports);

async function boot() {
  setAfterRender(renderNav);
  initRouter();
  try {
    await refreshUser();
  } catch {
    clearUser();
  }
  renderNav();
  await renderCurrent();
}

boot();

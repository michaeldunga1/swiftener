import { api } from '../api.js';
import { escapeHtml, formatDate, toast, passwordInput, initPasswordToggles, userLink, postPath } from '../ui.js';
import { navigate } from '../router.js';
import { getUser, refreshUser } from '../state.js';
import { setPageSeo, setNoIndex } from '../seo.js';

function profileTabs(active) {
  const tabs = [
    ['profile', 'Profile'],
    ['profile/saved', 'Saved'],
    ['profile/liked', 'Liked'],
    ['profile/bookmarked', 'Bookmarked'],
    ['profile/notifications', 'Notifications'],
  ];
  return `<nav class="tabs">${tabs
    .map(([href, label]) => `<a href="/${href}" data-link class="${active === href ? 'active' : ''}">${label}</a>`)
    .join('')}</nav>`;
}

function requireLogin(root) {
  if (getUser()) return true;
  setNoIndex('Profile');
  root.innerHTML = '<div class="panel"><p><a href="/login" data-link>Log in</a> to view your profile.</p></div>';
  return false;
}

export async function renderPublicProfile(root, { id }) {
  let data;
  try {
    data = await api.get(`/users/${encodeURIComponent(id)}`);
  } catch (err) {
    root.innerHTML = `<div class="panel"><p>${escapeHtml(err.message || 'User not found')}</p></div>`;
    return;
  }
  const profile = data.user;
  const me = getUser();
  const isSelf = me && String(me._id) === String(profile._id);

  setPageSeo({
    title: profile.name || 'Profile',
    description: profile.bio || `${profile.name || 'User'} on Swiftener.`,
    path: `/users/${profile._id}`,
    image: profile.avatar || '',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'Person',
      name: profile.name,
      description: profile.bio || undefined,
      image: profile.avatar || undefined,
    },
  });

  root.innerHTML = `
    <div class="panel">
      <p class="muted" style="margin:0 0 0.35rem">Profile</p>
      <h1 class="profile-name">${escapeHtml(profile.name || 'User')}</h1>
      ${profile.bio ? `<p>${escapeHtml(profile.bio)}</p>` : '<p class="muted">No bio yet.</p>'}
      <p class="muted">Member since ${formatDate(profile.createdAt)}</p>
      ${
        profile.avatar
          ? `<p style="margin-top:1rem"><img src="${escapeHtml(profile.avatar)}" alt="" class="profile-avatar" width="96" height="96" /></p>`
          : ''
      }
      ${isSelf ? `<p style="margin-top:1.25rem"><a href="/profile" data-link class="btn btn-primary">Edit your profile</a></p>` : ''}
    </div>
  `;
}

export async function renderProfile(root) {
  if (!requireLogin(root)) return;
  setNoIndex('Your profile');
  const user = getUser();
  root.innerHTML = `
    ${profileTabs('profile')}
    <div class="panel">
      <h2>${userLink(user, user.name)}</h2>
      <p class="muted">${userLink(user, user.email)} · ${user.role}</p>
      <p class="muted"><a href="/users/${user._id}" data-link>View public profile</a></p>
      <form id="profile-form" class="form-stack" style="max-width:100%;margin-top:1rem">
        <label>Name<input name="name" value="${escapeHtml(user.name)}" required /></label>
        <label>Bio<textarea name="bio" maxlength="500">${escapeHtml(user.bio || '')}</textarea></label>
        <label>Avatar URL<input name="avatar" value="${escapeHtml(user.avatar || '')}" placeholder="https://…" /></label>
        <button type="submit" class="btn btn-primary">Save profile</button>
      </form>
    </div>
    <div class="panel">
      <h3>Change password</h3>
      <form id="password-form" class="form-stack">
        <label>Current password${passwordInput({ name: 'currentPassword', required: true, autocomplete: 'current-password' })}</label>
        <label>New password${passwordInput({ name: 'newPassword', required: true, minlength: 8, autocomplete: 'new-password' })}</label>
        <button type="submit" class="btn btn-ghost">Update password</button>
      </form>
    </div>
    <div class="panel">
      <h3>Newsletter</h3>
      <p class="muted">Get occasional Swiftener updates by email.</p>
      <form id="profile-newsletter-form" class="form-stack">
        <label>Email<input type="email" name="email" value="${escapeHtml(user.email || '')}" required /></label>
        <button type="submit" class="btn btn-primary">Subscribe</button>
      </form>
      <p class="muted" style="margin-top:0.75rem"><a href="/newsletter" data-link>Open newsletter page</a></p>
    </div>
  `;

  initPasswordToggles(root);
  root.querySelector('#profile-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await api.put('/users/me', {
        name: fd.get('name'),
        bio: fd.get('bio'),
        avatar: fd.get('avatar'),
      });
      await refreshUser();
      toast('Profile updated');
      navigate('/profile');
    } catch (err) {
      toast(err.message, { error: true });
    }
  });

  root.querySelector('#password-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await api.put('/users/me/password', {
        currentPassword: fd.get('currentPassword'),
        newPassword: fd.get('newPassword'),
      });
      e.target.reset();
      toast('Password updated');
    } catch (err) {
      toast(err.message, { error: true });
    }
  });

  root.querySelector('#profile-newsletter-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = new FormData(e.target).get('email');
    try {
      await api.post('/newsletter/subscribe', { email });
      toast('Check your inbox to confirm');
    } catch (err) {
      toast(err.message, { error: true });
    }
  });
}

export async function renderProfileList(root, type, tabKey) {
  if (!requireLogin(root)) return;
  setNoIndex(tabKey);
  const data = await api.get(`/users/me/${type}`);
  root.innerHTML = `
    ${profileTabs(tabKey)}
    <div class="card-grid">
      ${
        data.posts?.length
          ? data.posts
              .map(
                (p) => `
        <article class="post-card">
          <h2><a href="${postPath(p)}" data-link>${escapeHtml(p.title)}</a></h2>
          <p class="post-meta">${formatDate(p.publishedAt)}</p>
        </article>`
              )
              .join('')
          : '<p class="empty">Nothing here yet.</p>'
      }
    </div>
  `;
}

export async function renderNotifications(root) {
  if (!requireLogin(root)) return;
  setNoIndex('Notifications');
  const data = await api.get('/notifications');
  root.innerHTML = `
    ${profileTabs('profile/notifications')}
    <div class="panel">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem">
        <h2 style="margin:0">Notifications</h2>
        <button type="button" class="btn btn-ghost" id="read-all">Mark all read (${data.unreadCount ?? 0} unread)</button>
      </div>
      <div id="notif-list" style="margin-top:1rem"></div>
    </div>
  `;
  const list = root.querySelector('#notif-list');
  if (!data.notifications?.length) {
    list.innerHTML = '<p class="muted">No notifications.</p>';
  } else {
    list.innerHTML = data.notifications
      .map(
        (n) => `
      <div class="comment" style="opacity:${n.isRead ? 0.75 : 1}">
        <div class="comment-head">${formatDate(n.createdAt)} · ${escapeHtml(n.type)}</div>
        <p>${escapeHtml(n.message)}</p>
        ${n.link ? `<a href="${escapeHtml(n.link.startsWith('/') ? n.link : `/posts${n.link}`)}" data-link>View</a>` : ''}
        ${!n.isRead ? `<button type="button" class="btn btn-ghost" data-read="${n._id}">Mark read</button>` : ''}
      </div>`
      )
      .join('');
  }

  root.querySelector('#read-all')?.addEventListener('click', async () => {
    await api.post('/notifications/read-all');
    toast('All marked read');
    renderNotifications(root);
  });

  list.querySelectorAll('[data-read]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await api.post(`/notifications/${btn.dataset.read}/read`);
      renderNotifications(root);
    });
  });
}

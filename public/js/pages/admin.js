import { api } from '../api.js';
import { escapeHtml, formatDate, getQuery, toast } from '../ui.js';
import { navigate } from '../router.js';
import { getUser } from '../state.js';

function requireAdmin(root) {
  const user = getUser();
  if (user?.role === 'admin') return true;
  root.innerHTML = '<div class="panel"><p>Admin access required.</p></div>';
  return false;
}

function adminNav(active) {
  const links = [
    ['admin', 'Dashboard'],
    ['admin/drafts', 'Drafts'],
    ['admin/posts/new', 'New post'],
    ['admin/users', 'Users'],
    ['admin/reports', 'Reports'],
  ];
  return `<nav class="tabs">${links
    .map(([href, label]) => `<a href="/${href}" data-link class="${active === href ? 'active' : ''}">${label}</a>`)
    .join('')}</nav>`;
}

export async function renderAdminDashboard(root) {
  if (!requireAdmin(root)) return;
  const data = await api.get('/admin/dashboard');
  const t = data.totals || {};
  root.innerHTML = `
    ${adminNav('admin')}
    <div class="stats-grid">
      <div class="stat"><strong>${t.totalPosts ?? 0}</strong>Total posts</div>
      <div class="stat"><strong>${t.publishedPosts ?? 0}</strong>Published</div>
      <div class="stat"><strong>${t.draftPosts ?? 0}</strong>Drafts</div>
      <div class="stat"><strong>${t.totalUsers ?? 0}</strong>Users</div>
      <div class="stat"><strong>${t.pendingReports ?? 0}</strong>Pending reports</div>
    </div>
    <div class="panel" style="margin-top:1.5rem">
      <h3>Top posts</h3>
      <ul>${(data.topPosts || [])
        .map((p) => `<li><a href="/posts/${escapeHtml(p.slug)}" data-link>${escapeHtml(p.title)}</a> — ${p.viewsCount} views</li>`)
        .join('') || '<li class="muted">None yet</li>'}</ul>
    </div>
  `;
}

export async function renderAdminDrafts(root) {
  if (!requireAdmin(root)) return;
  const data = await api.get('/posts/admin/drafts');
  root.innerHTML = `
    ${adminNav('admin/drafts')}
    <div class="table-wrap panel">
      <table>
        <thead><tr><th>Title</th><th>Updated</th><th></th></tr></thead>
        <tbody>
          ${(data.posts || [])
            .map(
              (p) => `<tr>
              <td>${escapeHtml(p.title)}</td>
              <td>${formatDate(p.updatedAt)}</td>
              <td><a href="/admin/posts/edit/${p._id}" data-link class="btn btn-ghost">Edit</a></td>
            </tr>`
            )
            .join('') || '<tr><td colspan="3" class="muted">No drafts</td></tr>'}
        </tbody>
      </table>
    </div>
  `;
}

export async function renderAdminPostEditor(root, { id } = {}) {
  if (!requireAdmin(root)) return;
  let post = null;
  if (id) {
    const drafts = await api.get('/posts/admin/drafts');
    post = drafts.posts?.find((p) => String(p._id) === String(id));
  }
  const slug = getQuery().slug;
  if (!post && slug) {
    const res = await api.get(`/posts/${encodeURIComponent(slug)}`);
    post = res.post;
  }

  const isEdit = Boolean(post?._id);
  root.innerHTML = `
    ${adminNav('admin/posts/new')}
    <div class="panel">
      <h2>${isEdit ? 'Edit post' : 'New post'}</h2>
      <form id="post-editor" class="form-stack" style="max-width:100%">
        <label>Title<input name="title" required value="${escapeHtml(post?.title || '')}" /></label>
        <label>Category<input name="category" required value="${escapeHtml(post?.category || '')}" /></label>
        <label>Tags <span class="hint">comma-separated</span>
          <input name="tags" value="${escapeHtml((post?.tags || []).join(', '))}" /></label>
        <label>Excerpt<textarea name="excerpt">${escapeHtml(post?.excerpt || '')}</textarea></label>
        <label>Cover image URL<input name="coverImage" value="${escapeHtml(post?.coverImage || '')}" /></label>
        <label>Body (Markdown)<textarea name="body" required style="min-height:220px">${escapeHtml(post?.body || '')}</textarea></label>
        <label>Status
          <select name="status">
            <option value="draft" ${post?.status === 'draft' ? 'selected' : ''}>Draft</option>
            <option value="published" ${post?.status === 'published' ? 'selected' : ''}>Published</option>
          </select>
        </label>
        <div style="display:flex;gap:0.5rem;flex-wrap:wrap">
          <button type="submit" class="btn btn-primary">Save</button>
          ${isEdit ? `<button type="button" class="btn btn-danger" id="delete-post">Delete</button>` : ''}
        </div>
      </form>
    </div>
  `;

  root.querySelector('#post-editor').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const tags = fd
      .get('tags')
      ?.toString()
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    const payload = {
      title: fd.get('title'),
      category: fd.get('category'),
      tags,
      excerpt: fd.get('excerpt'),
      coverImage: fd.get('coverImage'),
      body: fd.get('body'),
      status: fd.get('status'),
    };
    try {
      if (isEdit) {
        await api.put(`/posts/${post._id}`, payload);
        toast('Post updated');
        if (payload.status === 'published') navigate(`/posts/${post.slug}`);
        else navigate('/admin/drafts');
      } else {
        const res = await api.post('/posts', payload);
        toast('Post created');
        navigate(res.post?.slug ? `/admin/posts/edit/${res.post._id}` : '/admin/drafts');
      }
    } catch (err) {
      toast(err.message, { error: true });
    }
  });

  root.querySelector('#delete-post')?.addEventListener('click', async () => {
    if (!window.confirm('Delete this post permanently?')) return;
    try {
      await api.delete(`/posts/${post._id}`);
      toast('Post deleted');
      navigate('/admin/drafts');
    } catch (err) {
      toast(err.message, { error: true });
    }
  });
}

export async function renderAdminUsers(root) {
  if (!requireAdmin(root)) return;
  const data = await api.get('/admin/users');
  root.innerHTML = `
    ${adminNav('admin/users')}
    <div class="table-wrap panel">
      <table>
        <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Actions</th></tr></thead>
        <tbody>
          ${(data.users || [])
            .map(
              (u) => `<tr data-user-id="${u._id}">
              <td>${escapeHtml(u.name)}</td>
              <td>${escapeHtml(u.email)}</td>
              <td>${escapeHtml(u.role)}${u.isBlocked ? ' · blocked' : ''}${u.isSuspended ? ' · suspended' : ''}</td>
              <td>
                <button type="button" class="btn btn-ghost" data-act="toggle-admin">${u.role === 'admin' ? 'Revoke admin' : 'Make admin'}</button>
                <button type="button" class="btn btn-ghost" data-act="block">${u.isBlocked ? 'Unblock' : 'Block'}</button>
                <button type="button" class="btn btn-ghost" data-act="suspend">${u.isSuspended ? 'Unsuspend' : 'Suspend'}</button>
              </td>
            </tr>`
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `;

  root.querySelector('tbody').addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const row = btn.closest('tr');
    const id = row.dataset.userId;
    const act = btn.dataset.act;
    try {
      if (act === 'toggle-admin') {
        const isAdmin = btn.textContent.includes('Revoke');
        await api.post(`/admin/users/${id}/${isAdmin ? 'revoke-admin' : 'make-admin'}`);
      } else if (act === 'block') {
        const block = btn.textContent.includes('Unblock') ? 'unblock' : 'block';
        await api.post(`/admin/users/${id}/${block}`);
      } else if (act === 'suspend') {
        if (btn.textContent.includes('Unsuspend')) await api.post(`/admin/users/${id}/unsuspend`);
        else await api.post(`/admin/users/${id}/suspend`, {});
      }
      toast('User updated');
      renderAdminUsers(root);
    } catch (err) {
      toast(err.message, { error: true });
    }
  });
}

export async function renderAdminReports(root) {
  if (!requireAdmin(root)) return;
  const data = await api.get('/admin/reports');
  root.innerHTML = `
    ${adminNav('admin/reports')}
    <div id="reports-list"></div>
  `;
  const list = root.querySelector('#reports-list');
  if (!data.reports?.length) {
    list.innerHTML = '<p class="empty">No pending reports.</p>';
    return;
  }
  list.innerHTML = data.reports
    .map((r) => {
      const comment = r.comment;
      const body = comment?.body || '';
      return `
      <div class="panel" data-report-id="${r._id}">
        <p class="muted">${escapeHtml(r.reportedBy?.name || 'User')} · ${formatDate(r.createdAt)}</p>
        <p><strong>Reason:</strong> ${escapeHtml(r.reason)}</p>
        <blockquote>${escapeHtml(body)}</blockquote>
        <button type="button" class="btn btn-danger" data-resolve="hide">Hide comment</button>
        <button type="button" class="btn btn-ghost" data-resolve="dismiss">Dismiss</button>
      </div>`;
    })
    .join('');

  list.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-resolve]');
    if (!btn) return;
    const panel = btn.closest('[data-report-id]');
    try {
      await api.post(`/admin/reports/${panel.dataset.reportId}/resolve`, { action: btn.dataset.resolve });
      toast('Report resolved');
      renderAdminReports(root);
    } catch (err) {
      toast(err.message, { error: true });
    }
  });
}

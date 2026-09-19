import { api } from '../api.js';
import { escapeHtml, formatDate, getQuery, toast, userLink, postPath } from '../ui.js';
import { navigate } from '../router.js';
import { getUser } from '../state.js';
import { loadChartJs, renderChart, seriesFromRows } from '../charts.js';
import { setNoIndex } from '../seo.js';

function requireAdmin(root) {
  const user = getUser();
  if (user?.role === 'admin') {
    setNoIndex('Admin');
    return true;
  }
  setNoIndex('Admin');
  root.innerHTML = '<div class="panel"><p>Admin access required.</p></div>';
  return false;
}

function adminNav(active) {
  const links = [
    ['admin', 'Dashboard'],
    ['admin/database', 'Database'],
    ['admin/errors', 'Errors'],
    ['admin/analytics', 'Analytics'],
    ['admin/drafts', 'Drafts'],
    ['admin/posts/new', 'Create post'],
    ['admin/newsletter', 'Newsletter'],
    ['admin/users', 'Users'],
    ['admin/reports', 'Reports'],
  ];
  // Edit uses the same form as create; don't highlight "Create post" while editing
  const activeKey = active === 'admin/posts/edit' ? null : active;
  return `<nav class="tabs admin-tabs">${links
    .map(([href, label]) => `<a href="/${href}" data-link class="${activeKey === href ? 'active' : ''}">${label}</a>`)
    .join('')}</nav>`;
}

function cellValue(value) {
  if (value == null) return '<span class="muted">null</span>';
  if (typeof value === 'object') return escapeHtml(JSON.stringify(value));
  const text = String(value);
  if (text.length > 200) {
    return `<details><summary>${escapeHtml(text.slice(0, 80))}…</summary><pre style="white-space:pre-wrap;font-size:0.75rem;max-height:200px;overflow:auto">${escapeHtml(text)}</pre></details>`;
  }
  return escapeHtml(text);
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

export async function renderAdminDashboard(root) {
  if (!requireAdmin(root)) return;
  const data = await api.get('/admin/dashboard');
  const t = data.totals || {};
  const summary = data.pageLoadSummary || {};
  root.innerHTML = `
    ${adminNav('admin')}
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.75rem;margin:0.5rem 0 1.25rem">
      <h2 style="margin:0;font-family:var(--font-display)">Dashboard</h2>
      <a href="/admin/posts/new" data-link class="btn btn-primary">Create post</a>
    </div>
    <div class="stats-grid">
      <div class="stat"><strong>${t.totalPosts ?? 0}</strong>Total posts</div>
      <div class="stat"><strong>${t.publishedPosts ?? 0}</strong>Published</div>
      <div class="stat"><strong>${t.draftPosts ?? 0}</strong>Drafts</div>
      <div class="stat"><strong>${t.totalUsers ?? 0}</strong>Users</div>
      <div class="stat"><strong>${t.pendingReports ?? 0}</strong>Pending reports</div>
      <div class="stat"><strong>${t.pageLoadsToday ?? 0}</strong>Page loads today</div>
      <div class="stat"><strong>${t.uniqueVisitors ?? 0}</strong>Unique IPs</div>
      <div class="stat"><strong>${t.pageLoads ?? 0}</strong>Total page loads</div>
      <div class="stat"><strong>${t.errorsToday ?? 0}</strong>Errors today</div>
      <div class="stat"><strong>${t.errors ?? 0}</strong>Total errors</div>
    </div>
    <div class="panel" style="margin-top:1.5rem">
      <h3>Admin tools</h3>
      <p style="display:flex;gap:0.5rem;flex-wrap:wrap;margin:0.75rem 0 0">
        <a href="/admin/database" data-link class="btn btn-primary">Browse database</a>
        <a href="/admin/errors" data-link class="btn btn-primary">Error logs</a>
        <a href="/admin/analytics" data-link class="btn btn-ghost">Traffic analytics</a>
        <a href="/admin/users" data-link class="btn btn-ghost">Users</a>
        <a href="/admin/reports" data-link class="btn btn-ghost">Reports</a>
      </p>
    </div>
    <div class="panel" style="margin-top:1.5rem">
      <h3>Top posts</h3>
      <ul>${(data.topPosts || [])
        .map((p) => `<li><a href="${postPath(p)}" data-link>${escapeHtml(p.title)}</a> — ${p.viewsCount} views</li>`)
        .join('') || '<li class="muted">None yet</li>'}</ul>
    </div>
    <div class="panel">
      <h3>Top paths (page loads)</h3>
      <ul>${(summary.topPaths || [])
        .map((p) => `<li><code>${escapeHtml(p.path)}</code> — ${p.count}</li>`)
        .join('') || '<li class="muted">No traffic yet</li>'}</ul>
    </div>
  `;
}

export async function renderAdminDrafts(root) {
  if (!requireAdmin(root)) return;
  const data = await api.get('/posts/admin/drafts');
  root.innerHTML = `
    ${adminNav('admin/drafts')}
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.75rem;margin:0.5rem 0 1.25rem">
      <h2 style="margin:0;font-family:var(--font-display)">Drafts</h2>
      <a href="/admin/posts/new" data-link class="btn btn-primary">Create post</a>
    </div>
    <div class="table-wrap panel">
      <table>
        <thead><tr><th>Title</th><th>Updated</th></tr></thead>
        <tbody>
          ${(data.posts || [])
            .map(
              (p) => `<tr>
              <td><a href="${postPath(p)}" data-link>${escapeHtml(p.title)}</a></td>
              <td>${formatDate(p.updatedAt)}</td>
            </tr>`
            )
            .join('') || '<tr><td colspan="2" class="muted">No drafts</td></tr>'}
        </tbody>
      </table>
    </div>
  `;
}

export async function renderAdminPostEditor(root, { id } = {}) {
  if (!requireAdmin(root)) return;
  let post = null;
  if (id) {
    try {
      const res = await api.get(`/posts/admin/${id}`);
      post = res.post;
    } catch {
      post = null;
    }
  }
  const slug = getQuery().slug;
  if (!post && slug) {
    const res = await api.get(`/posts/${encodeURIComponent(slug)}`);
    post = res.post;
  }

  const isEdit = Boolean(post?._id);
  const status = post?.status || 'published';
  const cancelHref = isEdit && post?.slug ? postPath(post) : '/admin/drafts';

  root.innerHTML = `
    ${adminNav(isEdit ? 'admin/posts/edit' : 'admin/posts/new')}
    <div class="panel">
      <h2>${isEdit ? 'Edit post' : 'Create post'}</h2>
      <form id="post-editor" class="form-stack" style="max-width:100%">
        <label>Title<input name="title" required value="${escapeHtml(post?.title || '')}" /></label>
        <label>Category<input name="category" required value="${escapeHtml(post?.category || '')}" /></label>
        <label>Hashtags <span class="hint">comma-separated; #tags in the body are added automatically</span>
          <input name="tags" value="${escapeHtml((post?.tags || []).map((t) => `#${String(t).replace(/^#/, '')}`).join(', '))}" placeholder="#linux, #homelab" /></label>
        <label>Excerpt<textarea name="excerpt">${escapeHtml(post?.excerpt || '')}</textarea></label>
        <label>Cover image URL
          <input id="cover-image-url" name="coverImage" value="${escapeHtml(post?.coverImage || '')}" placeholder="https://… or upload below" />
        </label>
        <div class="cover-upload">
          <input type="file" id="cover-file" accept="image/jpeg,image/png,image/webp,image/gif" />
          <button type="button" class="btn btn-ghost" id="cover-upload-btn">Upload cover</button>
          <span class="hint muted" id="cover-upload-status"></span>
        </div>
        <div id="cover-preview-wrap" ${post?.coverImage ? '' : 'hidden'}>
          <img id="cover-preview" class="cover-preview" src="${escapeHtml(post?.coverImage || '')}" alt="" />
        </div>
        <label>Body (Markdown)<textarea name="body" required style="min-height:220px">${escapeHtml(post?.body || '')}</textarea></label>
        <label>Status
          <select name="status">
            <option value="published" ${status === 'published' ? 'selected' : ''}>Published</option>
            <option value="draft" ${status === 'draft' ? 'selected' : ''}>Draft</option>
          </select>
        </label>
        <div style="display:flex;gap:0.5rem;flex-wrap:wrap">
          <button type="submit" class="btn btn-primary">Save</button>
          <a href="${cancelHref}" data-link class="btn btn-ghost">Cancel</a>
        </div>
      </form>
    </div>
  `;

  const coverInput = root.querySelector('#cover-image-url');
  const preview = root.querySelector('#cover-preview');
  const previewWrap = root.querySelector('#cover-preview-wrap');
  const syncPreview = () => {
    const url = coverInput.value.trim();
    if (url) {
      preview.src = url;
      previewWrap.hidden = false;
    } else {
      previewWrap.hidden = true;
      preview.removeAttribute('src');
    }
  };
  coverInput.addEventListener('change', syncPreview);
  coverInput.addEventListener('input', syncPreview);

  root.querySelector('#cover-upload-btn')?.addEventListener('click', async () => {
    const file = root.querySelector('#cover-file')?.files?.[0];
    const status = root.querySelector('#cover-upload-status');
    if (!file) {
      toast('Choose an image first', { error: true });
      return;
    }
    if (file.size > 2.5 * 1024 * 1024) {
      toast('Image must be under 2.5MB', { error: true });
      return;
    }
    status.textContent = 'Uploading…';
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const res = await api.post('/uploads', { dataUrl });
      coverInput.value = res.url;
      syncPreview();
      status.textContent = 'Uploaded';
      toast('Cover uploaded');
    } catch (err) {
      status.textContent = '';
      toast(err.message, { error: true });
    }
  });

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
        const res = await api.put(`/posts/${post._id}`, payload);
        toast('Post updated');
        const saved = res.post || { ...post, ...payload };
        navigate(postPath(saved));
      } else {
        const res = await api.post('/posts', payload);
        toast('Post created');
        if (res.post?.slug) navigate(postPath(res.post));
        else navigate('/admin/drafts');
      }
    } catch (err) {
      toast(err.message, { error: true });
    }
  });
}

export async function renderAdminNewsletter(root) {
  if (!requireAdmin(root)) return;
  const data = await api.get('/newsletter/subscribers').catch(() => ({ subscribers: [], total: 0 }));
  const verified = (data.subscribers || []).filter((s) => s.isVerified).length;

  root.innerHTML = `
    ${adminNav('admin/newsletter')}
    <div class="panel">
      <h2>Newsletter</h2>
      <p class="muted">${verified} verified · ${data.total ?? 0} active subscribers</p>
      <form id="newsletter-send" class="form-stack" style="max-width:100%;margin-top:1rem">
        <label>Subject<input name="subject" required maxlength="200" placeholder="This week on Swiftener" /></label>
        <label>Body (Markdown)
          <textarea name="body" required style="min-height:220px" placeholder="Write the email in Markdown…"></textarea>
        </label>
        <div style="display:flex;gap:0.5rem;flex-wrap:wrap">
          <button type="submit" class="btn btn-primary">Send to subscribers</button>
        </div>
      </form>
    </div>
  `;

  root.querySelector('#newsletter-send').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!window.confirm(`Send this newsletter to ${verified} verified subscribers?`)) return;
    const fd = new FormData(e.target);
    try {
      const res = await api.post('/newsletter/send', {
        subject: fd.get('subject'),
        body: fd.get('body'),
      });
      toast(res.message || 'Sent');
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
              <td>${userLink(u, u.name)}</td>
              <td>${userLink(u, u.email)}</td>
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
        <p class="muted">${userLink(r.reportedBy, r.reportedBy?.name || 'User')} · ${formatDate(r.createdAt)}</p>
        <p><strong>Reason:</strong> ${escapeHtml(r.reason)}</p>
        <blockquote>${
          comment?.user
            ? `${userLink(comment.user, comment.user.name || comment.user.email || 'User')}: `
            : ''
        }${escapeHtml(body)}</blockquote>
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

export async function renderAdminAnalytics(root) {
  if (!requireAdmin(root)) return;
  const q = getQuery();
  const params = new URLSearchParams();
  if (q.path) params.set('path', q.path);
  if (q.ip) params.set('ip', q.ip);
  if (q.page) params.set('page', q.page);
  params.set('limit', '50');
  const qs = params.toString();
  const data = await api.get(`/admin/analytics?${qs}`);
  const s = data.summary || {};
  const d = data.demographics || {};

  const chartCard = (id, title, subtitle = '') => `
    <div class="chart-card panel">
      <h3>${escapeHtml(title)}</h3>
      ${subtitle ? `<p class="muted chart-sub">${escapeHtml(subtitle)}</p>` : ''}
      <div class="chart-wrap"><canvas id="${id}" aria-label="${escapeHtml(title)}"></canvas></div>
    </div>`;

  root.innerHTML = `
    ${adminNav('admin/analytics')}
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.75rem;margin:0.5rem 0 1.25rem">
      <h2 style="margin:0;font-family:var(--font-display)">Analytics</h2>
    </div>
    <div class="stats-grid">
      <div class="stat"><strong>${s.today ?? 0}</strong>Today</div>
      <div class="stat"><strong>${s.total ?? 0}</strong>Total loads</div>
      <div class="stat"><strong>${s.uniqueIps ?? 0}</strong>Unique IPs</div>
    </div>
    <form class="filters" id="analytics-filters">
      <input type="text" name="path" placeholder="Filter path" value="${escapeHtml(q.path || '')}" />
      <input type="text" name="ip" placeholder="Filter IP" value="${escapeHtml(q.ip || '')}" />
      <button type="submit" class="btn btn-primary">Filter</button>
    </form>

    <section class="demo-section">
      <h2 class="section-title">Viewer demographics</h2>
      <p class="muted">Country/city from IP geo lookup, plus client fingerprint, traffic, bots, and login methods.</p>
      <div class="chart-grid">
        ${chartCard('chart-traffic', 'Traffic (30 days)', 'Page loads over time')}
        ${chartCard('chart-country', 'Country', 'From IP geolocation')}
        ${chartCard('chart-city', 'City', 'From IP geolocation')}
        ${chartCard('chart-pages', 'Top pages', 'Most viewed paths')}
        ${chartCard('chart-ips', 'Top IP addresses', 'Highest traffic sources')}
        ${chartCard('chart-bot', 'Bots vs humans', 'User-agent classification')}
        ${chartCard('chart-login', 'Login method (visits)', 'Guest / Google / GitHub / Password')}
        ${chartCard('chart-accounts', 'Login method (accounts)', 'Registered users by auth provider')}
        ${chartCard('chart-platform', 'Platform', 'navigator.platform — e.g. Linux x86_64')}
        ${chartCard('chart-language', 'Language', 'navigator.language — e.g. en-US')}
        ${chartCard('chart-timezone', 'Timezone', 'Intl timezone — e.g. Africa/Nairobi')}
        ${chartCard('chart-screen', 'Screen resolution', 'screen width×height — e.g. 1366×768')}
        ${chartCard('chart-viewport', 'Viewport', 'Browser window size')}
        ${chartCard('chart-device', 'Device class', 'From screen width')}
        ${chartCard('chart-browser', 'Browser', 'Parsed from user-agent')}
        ${chartCard('chart-os', 'OS', 'From platform + user-agent')}
        ${chartCard('chart-ua', 'User-agent', 'Full Mozilla string (truncated)')}
        ${chartCard('chart-auth', 'Auth state', 'Guest vs signed in')}
        ${chartCard('chart-referrer', 'Referrers', 'Top sources')}
        ${chartCard('chart-hour', 'Hour of day (UTC)', 'When viewers hit the site')}
      </div>
      <div class="panel" style="margin-top:1rem">
        <h3>Client profiles</h3>
        <p class="muted">Exact <code>platform · language · timezone · screen</code> combinations</p>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Profile</th><th>Loads</th></tr></thead>
            <tbody>
              ${(d.byClientProfile || [])
                .map(
                  (row) => `<tr>
                  <td><code>${escapeHtml(row.label)}</code></td>
                  <td>${row.count}</td>
                </tr>`
                )
                .join('') || '<tr><td colspan="2" class="muted">No profiles yet</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <div class="panel">
      <h3>Quick lists</h3>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:1rem">
        <div>
          <h4>Top pages</h4>
          <ul>${(d.byPath || s.topPaths || []).map((p) => `<li><code>${escapeHtml(p.label || p.path)}</code> — ${p.count}</li>`).join('') || '<li class="muted">None</li>'}</ul>
        </div>
        <div>
          <h4>Top IPs</h4>
          <ul>${(d.byIp || s.topIps || []).map((p) => `<li><code>${escapeHtml(p.label || p.ip)}</code> — ${p.count}</li>`).join('') || '<li class="muted">None</li>'}</ul>
        </div>
        <div>
          <h4>Countries</h4>
          <ul>${(d.byCountry || []).map((p) => `<li>${escapeHtml(p.label)} — ${p.count}</li>`).join('') || '<li class="muted">None</li>'}</ul>
        </div>
      </div>
    </div>
    <div class="table-wrap panel">
      <h3>Recent page loads</h3>
      <table>
        <thead>
          <tr>
            <th>When</th>
            <th>Path</th>
            <th>Location</th>
            <th>IP</th>
            <th>User</th>
            <th>Client</th>
            <th>Referrer</th>
          </tr>
        </thead>
        <tbody>
          ${(data.loads || [])
            .map((row) => {
              const userCell =
                row.user && typeof row.user === 'object' && row.user._id
                  ? userLink(row.user, row.user.email || row.user.name)
                  : escapeHtml(row.user?.email || row.user?.name || '—');
              const screen =
                row.screenWidth && row.screenHeight ? `${row.screenWidth}×${row.screenHeight}` : '';
              const clientBits = [row.platform, row.language, row.timezone, screen].filter(Boolean).join(' · ');
              const place = [row.city, row.country].filter(Boolean).join(', ') || '—';
              const botBadge = row.isBot ? ' <span class="muted">(bot)</span>' : '';
              return `<tr>
                <td>${escapeHtml(row.createdAt ? new Date(row.createdAt).toLocaleString() : '')}</td>
                <td><code>${escapeHtml(row.path)}</code>${row.queryString ? `<br><span class="muted">${escapeHtml(row.queryString)}</span>` : ''}</td>
                <td>${escapeHtml(place)}${botBadge}</td>
                <td><code>${escapeHtml(row.ip)}</code></td>
                <td>${userCell}</td>
                <td class="muted" style="max-width:280px;font-size:0.8rem">
                  ${escapeHtml(clientBits)}
                  ${row.userAgent ? `<details><summary class="muted">user-agent</summary><pre style="white-space:pre-wrap;font-size:0.75rem;max-height:120px;overflow:auto">${escapeHtml(row.userAgent)}</pre></details>` : ''}
                </td>
                <td class="muted" style="max-width:160px;font-size:0.8rem">${escapeHtml((row.referrer || '—').slice(0, 80))}</td>
              </tr>`;
            })
            .join('') || '<tr><td colspan="7" class="muted">No page loads recorded yet.</td></tr>'}
        </tbody>
      </table>
      <p class="muted">Page ${data.page} of ${data.pages} (${data.total} total)</p>
    </div>
  `;

  root.querySelector('#analytics-filters')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const next = new URLSearchParams();
    const path = fd.get('path')?.toString().trim();
    const ip = fd.get('ip')?.toString().trim();
    if (path) next.set('path', path);
    if (ip) next.set('ip', ip);
    navigate(`/admin/analytics${next.toString() ? `?${next}` : ''}`);
  });

  try {
    await loadChartJs();
    const specs = [
      { id: 'chart-traffic', type: 'line', rows: d.byDay, label: 'Loads' },
      { id: 'chart-country', type: 'bar', rows: d.byCountry, horizontal: true },
      { id: 'chart-city', type: 'bar', rows: d.byCity, horizontal: true },
      { id: 'chart-pages', type: 'bar', rows: d.byPath, horizontal: true },
      { id: 'chart-ips', type: 'bar', rows: d.byIp, horizontal: true },
      { id: 'chart-bot', type: 'doughnut', rows: d.byBot },
      { id: 'chart-login', type: 'doughnut', rows: d.byLoginMethod },
      { id: 'chart-accounts', type: 'doughnut', rows: d.byAccountLoginMethod },
      { id: 'chart-platform', type: 'bar', rows: d.byPlatform },
      { id: 'chart-language', type: 'doughnut', rows: d.byLanguage },
      { id: 'chart-timezone', type: 'bar', rows: d.byTimezone, horizontal: true },
      { id: 'chart-screen', type: 'bar', rows: d.byScreen },
      { id: 'chart-viewport', type: 'bar', rows: d.byViewport },
      { id: 'chart-device', type: 'doughnut', rows: d.byDevice },
      { id: 'chart-browser', type: 'doughnut', rows: d.byBrowser },
      { id: 'chart-os', type: 'doughnut', rows: d.byOs },
      { id: 'chart-ua', type: 'bar', rows: d.byUserAgent, horizontal: true },
      { id: 'chart-auth', type: 'doughnut', rows: d.byAuth },
      { id: 'chart-referrer', type: 'bar', rows: d.byReferrer, horizontal: true },
      { id: 'chart-hour', type: 'bar', rows: d.byHour, label: 'Loads' },
    ];
    for (const spec of specs) {
      const canvas = root.querySelector(`#${spec.id}`);
      const { labels, values } = seriesFromRows(spec.rows);
      if (!canvas) continue;
      if (!labels.length) {
        canvas.parentElement.innerHTML = '<p class="muted">No data yet</p>';
        continue;
      }
      renderChart(canvas, {
        type: spec.type,
        labels,
        values,
        label: spec.label || 'Views',
        horizontal: Boolean(spec.horizontal),
      });
    }
  } catch {
    const section = root.querySelector('.demo-section');
    if (section) {
      const note = document.createElement('p');
      note.className = 'muted';
      note.textContent = 'Charts could not be loaded. Check network access to the Chart.js CDN.';
      section.appendChild(note);
    }
  }
}

export async function renderAdminErrors(root) {
  if (!requireAdmin(root)) return;
  const q = getQuery();
  const params = new URLSearchParams();
  if (q.source) params.set('source', q.source);
  if (q.path) params.set('path', q.path);
  if (q.q) params.set('q', q.q);
  if (q.page) params.set('page', q.page);
  params.set('limit', '50');
  const data = await api.get(`/admin/errors?${params}`);
  const s = data.summary || {};

  root.innerHTML = `
    ${adminNav('admin/errors')}
    <div class="stats-grid">
      <div class="stat"><strong>${s.today ?? 0}</strong>Today</div>
      <div class="stat"><strong>${s.total ?? 0}</strong>Total errors</div>
      ${(s.bySource || [])
        .map((row) => `<div class="stat"><strong>${row.count}</strong>${escapeHtml(row.source)}</div>`)
        .join('')}
    </div>
    <form class="filters" id="error-filters">
      <select name="source">
        <option value="">All sources</option>
        <option value="server" ${q.source === 'server' ? 'selected' : ''}>Server</option>
        <option value="client" ${q.source === 'client' ? 'selected' : ''}>Client</option>
      </select>
      <input type="text" name="path" placeholder="Filter path" value="${escapeHtml(q.path || '')}" />
      <input type="search" name="q" placeholder="Search message" value="${escapeHtml(q.q || '')}" />
      <button type="submit" class="btn btn-primary">Filter</button>
    </form>
    <div class="panel">
      <h3>Top messages</h3>
      <ul>${(s.topMessages || [])
        .map((m) => `<li>${escapeHtml((m.message || '').slice(0, 120))} — ${m.count}</li>`)
        .join('') || '<li class="muted">None</li>'}</ul>
      <h3>Top paths</h3>
      <ul>${(s.topPaths || [])
        .map((p) => `<li><code>${escapeHtml(p.path)}</code> — ${p.count}</li>`)
        .join('') || '<li class="muted">None</li>'}</ul>
      <h3>Last 14 days</h3>
      <ul>${(s.byDay || [])
        .map((d) => `<li>${escapeHtml(d.day)} — ${d.count}</li>`)
        .join('') || '<li class="muted">None</li>'}</ul>
    </div>
    <div class="table-wrap panel">
      <h3>Error log</h3>
      <table>
        <thead>
          <tr>
            <th>When</th>
            <th>Source</th>
            <th>Status</th>
            <th>Message</th>
            <th>Path</th>
            <th>IP / User</th>
          </tr>
        </thead>
        <tbody>
          ${(data.errors || [])
            .map((row) => {
              const userCell =
                row.user && typeof row.user === 'object' && row.user._id
                  ? userLink(row.user, row.user.email || row.user.name)
                  : escapeHtml(row.user?.email || row.user?.name || '—');
              return `<tr>
                <td>${escapeHtml(row.createdAt ? new Date(row.createdAt).toLocaleString() : '')}</td>
                <td>${escapeHtml(row.source)}</td>
                <td>${row.statusCode != null ? row.statusCode : '—'}</td>
                <td style="max-width:280px">
                  <strong>${escapeHtml((row.message || '').slice(0, 160))}</strong>
                  ${row.stack ? `<details><summary class="muted">stack</summary><pre style="white-space:pre-wrap;font-size:0.75rem;max-height:160px;overflow:auto">${escapeHtml(row.stack.slice(0, 2000))}</pre></details>` : ''}
                </td>
                <td><code>${escapeHtml(row.method || '')} ${escapeHtml(row.path || '')}</code></td>
                <td><code>${escapeHtml(row.ip || '')}</code><br><span class="muted">${userCell}</span></td>
              </tr>`;
            })
            .join('') || '<tr><td colspan="6" class="muted">No errors logged yet.</td></tr>'}
        </tbody>
      </table>
      <p class="muted">Page ${data.page} of ${data.pages} (${data.total} total)</p>
    </div>
  `;

  root.querySelector('#error-filters')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const next = new URLSearchParams();
    const source = fd.get('source')?.toString().trim();
    const path = fd.get('path')?.toString().trim();
    const search = fd.get('q')?.toString().trim();
    if (source) next.set('source', source);
    if (path) next.set('path', path);
    if (search) next.set('q', search);
    navigate(`/admin/errors${next.toString() ? `?${next}` : ''}`);
  });
}

export async function renderAdminDatabase(root) {
  if (!requireAdmin(root)) return;
  const q = getQuery();
  const tableName = q.table || '';

  if (!tableName) {
    const data = await api.get('/admin/db/tables');
    root.innerHTML = `
      ${adminNav('admin/database')}
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.75rem;margin:0.5rem 0 1.25rem">
        <h2 style="margin:0;font-family:var(--font-display)">Database</h2>
        <a href="/admin/errors" data-link class="btn btn-ghost">Error logs</a>
      </div>
      <p class="muted">All SQLite tables (admin only). Sensitive columns are redacted.</p>
      <div class="table-wrap panel">
        <table>
          <thead><tr><th>Table</th><th>Rows</th><th>Columns</th><th></th></tr></thead>
          <tbody>
            ${(data.tables || [])
              .map(
                (t) => `<tr>
                <td><code>${escapeHtml(t.name)}</code></td>
                <td>${t.rowCount}</td>
                <td class="muted">${escapeHtml((t.columns || []).map((c) => c.name).join(', '))}</td>
                <td><a href="/admin/database?table=${encodeURIComponent(t.name)}" data-link class="btn btn-ghost">Open</a></td>
              </tr>`
              )
              .join('') || '<tr><td colspan="4" class="muted">No tables</td></tr>'}
          </tbody>
        </table>
      </div>
    `;
    return;
  }

  const params = new URLSearchParams();
  params.set('limit', '50');
  if (q.page) params.set('page', q.page);
  if (q.q) params.set('q', q.q);
  const data = await api.get(`/admin/db/tables/${encodeURIComponent(tableName)}?${params}`);
  const columns = data.columns || [];

  root.innerHTML = `
    ${adminNav('admin/database')}
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.75rem;margin:0.5rem 0 1.25rem">
      <h2 style="margin:0;font-family:var(--font-display)"><code>${escapeHtml(tableName)}</code></h2>
      <a href="/admin/database" data-link class="btn btn-ghost">All tables</a>
    </div>
    <p class="muted">${data.total} matching / ${data.totalAll} total rows · page ${data.page} of ${data.pages}</p>
    <form class="filters" id="db-table-filters">
      <input type="search" name="q" placeholder="Search text columns" value="${escapeHtml(q.q || '')}" />
      <button type="submit" class="btn btn-primary">Search</button>
    </form>
    <div class="table-wrap panel" style="overflow-x:auto">
      <table>
        <thead>
          <tr>${columns.map((c) => `<th>${escapeHtml(c)}</th>`).join('')}</tr>
        </thead>
        <tbody>
          ${(data.rows || [])
            .map(
              (row) =>
                `<tr>${columns.map((c) => `<td style="max-width:240px;vertical-align:top">${cellValue(row[c])}</td>`).join('')}</tr>`
            )
            .join('') || `<tr><td colspan="${Math.max(columns.length, 1)}" class="muted">No rows</td></tr>`}
        </tbody>
      </table>
    </div>
    <p style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-top:1rem">
      ${
        data.page > 1
          ? `<a href="/admin/database?table=${encodeURIComponent(tableName)}&page=${data.page - 1}${q.q ? `&q=${encodeURIComponent(q.q)}` : ''}" data-link class="btn btn-ghost">Previous</a>`
          : ''
      }
      ${
        data.page < data.pages
          ? `<a href="/admin/database?table=${encodeURIComponent(tableName)}&page=${data.page + 1}${q.q ? `&q=${encodeURIComponent(q.q)}` : ''}" data-link class="btn btn-ghost">Next</a>`
          : ''
      }
    </p>
  `;

  root.querySelector('#db-table-filters')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const search = fd.get('q')?.toString().trim();
    const next = new URLSearchParams();
    next.set('table', tableName);
    if (search) next.set('q', search);
    navigate(`/admin/database?${next}`);
  });
}

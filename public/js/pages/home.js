import { api } from '../api.js';
import { escapeHtml, formatDate, getQuery, setQuery, toast, userLink } from '../ui.js';
import { getUser } from '../state.js';

export async function renderHome(root) {
  const q = getQuery();
  const params = new URLSearchParams();
  if (q.q) params.set('q', q.q);
  if (q.category) params.set('category', q.category);
  if (q.tag) params.set('tag', q.tag);
  if (q.page) params.set('page', q.page);
  const qs = params.toString();
  const data = await api.get(`/posts${qs ? `?${qs}` : ''}`);
  const isAdmin = getUser()?.role === 'admin';

  root.innerHTML = `
    <section class="hero">
      <h1 class="hero-brand">Swiftener</h1>
      <p class="hero-lead">Ideas, sharpened — long-form writing, thoughtful comments, and clean editorial design.</p>
    </section>
    <form class="filters" id="home-filters">
      <input id="search" type="search" name="q" placeholder="Search posts…" value="${escapeHtml(q.q || '')}" />
      <input id="categories" type="text" name="category" placeholder="Category" value="${escapeHtml(q.category || '')}" />
      <input type="text" name="tag" placeholder="Tag" value="${escapeHtml(q.tag || '')}" />
      <button type="submit" class="btn btn-primary">Filter</button>
    </form>
    <div class="card-grid" id="post-grid"></div>
    <div class="pagination" id="pagination"></div>
  `;

  const grid = root.querySelector('#post-grid');
  if (!data.posts?.length) {
    grid.innerHTML = '<p class="empty">No published posts yet.</p>';
  } else {
    grid.innerHTML = data.posts
      .map((post, i) => {
        const authorLabel = post.author?.name || 'Author';
        const tags = (post.tags || [])
          .map((t) => `<span class="tag">${escapeHtml(t)}</span>`)
          .join('');
        return `
          <article class="post-card" style="--i:${i}" data-post-id="${post._id}">
            <div class="post-card-top">
              <p class="post-meta">${escapeHtml(post.category)} · ${formatDate(post.publishedAt)} · ${userLink(post.author, authorLabel)}</p>
              ${
                isAdmin
                  ? `<div class="content-actions">
                      <a href="/admin/posts/edit/${post._id}" data-link class="icon-btn" title="Edit post">Edit</a>
                      <button type="button" class="icon-btn icon-btn-danger" data-delete-post="${post._id}" title="Delete post">Delete</button>
                    </div>`
                  : ''
              }
            </div>
            <h2><a href="/posts/${escapeHtml(post.slug)}" data-link>${escapeHtml(post.title)}</a></h2>
            <p>${escapeHtml(post.excerpt || '')}</p>
            <div>${tags}</div>
          </article>
        `;
      })
      .join('');

    if (isAdmin) {
      grid.querySelectorAll('[data-delete-post]').forEach((btn) => {
        btn.addEventListener('click', async (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!window.confirm('Delete this post permanently?')) return;
          try {
            await api.delete(`/posts/${btn.dataset.deletePost}`);
            toast('Post deleted');
            btn.closest('.post-card')?.remove();
            if (!grid.querySelector('.post-card')) {
              grid.innerHTML = '<p class="empty">No published posts yet.</p>';
            }
          } catch (err) {
            toast(err.message, { error: true });
          }
        });
      });
    }
  }

  const pag = root.querySelector('#pagination');
  if (data.pages > 1) {
    const page = Number(data.page || 1);
    pag.innerHTML = `
      <p class="muted">Page ${page} of ${data.pages} (${data.total} posts)</p>
      <div style="display:flex;gap:0.5rem;margin-top:0.5rem">
        ${page > 1 ? `<a class="btn btn-ghost" href="/?page=${page - 1}${q.q ? `&q=${encodeURIComponent(q.q)}` : ''}" data-link>Previous</a>` : ''}
        ${page < data.pages ? `<a class="btn btn-ghost" href="/?page=${page + 1}${q.q ? `&q=${encodeURIComponent(q.q)}` : ''}" data-link>Next</a>` : ''}
      </div>
    `;
  }

  root.querySelector('#home-filters').addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    setQuery({
      q: fd.get('q')?.toString().trim() || null,
      category: fd.get('category')?.toString().trim() || null,
      tag: fd.get('tag')?.toString().trim() || null,
      page: null,
    });
    import('../router.js').then(({ renderCurrent }) => renderCurrent());
  });

  if (window.location.hash === '#search') {
    root.querySelector('#search')?.focus();
  } else if (window.location.hash === '#categories') {
    root.querySelector('#categories')?.focus();
  }
}

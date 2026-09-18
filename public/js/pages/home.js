import { api } from '../api.js';
import {
  escapeHtml,
  formatDate,
  getQuery,
  setQuery,
  userLink,
  postPath,
  renderTagLinks,
  highlightMatch,
} from '../ui.js';

function chip(label, href, active) {
  return `<a href="${href}" data-link class="filter-chip${active ? ' active' : ''}">${escapeHtml(label)}</a>`;
}

export async function renderHome(root) {
  const q = getQuery();
  const params = new URLSearchParams();
  if (q.q) params.set('q', q.q);
  if (q.category) params.set('category', q.category);
  if (q.tag) params.set('tag', q.tag);
  if (q.page) params.set('page', q.page);
  const qs = params.toString();

  const [data, facets] = await Promise.all([
    api.get(`/posts${qs ? `?${qs}` : ''}`),
    api.get('/posts/meta/facets').catch(() => ({ categories: [], tags: [] })),
  ]);

  const categoryChips = (facets.categories || [])
    .slice(0, 10)
    .map((c) => {
      const active = (q.category || '').toLowerCase() === String(c.label).toLowerCase();
      const href = active ? '/' : `/?category=${encodeURIComponent(c.label)}`;
      return chip(`${c.label} (${c.count})`, href, active);
    })
    .join('');

  const tagChips = (facets.tags || [])
    .slice(0, 16)
    .map((t) => {
      const active = (q.tag || '').toLowerCase() === String(t.label).toLowerCase();
      const href = active ? '/' : `/?tag=${encodeURIComponent(t.label)}`;
      return chip(`#${t.label} (${t.count})`, href, active);
    })
    .join('');

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
      ${q.q || q.category || q.tag ? `<a href="/" data-link class="btn btn-ghost">Clear</a>` : ''}
    </form>
    ${
      categoryChips || tagChips
        ? `<div class="filter-chips" aria-label="Popular filters">
            ${categoryChips}
            ${tagChips}
          </div>`
        : ''
    }
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
        const title = q.q ? highlightMatch(post.title, q.q) : escapeHtml(post.title);
        const excerpt = q.q ? highlightMatch(post.excerpt || '', q.q) : escapeHtml(post.excerpt || '');
        return `
          <article class="post-card" style="--i:${i}" data-post-id="${post._id}">
            ${
              post.coverImage
                ? `<a href="${postPath(post)}" data-link class="post-card-cover"><img src="${escapeHtml(post.coverImage)}" alt="" loading="lazy" /></a>`
                : ''
            }
            <p class="post-meta">${escapeHtml(post.category)} · ${formatDate(post.publishedAt)} · ${userLink(post.author, authorLabel)}</p>
            <h2><a href="${postPath(post)}" data-link>${title}</a></h2>
            <p>${excerpt}</p>
            <div class="tag-row">${renderTagLinks(post.tags)}</div>
          </article>
        `;
      })
      .join('');
  }

  const pag = root.querySelector('#pagination');
  if (data.pages > 1) {
    const page = Number(data.page || 1);
    const qp = new URLSearchParams();
    if (q.q) qp.set('q', q.q);
    if (q.category) qp.set('category', q.category);
    if (q.tag) qp.set('tag', q.tag);
    const base = qp.toString();
    pag.innerHTML = `
      <p class="muted">Page ${page} of ${data.pages} (${data.total} posts)</p>
      <div style="display:flex;gap:0.5rem;margin-top:0.5rem">
        ${page > 1 ? `<a class="btn btn-ghost" href="/?page=${page - 1}${base ? `&${base}` : ''}" data-link>Previous</a>` : ''}
        ${page < data.pages ? `<a class="btn btn-ghost" href="/?page=${page + 1}${base ? `&${base}` : ''}" data-link>Next</a>` : ''}
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

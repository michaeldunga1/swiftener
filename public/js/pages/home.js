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
import { setPageSeo } from '../seo.js';

function chip(label, href, active, extraClass = '') {
  const cls = `filter-chip${active ? ' active' : ''}${extraClass ? ` ${extraClass}` : ''}`;
  return `<a href="${href}" data-link class="${cls}"${active ? ' aria-current="true"' : ''}>${escapeHtml(label)}</a>`;
}

export async function renderHome(root) {
  const q = getQuery();
  const params = new URLSearchParams();
  if (q.q) params.set('q', q.q);
  if (q.category) params.set('category', q.category);
  if (q.tag) params.set('tag', q.tag);
  if (q.page) params.set('page', q.page);
  const qs = params.toString();
  const hasFilters = Boolean(q.q || q.category || q.tag);

  const [data, facets] = await Promise.all([
    api.get(`/posts${qs ? `?${qs}` : ''}`),
    api.get('/posts/meta/facets').catch(() => ({ categories: [], tags: [] })),
  ]);

  const descParts = [
    'Clear, practical How-to guides on useful IT topics for beginners and intermediate readers.',
  ];
  if (q.q) descParts.unshift(`Search results for “${q.q}”.`);
  if (q.category) descParts.unshift(`Guides in ${q.category}.`);
  if (q.tag) descParts.unshift(`Guides tagged ${q.tag}.`);
  setPageSeo({
    title: q.q ? `Search: ${q.q}` : q.tag ? `#${q.tag}` : q.category ? q.category : 'Swiftener — practical How-to IT guides',
    description: descParts.join(' '),
    path: window.location.pathname + window.location.search,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'Swiftener',
      url: window.__SWIFTENER__?.siteUrl || window.location.origin,
    },
  });

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
      <p class="hero-lead">Clear, practical How-to guides on useful IT topics — for beginners and intermediate readers.</p>
    </section>
    <form class="filters" id="home-filters" role="search">
      <div class="filters-search">
        <input id="search" type="search" name="q" placeholder="Search guides…" value="${escapeHtml(q.q || '')}" autocomplete="off" aria-label="Search guides" />
        <button type="submit" class="btn btn-primary">Search</button>
      </div>
      <div class="filters-secondary">
        <input id="categories" type="text" name="category" placeholder="Category" value="${escapeHtml(q.category || '')}" aria-label="Category" />
        <input type="text" name="tag" placeholder="Tag" value="${escapeHtml(q.tag || '')}" aria-label="Tag" />
        <div class="filters-actions">
          ${hasFilters ? `<a href="/" data-link class="btn btn-ghost">Clear filters</a>` : ''}
        </div>
      </div>
    </form>
    ${
      categoryChips || tagChips
        ? `<div class="filter-chips" aria-label="Popular filters">
            <span class="filter-chips-label">Browse</span>
            ${categoryChips}
            ${tagChips}
            ${hasFilters ? chip('Clear all', '/', false, 'filter-chip-clear') : ''}
          </div>`
        : ''
    }
    <div class="card-grid" id="post-grid"></div>
    <div class="pagination" id="pagination"></div>
  `;

  const grid = root.querySelector('#post-grid');
  if (!data.posts?.length) {
    grid.innerHTML = `
      <div class="empty" role="status">
        <p class="empty-title">${hasFilters ? 'No matching guides' : 'No published posts yet'}</p>
        <p class="empty-hint">${
          hasFilters
            ? 'Try a broader search, or <a href="/" data-link>clear filters</a>.'
            : 'New How-to guides will show up here when published.'
        }</p>
      </div>`;
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
            <p class="post-meta"><span>${escapeHtml(post.category)}</span><span class="meta-sep" aria-hidden="true">·</span><time datetime="${escapeHtml(post.publishedAt || '')}">${formatDate(post.publishedAt)}</time><span class="meta-sep" aria-hidden="true">·</span>${userLink(post.author, authorLabel)}</p>
            <h2><a href="${postPath(post)}" data-link>${title}</a></h2>
            <p class="post-card-excerpt">${excerpt}</p>
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
      <p class="muted">Page ${page} of ${data.pages} · ${data.total} posts</p>
      <div class="pagination-nav">
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

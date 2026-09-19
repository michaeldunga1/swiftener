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
  metaLine,
  tagFilterHref,
} from '../ui.js';
import { setPageSeo } from '../seo.js';
import { getUser } from '../state.js';
import { navigate } from '../router.js';

function chip(label, href, active, extraClass = '') {
  const cls = `filter-chip${active ? ' active' : ''}${extraClass ? ` ${extraClass}` : ''}`;
  return `<a href="${href}" data-link class="${cls}"${active ? ' aria-current="true"' : ''}>${escapeHtml(label)}</a>`;
}

export async function renderHome(root) {
  const q = getQuery();
  // Prefer dedicated hashtag URLs when filtering by tag alone.
  if (q.tag && !q.q && !q.category && !q.page) {
    await navigate(tagFilterHref(q.tag), { replace: true });
    return;
  }
  const params = new URLSearchParams();
  if (q.q) params.set('q', q.q);
  if (q.category) params.set('category', q.category);
  if (q.tag) params.set('tag', q.tag);
  if (q.page) params.set('page', q.page);
  const qs = params.toString();
  const hasFilters = Boolean(q.q || q.category || q.tag);

  const [data, facets, popular] = await Promise.all([
    api.get(`/posts${qs ? `?${qs}` : ''}`),
    api.get('/posts/meta/facets').catch(() => ({ categories: [], tags: [] })),
    api.get('/posts/meta/popular?limit=8').catch(() => ({
      categories: [],
      tags: [],
      hashtags: [],
      guides: [],
      pages: [],
    })),
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
      const href = active ? '/' : tagFilterHref(t.label);
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
        <input type="text" name="tag" placeholder="Hashtag" value="${escapeHtml(q.tag || '')}" aria-label="Hashtag" />
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
    <section class="popular-section" id="popular-section" aria-label="Popular on Swiftener"></section>
  `;

  const isAdmin = getUser()?.role === 'admin';
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
        const dateHtml =
          isAdmin && post.publishedAt
            ? `<time datetime="${escapeHtml(post.publishedAt)}">${formatDate(post.publishedAt)}</time>`
            : '';
        return `
          <article class="post-card" style="--i:${i}" data-post-id="${post._id}">
            ${
              post.coverImage
                ? `<a href="${postPath(post)}" data-link class="post-card-cover"><img src="${escapeHtml(post.coverImage)}" alt="" loading="lazy" /></a>`
                : ''
            }
            <p class="post-meta">${metaLine(
              post.category ? `<span>${escapeHtml(post.category)}</span>` : '',
              dateHtml,
              userLink(post.author, authorLabel)
            )}</p>
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

  renderPopularSection(root.querySelector('#popular-section'), popular);
}

function friendlyPageLabel(path, guides = []) {
  const p = String(path || '/');
  if (p === '/') return 'Home';
  if (p === '/about') return 'About';
  if (p === '/contact') return 'Contact';
  if (p === '/newsletter') return 'Newsletter';
  if (p === '/privacy') return 'Privacy Policy';
  if (p === '/terms') return 'Terms of Use';
  if (p.startsWith('/tags/')) return `#${decodeURIComponent(p.slice(6))}`;
  if (p.startsWith('/users/')) return `@${decodeURIComponent(p.slice(7))}`;
  if (p.startsWith('/posts/')) {
    const match = guides.find((g) => postPath(g) === p || p.endsWith(`/${g.slug}`));
    if (match?.title) return match.title;
    const slug = decodeURIComponent(p.split('/').pop() || '');
    return slug.replace(/-/g, ' ') || p;
  }
  return p;
}

function popularList(items, emptyText) {
  if (!items?.length) return `<p class="muted popular-empty">${escapeHtml(emptyText)}</p>`;
  return `<ul class="popular-list">${items.join('')}</ul>`;
}

function renderPopularSection(el, popular = {}) {
  if (!el) return;
  const categories = popular.categories || [];
  const tags = popular.tags || [];
  const hashtags = popular.hashtags || popular.tags || [];
  const pages = popular.pages || [];
  const guides = popular.guides || [];

  if (!categories.length && !tags.length && !hashtags.length && !pages.length && !guides.length) {
    el.innerHTML = '';
    return;
  }

  const categoryItems = categories.map(
    (c) =>
      `<li><a href="/?category=${encodeURIComponent(c.label)}" data-link><span>${escapeHtml(c.label)}</span><span class="popular-count">${c.count}</span></a></li>`
  );
  const tagItems = tags.map(
    (t) =>
      `<li><a href="${tagFilterHref(t.label)}" data-link><span>${escapeHtml(t.label)}</span><span class="popular-count">${t.count}</span></a></li>`
  );
  const hashtagItems = hashtags.map(
    (t) =>
      `<li><a href="${tagFilterHref(t.label)}" data-link><span>#${escapeHtml(t.label)}</span><span class="popular-count">${t.count}</span></a></li>`
  );
  const pageItems = pages.map((p) => {
    const href = p.path || '/';
    const label = friendlyPageLabel(href, guides);
    return `<li><a href="${escapeHtml(href)}" data-link><span>${escapeHtml(label)}</span><span class="popular-count">${p.count}</span></a></li>`;
  });
  // Prefer traffic pages; if none yet, fall back to top viewed guides as pages.
  const pageBlockItems =
    pageItems.length > 0
      ? pageItems
      : guides.map(
          (g) =>
            `<li><a href="${postPath(g)}" data-link><span>${escapeHtml(g.title)}</span><span class="popular-count">${g.viewsCount ?? 0}</span></a></li>`
        );

  el.innerHTML = `
    <div class="popular-header">
      <h2>Popular on Swiftener</h2>
      <p class="muted">Most used categories, tags, hashtags, and pages.</p>
    </div>
    <div class="popular-grid">
      <div class="popular-col">
        <h3>Categories</h3>
        ${popularList(categoryItems, 'No categories yet')}
      </div>
      <div class="popular-col">
        <h3>Tags</h3>
        ${popularList(tagItems, 'No tags yet')}
      </div>
      <div class="popular-col">
        <h3>Hashtags</h3>
        ${popularList(hashtagItems, 'No hashtags yet')}
      </div>
      <div class="popular-col">
        <h3>Pages</h3>
        ${popularList(pageBlockItems, 'No page traffic yet')}
      </div>
    </div>
  `;
}

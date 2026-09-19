import { api } from '../api.js';
import {
  escapeHtml,
  formatDate,
  userLink,
  postPath,
  renderTagLinks,
  metaLine,
  tagFilterHref,
} from '../ui.js';
import { getUser } from '../state.js';
import { setPageSeo } from '../seo.js';
import { navigate } from '../router.js';

function normalizeTagParam(raw) {
  return String(raw || '')
    .trim()
    .replace(/^#+/, '')
    .toLowerCase();
}

export async function renderTagPage(root, { tag: rawTag } = {}) {
  const tag = normalizeTagParam(decodeURIComponent(rawTag || ''));
  if (!tag) {
    await navigate('/', { replace: true });
    return;
  }

  const canonical = tagFilterHref(tag);
  if (window.location.pathname !== canonical) {
    await navigate(canonical, { replace: true });
    return;
  }

  const params = new URLSearchParams({ tag, limit: '24' });
  const data = await api.get(`/posts?${params}`);
  const isAdmin = getUser()?.role === 'admin';

  setPageSeo({
    title: `#${tag}`,
    description: `Guides tagged #${tag} on Swiftener.`,
    path: canonical,
  });

  root.innerHTML = `
    <section class="panel tag-page-header">
      <p class="muted profile-eyebrow">Hashtag</p>
      <h1 class="hero-brand">#${escapeHtml(tag)}</h1>
      <p class="muted">${data.total ?? 0} guide${(data.total ?? 0) === 1 ? '' : 's'}</p>
      <p class="tag-page-actions"><a href="/" data-link class="btn btn-ghost">All guides</a></p>
    </section>
    <div class="card-grid" id="tag-grid"></div>
  `;

  const grid = root.querySelector('#tag-grid');
  if (!data.posts?.length) {
    grid.innerHTML = `
      <div class="empty" role="status">
        <p class="empty-title">No guides with #${escapeHtml(tag)} yet</p>
        <p class="empty-hint"><a href="/" data-link>Browse all guides</a>.</p>
      </div>`;
    return;
  }

  grid.innerHTML = data.posts
    .map((post, i) => {
      const authorLabel = post.author?.name || 'Author';
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
          <h2><a href="${postPath(post)}" data-link>${escapeHtml(post.title)}</a></h2>
          <p class="post-card-excerpt">${escapeHtml(post.excerpt || '')}</p>
          <div class="tag-row">${renderTagLinks(post.tags)}</div>
        </article>`;
    })
    .join('');
}

import { api, ApiError } from '../api.js';
import {
  escapeHtml,
  formatDate,
  toast,
  userLink,
  postPath,
  renderTagLinks,
  tagSlug,
} from '../ui.js';
import { getUser } from '../state.js';
import { htmlForPostBody } from '../markdown.js';
import { navigate } from '../router.js';
import { setPageSeo, adSlotHtml, pushAds } from '../seo.js';

function commentUserId(comment) {
  if (comment?.user && typeof comment.user === 'object') return comment.user._id;
  return comment?.user;
}

function canManageComment(user, comment) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  return String(commentUserId(comment)) === String(user._id);
}

function expectedTag(post) {
  return tagSlug((post.tags && post.tags[0]) || post.category || 'general');
}

function ensureHeadingIds(root, toc = []) {
  const headings = [...root.querySelectorAll('h2, h3')];
  if (toc.length && toc.length === headings.length) {
    headings.forEach((el, i) => {
      el.id = toc[i].id;
    });
    return;
  }
  const used = new Map();
  headings.forEach((el) => {
    if (el.id) return;
    let id = tagSlug(el.textContent || 'section');
    const n = used.get(id) || 0;
    used.set(id, n + 1);
    if (n) id = `${id}-${n}`;
    el.id = id;
  });
}

function buildTocHtml(toc) {
  if (!toc?.length) return '';
  return `
    <nav class="post-toc panel" aria-label="Table of contents">
      <h2>On this page</h2>
      <ol>
        ${toc
          .map(
            (item) =>
              `<li class="toc-level-${item.level}"><a href="#${escapeHtml(item.id)}">${escapeHtml(item.text)}</a></li>`
          )
          .join('')}
      </ol>
    </nav>`;
}

function relatedHtml(related) {
  if (!related?.length) return '';
  return `
    <section class="related-posts panel">
      <h2>Related posts</h2>
      <div class="card-grid related-grid">
        ${related
          .map(
            (p) => `
          <article class="post-card">
            ${p.coverImage ? `<a href="${postPath(p)}" data-link class="post-card-cover"><img src="${escapeHtml(p.coverImage)}" alt="" loading="lazy" /></a>` : ''}
            <p class="post-meta">${escapeHtml(p.category || '')}</p>
            <h3><a href="${postPath(p)}" data-link>${escapeHtml(p.title)}</a></h3>
          </article>`
          )
          .join('')}
      </div>
    </section>`;
}

function initReadingProgress(articleRoot) {
  document.querySelectorAll('.reading-progress').forEach((el) => el.remove());
  const bar = document.createElement('div');
  bar.className = 'reading-progress';
  bar.setAttribute('aria-hidden', 'true');
  bar.innerHTML = '<div class="reading-progress-bar"></div>';
  document.body.appendChild(bar);
  const fill = bar.querySelector('.reading-progress-bar');

  const onScroll = () => {
    const rect = articleRoot.getBoundingClientRect();
    const total = Math.max(1, articleRoot.scrollHeight - window.innerHeight);
    const scrolled = Math.min(total, Math.max(0, -rect.top));
    fill.style.width = `${(scrolled / total) * 100}%`;
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  return () => {
    window.removeEventListener('scroll', onScroll);
    bar.remove();
  };
}

export async function renderPost(root, { slug, tag } = {}) {
  const data = await api.get(`/posts/${encodeURIComponent(slug)}`);
  const post = data.post;
  const viewer = data.viewerState || {};
  const reading = data.reading || { minutes: 1 };
  const toc = data.toc || [];
  const related = data.related || [];
  const user = getUser();
  const authorLabel = post.author?.name || 'Author';
  const isAdmin = user?.role === 'admin';
  const canonical = postPath(post);
  const wantTag = expectedTag(post);
  const haveTag = tag ? tagSlug(decodeURIComponent(tag)) : '';

  if (haveTag !== wantTag) {
    const hash = window.location.hash || '';
    await navigate(`${canonical}${hash}`, { replace: true });
    return;
  }

  const description = (post.excerpt || post.title || '').trim().slice(0, 160);
  setPageSeo({
    title: post.title,
    description: description || 'Read this article on Swiftener.',
    path: canonical,
    image: post.coverImage || '',
    type: 'article',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: post.title,
      description,
      image: post.coverImage || undefined,
      datePublished: post.publishedAt,
      dateModified: post.updatedAt,
      author: { '@type': 'Person', name: authorLabel },
      mainEntityOfPage: canonical,
    },
  });

  root.innerHTML = `
    <article class="post-layout" id="post-article" itemscope itemtype="https://schema.org/BlogPosting">
      <header class="article-header panel">
        <div class="article-header-top">
          <p class="post-meta">${escapeHtml(post.category)} · ${formatDate(post.publishedAt)} · ${userLink(post.author, authorLabel)} · ${reading.minutes} min read</p>
          ${
            isAdmin
              ? `<div class="content-actions">
                  <a href="/admin/posts/edit/${post._id}" data-link class="icon-btn" title="Edit post" aria-label="Edit post">Edit</a>
                  <button type="button" class="icon-btn icon-btn-danger" id="delete-post-btn" title="Delete post" aria-label="Delete post">Delete</button>
                </div>`
              : ''
          }
        </div>
        <h1 itemprop="headline">${escapeHtml(post.title)}</h1>
        ${post.coverImage ? `<img class="post-cover" src="${escapeHtml(post.coverImage)}" alt="${escapeHtml(post.title)}" itemprop="image" />` : ''}
        <div class="tag-row" style="margin:0.5rem 0 0.75rem">${renderTagLinks(post.tags)}</div>
        <p class="muted">${post.viewsCount ?? 0} views · ${post.likesCount ?? 0} likes · ${post.commentsCount ?? 0} comments</p>
        <div class="engagement-bar" id="engagement-bar">
          <button type="button" class="btn btn-ghost ${viewer.liked ? 'active' : ''}" data-action="like">Like</button>
          <button type="button" class="btn btn-ghost ${viewer.saved ? 'active' : ''}" data-action="save">Save</button>
          <button type="button" class="btn btn-ghost ${viewer.bookmarked ? 'active' : ''}" data-action="bookmark">Bookmark</button>
          <button type="button" class="btn btn-ghost" data-action="share">Share</button>
        </div>
      </header>
      ${adSlotHtml('auto')}
      <div class="post-main">
        ${buildTocHtml(toc)}
        <div class="panel article-body" id="article-body" itemprop="articleBody"><p class="muted">Loading…</p></div>
      </div>
      ${adSlotHtml('auto')}
      ${relatedHtml(related)}
      <section class="comments panel">
        <h2>Comments</h2>
        <div id="comment-list"></div>
        ${
          user
            ? `<form id="comment-form" class="form-stack" style="max-width:100%;margin-top:1rem">
            <label><span>Join the conversation</span>
              <textarea name="body" required maxlength="2000" placeholder="Write a comment…"></textarea>
            </label>
            <button type="submit" class="btn btn-primary">Post comment</button>
          </form>`
            : `<p class="muted"><a href="/login" data-link>Log in</a> to comment.</p>`
        }
      </section>
    </article>
  `;

  const bodyEl = root.querySelector('#article-body');
  try {
    bodyEl.innerHTML = await htmlForPostBody(post);
  } catch {
    bodyEl.textContent = post.body || '';
  }
  ensureHeadingIds(bodyEl, toc);
  requestAnimationFrame(() => {
    pushAds();
    pushAds();
  });

  const cleanupProgress = initReadingProgress(root.querySelector('#post-article'));
  root._cleanup = cleanupProgress;

  api.post(`/posts/${post._id}/view`).catch(() => {});

  root.querySelector('#delete-post-btn')?.addEventListener('click', async () => {
    if (!window.confirm('Delete this post permanently?')) return;
    try {
      await api.delete(`/posts/${post._id}`);
      toast('Post deleted');
      navigate('/');
    } catch (err) {
      toast(err.message, { error: true });
    }
  });

  const bar = root.querySelector('#engagement-bar');
  bar?.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    if (action === 'share') {
      try {
        const res = await api.post(`/posts/${post._id}/share`);
        if (res.shareLinks?.link) {
          await navigator.clipboard?.writeText(res.shareLinks.link);
          toast('Link copied to clipboard');
        }
      } catch (err) {
        toast(err.message, { error: true });
      }
      return;
    }
    if (!user) {
      toast('Log in to interact with posts', { error: true });
      return;
    }
    try {
      const res = await api.post(`/posts/${post._id}/${action}`);
      btn.classList.toggle('active', res.active);
      toast(res.active ? `${action} added` : `${action} removed`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        toast('Session expired — please log in again', { error: true });
        return;
      }
      toast(err.message, { error: true });
    }
  });

  await loadComments(root, post._id, user);

  root.querySelector('#comment-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = new FormData(e.target).get('body')?.toString().trim();
    if (!body) return;
    try {
      await api.post(`/comments/${post._id}`, { body });
      e.target.reset();
      toast('Comment posted');
      await loadComments(root, post._id, user);
    } catch (err) {
      toast(err.message, { error: true });
    }
  });
}

async function loadComments(root, postId, user) {
  const list = root.querySelector('#comment-list');
  const data = await api.get(`/comments/${postId}`);
  if (!data.comments?.length) {
    list.innerHTML = '<p class="muted">No comments yet.</p>';
    return;
  }

  list.innerHTML = data.comments
    .map((c) => {
      const name = c.user?.name || 'User';
      const manage = canManageComment(user, c);
      const showReport = Boolean(user && !manage);
      return `
        <div class="comment" id="comment-${c._id}" data-comment-id="${c._id}">
          <div class="comment-head-row">
            <div class="comment-head">${userLink(c.user, name)} · ${formatDate(c.createdAt)}</div>
            <div class="content-actions">
              ${
                manage
                  ? `<button type="button" class="icon-btn" data-edit-comment="${c._id}" title="Edit comment">Edit</button>
                     <button type="button" class="icon-btn icon-btn-danger" data-delete-comment="${c._id}" title="Delete comment">Delete</button>`
                  : ''
              }
              ${showReport ? `<button type="button" class="icon-btn" data-report="${c._id}" title="Report comment">Report</button>` : ''}
            </div>
          </div>
          <p class="comment-body" data-comment-body>${escapeHtml(c.body)}</p>
        </div>
      `;
    })
    .join('');

  list.querySelectorAll('[data-report]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const reason = window.prompt('Reason for report?');
      if (!reason?.trim()) return;
      try {
        await api.post(`/comments/${btn.dataset.report}/report`, { reason: reason.trim() });
        toast('Report submitted');
      } catch (err) {
        toast(err instanceof ApiError ? err.message : 'Report failed', { error: true });
      }
    });
  });

  list.querySelectorAll('[data-delete-comment]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!window.confirm('Delete this comment?')) return;
      try {
        await api.delete(`/comments/${btn.dataset.deleteComment}`);
        toast('Comment deleted');
        await loadComments(root, postId, user);
      } catch (err) {
        toast(err.message, { error: true });
      }
    });
  });

  list.querySelectorAll('[data-edit-comment]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const card = btn.closest('.comment');
      const bodyEl = card.querySelector('[data-comment-body]');
      if (!bodyEl || card.querySelector('.comment-edit-form')) return;
      const current = bodyEl.textContent || '';
      bodyEl.hidden = true;
      const form = document.createElement('form');
      form.className = 'comment-edit-form form-stack';
      form.innerHTML = `
        <textarea name="body" required maxlength="2000" rows="3">${escapeHtml(current)}</textarea>
        <div style="display:flex;gap:0.5rem;flex-wrap:wrap">
          <button type="submit" class="btn btn-primary">Save</button>
          <button type="button" class="btn btn-ghost" data-cancel-edit>Cancel</button>
        </div>
      `;
      bodyEl.after(form);
      form.querySelector('[data-cancel-edit]').addEventListener('click', () => {
        form.remove();
        bodyEl.hidden = false;
      });
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const next = new FormData(form).get('body')?.toString().trim();
        if (!next) return;
        try {
          await api.put(`/comments/${btn.dataset.editComment}`, { body: next });
          toast('Comment updated');
          await loadComments(root, postId, user);
        } catch (err) {
          toast(err.message, { error: true });
        }
      });
      form.querySelector('textarea')?.focus();
    });
  });
}

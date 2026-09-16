import { api, ApiError } from '../api.js';
import { escapeHtml, formatDate, toast } from '../ui.js';
import { getUser } from '../state.js';

export async function renderPost(root, { slug }) {
  const data = await api.get(`/posts/${encodeURIComponent(slug)}`);
  const post = data.post;
  const viewer = data.viewerState || {};
  const user = getUser();
  const author = post.author?.name || 'Author';

  root.innerHTML = `
    <article>
      <header class="article-header panel">
        <p class="post-meta">${escapeHtml(post.category)} · ${formatDate(post.publishedAt)} · ${escapeHtml(author)}</p>
        <h1>${escapeHtml(post.title)}</h1>
        <p class="muted">${post.viewsCount ?? 0} views · ${post.likesCount ?? 0} likes · ${post.commentsCount ?? 0} comments</p>
        <div class="engagement-bar" id="engagement-bar">
          <button type="button" class="btn btn-ghost ${viewer.liked ? 'active' : ''}" data-action="like">Like</button>
          <button type="button" class="btn btn-ghost ${viewer.saved ? 'active' : ''}" data-action="save">Save</button>
          <button type="button" class="btn btn-ghost ${viewer.bookmarked ? 'active' : ''}" data-action="bookmark">Bookmark</button>
          <button type="button" class="btn btn-ghost" data-action="share">Share</button>
        </div>
      </header>
      <div class="panel article-body">${post.renderedBody || escapeHtml(post.body)}</div>
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

  api.post(`/posts/${post._id}/view`).catch(() => {});

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
      return `
        <div class="comment" id="comment-${c._id}">
          <div class="comment-head">${escapeHtml(name)} · ${formatDate(c.createdAt)}</div>
          <p>${escapeHtml(c.body)}</p>
          ${
            user
              ? `<button type="button" class="btn btn-ghost" data-report="${c._id}">Report</button>`
              : ''
          }
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
}

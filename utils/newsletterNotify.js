const NewsletterSubscriber = require('../models/NewsletterSubscriber');
const { sendNewsletterBlast } = require('./email');
const { postPath } = require('./postPath');
const { escapeHtml, stripMarkdown, truncate } = require('./site');

/**
 * Email verified, active newsletter subscribers about a newly published post.
 * Intended to run in the background (do not await in request handlers unless needed).
 */
async function notifySubscribersOfNewPost(post) {
  if (!post || post.status !== 'published') {
    return { sent: 0, total: 0, skipped: true };
  }

  const recipients = NewsletterSubscriber.listVerifiedActive({ includeSecrets: true });
  if (!recipients.length) {
    return { sent: 0, total: 0 };
  }

  const base = String(process.env.FRONTEND_URL || '').replace(/\/+$/, '');
  const url = `${base}${postPath(post)}`;
  const title = escapeHtml(post.title || 'New guide');
  const excerptText = truncate(post.excerpt || stripMarkdown(post.body || ''), 220);
  const excerpt = excerptText ? `<p style="color:#444;line-height:1.5">${escapeHtml(excerptText)}</p>` : '';

  const subject = `New on Swiftener: ${post.title}`;
  const html = `
    <p>We just published a new How-to guide:</p>
    <h2 style="font-size:1.25rem;margin:0.75rem 0"><a href="${escapeHtml(url)}">${title}</a></h2>
    ${excerpt}
    <p><a href="${escapeHtml(url)}">Read the guide →</a></p>
  `;

  let sent = 0;
  for (const sub of recipients) {
    try {
      const unsubscribeUrl = `${base}/newsletter/unsubscribe?token=${encodeURIComponent(sub.unsubscribeToken || '')}`;
      await sendNewsletterBlast(sub.email, { subject, html, unsubscribeUrl });
      sent += 1;
    } catch (err) {
      console.error('[newsletter] new post notify failed', sub.email, err.message);
    }
  }

  console.log(`[newsletter] new post “${post.title}”: sent ${sent}/${recipients.length}`);
  return { sent, total: recipients.length };
}

function notifySubscribersOfNewPostAsync(post) {
  notifySubscribersOfNewPost(post).catch((err) =>
    console.error('[newsletter] new post notify failed', err.message)
  );
}

module.exports = {
  notifySubscribersOfNewPost,
  notifySubscribersOfNewPostAsync,
};

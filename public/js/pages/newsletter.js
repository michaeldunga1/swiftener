import { api } from '../api.js';
import { escapeHtml, getQuery, toast } from '../ui.js';

export async function renderNewsletter(root) {
  root.innerHTML = `
    <div class="panel" style="max-width:520px;margin-inline:auto">
      <h2>Swiftener newsletter</h2>
      <p class="muted">Occasional new cheat sheets and guide updates — no noise. Confirm via email after subscribing.</p>
      <form id="newsletter-form" class="form-stack">
        <label>Email<input type="email" name="email" required /></label>
        <button type="submit" class="btn btn-primary">Subscribe</button>
      </form>
    </div>
  `;
  root.querySelector('#newsletter-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = new FormData(e.target).get('email');
    try {
      await api.post('/newsletter/subscribe', { email });
      toast('Check your inbox to confirm');
      e.target.reset();
    } catch (err) {
      toast(err.message, { error: true });
    }
  });
}

export async function renderNewsletterVerify(root) {
  const token = getQuery().token;
  root.innerHTML = '<div class="panel"><p class="muted">Verifying…</p></div>';
  try {
    await api.get(`/newsletter/verify?token=${encodeURIComponent(token || '')}`);
    root.innerHTML = '<div class="panel"><h2>Subscription confirmed</h2><p><a href="/" data-link>Back home</a></p></div>';
  } catch (err) {
    root.innerHTML = `<div class="panel"><h2>Verification failed</h2><p>${escapeHtml(err.message)}</p></div>`;
  }
}

export async function renderNewsletterUnsubscribe(root) {
  const token = getQuery().token;
  root.innerHTML = '<div class="panel"><p class="muted">Processing…</p></div>';
  try {
    await api.get(`/newsletter/unsubscribe?token=${encodeURIComponent(token || '')}`);
    root.innerHTML = '<div class="panel"><h2>Unsubscribed</h2><p>You will no longer receive emails.</p></div>';
  } catch (err) {
    root.innerHTML = `<div class="panel"><h2>Could not unsubscribe</h2><p>${escapeHtml(err.message)}</p></div>`;
  }
}

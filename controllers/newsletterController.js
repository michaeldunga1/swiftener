const crypto = require('crypto');
const NewsletterSubscriber = require('../models/NewsletterSubscriber');
const { sendNewsletterVerifyEmail, sendNewsletterBlast } = require('../utils/email');
const { renderMarkdown } = require('../utils/markdown');

async function subscribe(req, res, next) {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const verifyToken = crypto.randomBytes(20).toString('hex');
    const unsubscribeToken = crypto.randomBytes(20).toString('hex');

    const existing = NewsletterSubscriber.findByEmail(email.toLowerCase());
    if (existing) {
      if (existing.isActive) return res.json({ message: 'You are already subscribed' });
      NewsletterSubscriber.update(existing._id, { isActive: true, unsubscribeToken });
    } else {
      NewsletterSubscriber.create({
        email: email.toLowerCase(),
        user: req.user?._id || null,
        verifyToken,
        unsubscribeToken,
      });
    }

    const verifyUrl = `${process.env.FRONTEND_URL}/newsletter/verify?token=${verifyToken}`;
    sendNewsletterVerifyEmail(email, verifyUrl).catch((e) => console.error('[email] newsletter verify failed', e.message));

    res.status(201).json({ message: 'Check your email to confirm your subscription' });
  } catch (err) {
    next(err);
  }
}

async function verifySubscription(req, res, next) {
  try {
    const { token } = req.query;
    const sub = NewsletterSubscriber.findByVerifyToken(token);
    if (!sub) return res.status(400).json({ error: 'Invalid verification link' });
    NewsletterSubscriber.update(sub._id, { isVerified: true, verifyToken: null });
    res.json({ message: 'Subscription confirmed' });
  } catch (err) {
    next(err);
  }
}

async function unsubscribe(req, res, next) {
  try {
    const { token } = req.query;
    const sub = NewsletterSubscriber.findByUnsubscribeToken(token);
    if (!sub) return res.status(400).json({ error: 'Invalid unsubscribe link' });
    NewsletterSubscriber.update(sub._id, { isActive: false });
    res.json({ message: 'Unsubscribed' });
  } catch (err) {
    next(err);
  }
}

async function listSubscribers(req, res, next) {
  try {
    const subs = NewsletterSubscriber.listActive().map((s) => ({
      _id: s._id,
      email: s.email,
      isVerified: s.isVerified,
      createdAt: s.createdAt,
    }));
    res.json({ subscribers: subs, total: subs.length });
  } catch (err) {
    next(err);
  }
}

async function sendNewsletter(req, res, next) {
  try {
    const subject = String(req.body?.subject || '').trim();
    const body = String(req.body?.body || '').trim();
    if (!subject || !body) return res.status(400).json({ error: 'Subject and body are required' });

    const html = renderMarkdown(body);
    const recipients = NewsletterSubscriber.listVerifiedActive({ includeSecrets: true });
    if (!recipients.length) {
      return res.status(400).json({ error: 'No verified subscribers yet' });
    }

    const base = process.env.FRONTEND_URL || '';
    let sent = 0;
    const errors = [];
    for (const sub of recipients) {
      try {
        const unsubscribeUrl = `${base}/newsletter/unsubscribe?token=${encodeURIComponent(sub.unsubscribeToken || '')}`;
        await sendNewsletterBlast(sub.email, { subject, html, unsubscribeUrl });
        sent += 1;
      } catch (err) {
        errors.push({ email: sub.email, error: err.message });
      }
    }

    res.json({
      message: `Sent to ${sent} of ${recipients.length} subscribers`,
      sent,
      total: recipients.length,
      errors,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  subscribe,
  verifySubscription,
  unsubscribe,
  listSubscribers,
  sendNewsletter,
};

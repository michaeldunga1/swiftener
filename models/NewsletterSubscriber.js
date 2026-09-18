const { getDb, now, mapSubscriber } = require('./_helpers');

const NewsletterSubscriber = {
  findByEmail(email) {
    const row = getDb()
      .prepare('SELECT * FROM newsletter_subscribers WHERE lower(email) = lower(?)')
      .get(email);
    return mapSubscriber(row, { includeSecrets: true });
  },

  findByVerifyToken(token) {
    const row = getDb()
      .prepare('SELECT * FROM newsletter_subscribers WHERE verify_token = ?')
      .get(token);
    return mapSubscriber(row, { includeSecrets: true });
  },

  findByUnsubscribeToken(token) {
    const row = getDb()
      .prepare('SELECT * FROM newsletter_subscribers WHERE unsubscribe_token = ?')
      .get(token);
    return mapSubscriber(row, { includeSecrets: true });
  },

  create({ email, user = null, verifyToken, unsubscribeToken }) {
    const ts = now();
    const info = getDb()
      .prepare(
        `INSERT INTO newsletter_subscribers (
           email, user_id, verify_token, unsubscribe_token, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(email.toLowerCase(), user, verifyToken, unsubscribeToken, ts, ts);
    return mapSubscriber(
      getDb().prepare('SELECT * FROM newsletter_subscribers WHERE id = ?').get(info.lastInsertRowid),
      { includeSecrets: true }
    );
  },

  update(id, fields) {
    const allowed = {
      isActive: 'is_active',
      isVerified: 'is_verified',
      verifyToken: 'verify_token',
      unsubscribeToken: 'unsubscribe_token',
      user: 'user_id',
    };
    const sets = [];
    const values = [];
    for (const [key, col] of Object.entries(allowed)) {
      if (!(key in fields)) continue;
      let val = fields[key];
      if (key === 'isActive' || key === 'isVerified') val = val ? 1 : 0;
      if ((key === 'verifyToken' || key === 'unsubscribeToken') && val === undefined) val = null;
      sets.push(`${col} = ?`);
      values.push(val === undefined ? null : val);
    }
    if (!sets.length) return this.findById(id);
    sets.push('updated_at = ?');
    values.push(now());
    values.push(id);
    getDb()
      .prepare(`UPDATE newsletter_subscribers SET ${sets.join(', ')} WHERE id = ?`)
      .run(...values);
    return this.findById(id);
  },

  findById(id) {
    return mapSubscriber(
      getDb().prepare('SELECT * FROM newsletter_subscribers WHERE id = ?').get(id),
      { includeSecrets: true }
    );
  },

  listActive() {
    return getDb()
      .prepare(
        `SELECT id, email, is_verified, created_at, updated_at, user_id, is_active
         FROM newsletter_subscribers WHERE is_active = 1`
      )
      .all()
      .map((r) => mapSubscriber(r));
  },

  listVerifiedActive({ includeSecrets = false } = {}) {
    return getDb()
      .prepare(
        `SELECT * FROM newsletter_subscribers
         WHERE is_active = 1 AND is_verified = 1`
      )
      .all()
      .map((r) => mapSubscriber(r, { includeSecrets }));
  },
};

module.exports = NewsletterSubscriber;

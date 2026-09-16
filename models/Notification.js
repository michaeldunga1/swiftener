const { getDb, now, mapNotification } = require('./_helpers');

const Notification = {
  create({ recipient, type, message, link = '', relatedPost = null, relatedComment = null }) {
    const ts = now();
    const info = getDb()
      .prepare(
        `INSERT INTO notifications (
           recipient_id, type, message, link, related_post_id, related_comment_id, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(recipient, type, message, link, relatedPost, relatedComment, ts, ts);
    return mapNotification(
      getDb().prepare('SELECT * FROM notifications WHERE id = ?').get(info.lastInsertRowid)
    );
  },

  // Fire-and-forget compatible: returns a thenable so .catch() still works.
  createAsync(data) {
    return Promise.resolve().then(() => this.create(data));
  },

  listForUser(userId, { limit = 20, offset = 0 } = {}) {
    return getDb()
      .prepare(
        `SELECT * FROM notifications
         WHERE recipient_id = ?
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`
      )
      .all(userId, Number(limit), Number(offset))
      .map(mapNotification);
  },

  countUnread(userId) {
    return getDb()
      .prepare('SELECT COUNT(*) AS c FROM notifications WHERE recipient_id = ? AND is_read = 0')
      .get(userId).c;
  },

  markRead(id, userId) {
    getDb()
      .prepare(
        `UPDATE notifications SET is_read = 1, updated_at = ?
         WHERE id = ? AND recipient_id = ?`
      )
      .run(now(), id, userId);
    return mapNotification(
      getDb()
        .prepare('SELECT * FROM notifications WHERE id = ? AND recipient_id = ?')
        .get(id, userId)
    );
  },

  markAllRead(userId) {
    getDb()
      .prepare(
        `UPDATE notifications SET is_read = 1, updated_at = ?
         WHERE recipient_id = ? AND is_read = 0`
      )
      .run(now(), userId);
  },
};

module.exports = Notification;

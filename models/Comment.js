const { getDb, now, mapComment } = require('./_helpers');

function userSnippet(row) {
  if (row.user_name == null) return row.user_id;
  return {
    _id: row.user_id,
    name: row.user_name,
    avatar: row.user_avatar,
    ...(row.user_email !== undefined ? { email: row.user_email } : {}),
  };
}

const Comment = {
  findById(id) {
    const row = getDb().prepare('SELECT * FROM comments WHERE id = ?').get(id);
    return mapComment(row);
  },

  create({ post, user, body, parentComment = null }) {
    const ts = now();
    const info = getDb()
      .prepare(
        `INSERT INTO comments (post_id, user_id, body, parent_comment_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(post, user, body, parentComment, ts, ts);
    return this.findByIdWithUser(info.lastInsertRowid);
  },

  findByIdWithUser(id) {
    const row = getDb()
      .prepare(
        `SELECT c.*, u.name AS user_name, u.avatar AS user_avatar
         FROM comments c
         JOIN users u ON u.id = c.user_id
         WHERE c.id = ?`
      )
      .get(id);
    if (!row) return null;
    return mapComment(row, { user: userSnippet(row) });
  },

  listForPost(postId, { includeHidden = false } = {}) {
    let sql = `SELECT c.*, u.name AS user_name, u.avatar AS user_avatar
               FROM comments c
               JOIN users u ON u.id = c.user_id
               WHERE c.post_id = ? AND c.is_deleted = 0`;
    if (!includeHidden) sql += ' AND c.is_hidden = 0';
    sql += ' ORDER BY c.created_at ASC';
    return getDb()
      .prepare(sql)
      .all(postId)
      .map((row) => mapComment(row, { user: userSnippet(row) }));
  },

  update(id, fields) {
    const allowed = {
      body: 'body',
      isDeleted: 'is_deleted',
      reportCount: 'report_count',
      isHidden: 'is_hidden',
    };
    const sets = [];
    const values = [];
    for (const [key, col] of Object.entries(allowed)) {
      if (!(key in fields)) continue;
      let val = fields[key];
      if (key === 'isDeleted' || key === 'isHidden') val = val ? 1 : 0;
      sets.push(`${col} = ?`);
      values.push(val);
    }
    if (!sets.length) return this.findById(id);
    sets.push('updated_at = ?');
    values.push(now());
    values.push(id);
    getDb().prepare(`UPDATE comments SET ${sets.join(', ')} WHERE id = ?`).run(...values);
    return this.findById(id);
  },

  updateManyByUser(userId, fields) {
    getDb()
      .prepare(
        `UPDATE comments SET is_deleted = ?, body = ?, updated_at = ? WHERE user_id = ?`
      )
      .run(fields.isDeleted ? 1 : 0, fields.body, now(), userId);
  },

  count({ user, isDeleted } = {}) {
    const where = [];
    const params = [];
    if (user != null) {
      where.push('user_id = ?');
      params.push(user);
    }
    if (isDeleted != null) {
      where.push('is_deleted = ?');
      params.push(isDeleted ? 1 : 0);
    }
    const sql = where.length
      ? `SELECT COUNT(*) AS c FROM comments WHERE ${where.join(' AND ')}`
      : 'SELECT COUNT(*) AS c FROM comments';
    return getDb().prepare(sql).get(...params).c;
  },

  deleteByPost(postId) {
    return getDb().prepare('DELETE FROM comments WHERE post_id = ?').run(postId).changes;
  },
};

module.exports = Comment;

const { getDb, now, mapInteraction } = require('./_helpers');

const Interaction = {
  findOne({ user, post, type }) {
    const row = getDb()
      .prepare('SELECT * FROM interactions WHERE user_id = ? AND post_id = ? AND type = ?')
      .get(user, post, type);
    return mapInteraction(row);
  },

  find({ user, post, type } = {}) {
    const where = [];
    const params = [];
    if (user != null) {
      where.push('user_id = ?');
      params.push(user);
    }
    if (post != null) {
      where.push('post_id = ?');
      params.push(post);
    }
    if (type != null) {
      where.push('type = ?');
      params.push(type);
    }
    const sql = `SELECT * FROM interactions${
      where.length ? ` WHERE ${where.join(' AND ')}` : ''
    } ORDER BY created_at DESC`;
    return getDb()
      .prepare(sql)
      .all(...params)
      .map(mapInteraction);
  },

  create({ user, post, type }) {
    const ts = now();
    const info = getDb()
      .prepare(
        `INSERT INTO interactions (user_id, post_id, type, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(user, post, type, ts, ts);
    return mapInteraction(
      getDb().prepare('SELECT * FROM interactions WHERE id = ?').get(info.lastInsertRowid)
    );
  },

  delete(id) {
    getDb().prepare('DELETE FROM interactions WHERE id = ?').run(id);
  },

  deleteManyByUser(userId) {
    getDb().prepare('DELETE FROM interactions WHERE user_id = ?').run(userId);
  },

  count({ user, type } = {}) {
    const where = [];
    const params = [];
    if (user != null) {
      where.push('user_id = ?');
      params.push(user);
    }
    if (type != null) {
      where.push('type = ?');
      params.push(type);
    }
    const sql = where.length
      ? `SELECT COUNT(*) AS c FROM interactions WHERE ${where.join(' AND ')}`
      : 'SELECT COUNT(*) AS c FROM interactions';
    return getDb().prepare(sql).get(...params).c;
  },
};

module.exports = Interaction;

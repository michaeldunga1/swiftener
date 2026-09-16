const { getDb, now, toIso, mapView } = require('./_helpers');

const View = {
  findRecentDupe({ post, user, ipHash, since }) {
    const sinceIso = toIso(since);
    if (user != null) {
      return mapView(
        getDb()
          .prepare(
            `SELECT * FROM views
             WHERE post_id = ? AND user_id = ? AND created_at >= ?
             LIMIT 1`
          )
          .get(post, user, sinceIso)
      );
    }
    return mapView(
      getDb()
        .prepare(
          `SELECT * FROM views
           WHERE post_id = ? AND ip_hash = ? AND created_at >= ?
           LIMIT 1`
        )
        .get(post, ipHash, sinceIso)
    );
  },

  create({ post, user = null, ipHash, userAgent = '', referrer = '' }) {
    const ts = now();
    const info = getDb()
      .prepare(
        `INSERT INTO views (post_id, user_id, ip_hash, user_agent, referrer, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(post, user, ipHash, userAgent, referrer, ts, ts);
    return mapView(getDb().prepare('SELECT * FROM views WHERE id = ?').get(info.lastInsertRowid));
  },

  viewsByDay(postId) {
    return getDb()
      .prepare(
        `SELECT date(created_at) AS _id, COUNT(*) AS count
         FROM views
         WHERE post_id = ?
         GROUP BY date(created_at)
         ORDER BY _id ASC`
      )
      .all(postId);
  },
};

module.exports = View;

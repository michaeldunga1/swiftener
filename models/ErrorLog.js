const { getDb, now, fromIso } = require('./_helpers');

function mapRow(row) {
  if (!row) return null;
  let meta = {};
  try {
    meta = JSON.parse(row.meta || '{}');
  } catch {
    meta = {};
  }
  return {
    _id: row.id,
    source: row.source,
    level: row.level,
    message: row.message,
    stack: row.stack,
    statusCode: row.status_code,
    method: row.method,
    path: row.path,
    fullUrl: row.full_url,
    ip: row.ip,
    userAgent: row.user_agent,
    referrer: row.referrer,
    user: row.user_id
      ? { _id: row.user_id, name: row.user_name || null, email: row.user_email || null }
      : row.user_id,
    meta,
    createdAt: fromIso(row.created_at),
  };
}

const ErrorLog = {
  create(data) {
    try {
      const info = getDb()
        .prepare(
          `INSERT INTO error_logs (
             source, level, message, stack, status_code, method, path, full_url,
             ip, user_agent, referrer, user_id, meta, created_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          data.source || 'server',
          data.level || 'error',
          String(data.message || 'Unknown error').slice(0, 2000),
          String(data.stack || '').slice(0, 8000),
          data.statusCode ?? null,
          String(data.method || '').slice(0, 16),
          String(data.path || '').slice(0, 500),
          String(data.fullUrl || '').slice(0, 1000),
          String(data.ip || '').slice(0, 128),
          String(data.userAgent || '').slice(0, 500),
          String(data.referrer || '').slice(0, 500),
          data.userId ?? null,
          JSON.stringify(data.meta || {}),
          now()
        );
      return mapRow(getDb().prepare('SELECT * FROM error_logs WHERE id = ?').get(info.lastInsertRowid));
    } catch (err) {
      // Never throw from logger — avoid recursive failures
      console.error('[ErrorLog] failed to persist', err.message);
      return null;
    }
  },

  list({ limit = 50, offset = 0, source, path, q } = {}) {
    const where = [];
    const params = [];
    if (source) {
      where.push('e.source = ?');
      params.push(source);
    }
    if (path) {
      where.push('e.path LIKE ?');
      params.push(`%${path}%`);
    }
    if (q) {
      where.push('(e.message LIKE ? OR e.stack LIKE ?)');
      params.push(`%${q}%`, `%${q}%`);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    return getDb()
      .prepare(
        `SELECT e.*, u.name AS user_name, u.email AS user_email
         FROM error_logs e
         LEFT JOIN users u ON u.id = e.user_id
         ${whereSql}
         ORDER BY e.created_at DESC
         LIMIT ? OFFSET ?`
      )
      .all(...params, Number(limit), Number(offset))
      .map(mapRow);
  },

  count({ source, path, q } = {}) {
    const where = [];
    const params = [];
    if (source) {
      where.push('source = ?');
      params.push(source);
    }
    if (path) {
      where.push('path LIKE ?');
      params.push(`%${path}%`);
    }
    if (q) {
      where.push('(message LIKE ? OR stack LIKE ?)');
      params.push(`%${q}%`, `%${q}%`);
    }
    const sql = where.length
      ? `SELECT COUNT(*) AS c FROM error_logs WHERE ${where.join(' AND ')}`
      : 'SELECT COUNT(*) AS c FROM error_logs';
    return getDb().prepare(sql).get(...params).c;
  },

  summary() {
    const db = getDb();
    const total = db.prepare('SELECT COUNT(*) AS c FROM error_logs').get().c;
    const today = db
      .prepare(`SELECT COUNT(*) AS c FROM error_logs WHERE date(created_at) = date('now')`)
      .get().c;
    const bySource = db
      .prepare(
        `SELECT source, COUNT(*) AS count FROM error_logs GROUP BY source ORDER BY count DESC`
      )
      .all();
    const topMessages = db
      .prepare(
        `SELECT message, COUNT(*) AS count
         FROM error_logs
         GROUP BY message
         ORDER BY count DESC
         LIMIT 10`
      )
      .all();
    const topPaths = db
      .prepare(
        `SELECT path, COUNT(*) AS count
         FROM error_logs
         WHERE path != ''
         GROUP BY path
         ORDER BY count DESC
         LIMIT 10`
      )
      .all();
    const byDay = db
      .prepare(
        `SELECT date(created_at) AS day, COUNT(*) AS count
         FROM error_logs
         GROUP BY date(created_at)
         ORDER BY day DESC
         LIMIT 14`
      )
      .all();
    return { total, today, bySource, topMessages, topPaths, byDay };
  },
};

module.exports = ErrorLog;

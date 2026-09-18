const { getDb, now, mapReport, mapComment } = require('./_helpers');
const { isUniqueViolation } = require('../config/db');

function UniqueError(message) {
  const err = new Error(message);
  err.code = 'SQLITE_CONSTRAINT_UNIQUE';
  return err;
}

const Report = {
  create({ comment, reportedBy, reason }) {
    const ts = now();
    try {
      const info = getDb()
        .prepare(
          `INSERT INTO reports (comment_id, reported_by_id, reason, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?)`
        )
        .run(comment, reportedBy, reason, ts, ts);
      return mapReport(
        getDb().prepare('SELECT * FROM reports WHERE id = ?').get(info.lastInsertRowid)
      );
    } catch (err) {
      if (isUniqueViolation(err)) throw UniqueError('Duplicate report');
      throw err;
    }
  },

  findById(id) {
    return mapReport(getDb().prepare('SELECT * FROM reports WHERE id = ?').get(id));
  },

  update(id, fields) {
    const sets = [];
    const values = [];
    if ('status' in fields) {
      sets.push('status = ?');
      values.push(fields.status);
    }
    if (!sets.length) return this.findById(id);
    sets.push('updated_at = ?');
    values.push(now());
    values.push(id);
    getDb().prepare(`UPDATE reports SET ${sets.join(', ')} WHERE id = ?`).run(...values);
    return this.findById(id);
  },

  updateManyByComment(commentId, fields) {
    getDb()
      .prepare(`UPDATE reports SET status = ?, updated_at = ? WHERE comment_id = ? AND status = 'pending'`)
      .run(fields.status, now(), commentId);
  },

  count({ status } = {}) {
    if (status) {
      return getDb().prepare('SELECT COUNT(*) AS c FROM reports WHERE status = ?').get(status).c;
    }
    return getDb().prepare('SELECT COUNT(*) AS c FROM reports').get().c;
  },

  listPending() {
    const rows = getDb()
      .prepare(
        `SELECT
           r.*,
           rb.id AS rb_id, rb.name AS rb_name, rb.username AS rb_username, rb.email AS rb_email,
           c.id AS c_id, c.post_id AS c_post_id, c.user_id AS c_user_id, c.body AS c_body,
           c.parent_comment_id AS c_parent, c.is_deleted AS c_is_deleted,
           c.report_count AS c_report_count, c.is_hidden AS c_is_hidden,
           c.created_at AS c_created_at, c.updated_at AS c_updated_at,
           cu.id AS cu_id, cu.name AS cu_name, cu.username AS cu_username, cu.email AS cu_email
         FROM reports r
         JOIN users rb ON rb.id = r.reported_by_id
         JOIN comments c ON c.id = r.comment_id
         JOIN users cu ON cu.id = c.user_id
         WHERE r.status = 'pending'
         ORDER BY r.created_at DESC`
      )
      .all();

    return rows.map((row) =>
      mapReport(row, {
        reportedBy: { _id: row.rb_id, name: row.rb_name, username: row.rb_username, email: row.rb_email },
        comment: mapComment(
          {
            id: row.c_id,
            post_id: row.c_post_id,
            user_id: row.c_user_id,
            body: row.c_body,
            parent_comment_id: row.c_parent,
            is_deleted: row.c_is_deleted,
            report_count: row.c_report_count,
            is_hidden: row.c_is_hidden,
            created_at: row.c_created_at,
            updated_at: row.c_updated_at,
          },
          { user: { _id: row.cu_id, name: row.cu_name, username: row.cu_username, email: row.cu_email } }
        ),
      })
    );
  },
};

module.exports = Report;

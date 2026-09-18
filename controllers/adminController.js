const User = require('../models/User');
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const Report = require('../models/Report');
const Interaction = require('../models/Interaction');
const PageLoad = require('../models/PageLoad');
const ErrorLog = require('../models/ErrorLog');
const { getDb } = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const { sendInviteEmail } = require('../utils/email');

const SENSITIVE_COLUMNS = new Set([
  'password',
  'reset_token',
  'verify_token',
  'unsubscribe_token',
  'google_id',
  'github_id',
]);

function listSqliteTables() {
  const db = getDb();
  return db
    .prepare(
      `SELECT name FROM sqlite_master
       WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
       ORDER BY name`
    )
    .all()
    .map((r) => r.name);
}

function assertSafeTableName(name) {
  if (!/^[a-z][a-z0-9_]*$/i.test(name)) {
    const err = new Error('Invalid table name');
    err.statusCode = 400;
    throw err;
  }
  const tables = listSqliteTables();
  if (!tables.includes(name)) {
    const err = new Error('Table not found');
    err.statusCode = 404;
    throw err;
  }
  return name;
}

function redactRow(row) {
  const out = { ...row };
  for (const key of Object.keys(out)) {
    if (SENSITIVE_COLUMNS.has(key)) out[key] = '[redacted]';
  }
  return out;
}

async function dashboardStats(req, res, next) {
  try {
    const totalPosts = Post.count();
    const publishedPosts = Post.count({ status: 'published' });
    const draftPosts = Post.count({ status: 'draft' });
    const totalUsers = User.count();
    const totalComments = Comment.count({ isDeleted: false });
    const pendingReports = Report.count({ status: 'pending' });
    const pageLoadSummary = PageLoad.summary();
    const errorSummary = ErrorLog.summary();

    const topPosts = Post.topByViews(5).map((p) => ({
      _id: p._id,
      title: p.title,
      slug: p.slug,
      category: p.category,
      tags: p.tags,
      viewsCount: p.viewsCount,
      likesCount: p.likesCount,
      commentsCount: p.commentsCount,
    }));

    const recentUsers = User.recent(5).map((u) => ({
      _id: u._id,
      name: u.name,
      email: u.email,
      createdAt: u.createdAt,
    }));

    res.json({
      totals: {
        totalPosts,
        publishedPosts,
        draftPosts,
        totalUsers,
        totalComments,
        pendingReports,
        pageLoads: pageLoadSummary.total,
        uniqueVisitors: pageLoadSummary.uniqueIps,
        pageLoadsToday: pageLoadSummary.today,
        errors: errorSummary.total,
        errorsToday: errorSummary.today,
      },
      topPosts,
      recentUsers,
      pageLoadSummary,
      errorSummary,
    });
  } catch (err) {
    next(err);
  }
}

async function listUsers(req, res, next) {
  try {
    const { page = 1, limit = 20, q } = req.query;
    const users = User.list({
      q,
      limit: Number(limit),
      offset: (Number(page) - 1) * Number(limit),
    });
    const total = User.count({ q });
    res.json({ users, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
}

async function makeAdmin(req, res, next) {
  try {
    const user = User.update(req.params.id, { role: 'admin' });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch (err) {
    next(err);
  }
}

async function revokeAdmin(req, res, next) {
  try {
    const user = User.update(req.params.id, { role: 'user' });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch (err) {
    next(err);
  }
}

async function blockUser(req, res, next) {
  try {
    const user = User.update(req.params.id, { isBlocked: true });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch (err) {
    next(err);
  }
}

async function unblockUser(req, res, next) {
  try {
    const user = User.update(req.params.id, { isBlocked: false });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch (err) {
    next(err);
  }
}

async function suspendUser(req, res, next) {
  try {
    const { untilDate } = req.body;
    const user = User.update(req.params.id, {
      isSuspended: true,
      suspendedUntil: untilDate ? new Date(untilDate) : null,
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch (err) {
    next(err);
  }
}

async function unsuspendUser(req, res, next) {
  try {
    const user = User.update(req.params.id, { isSuspended: false, suspendedUntil: null });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch (err) {
    next(err);
  }
}

async function deleteUser(req, res, next) {
  try {
    const user = User.delete(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    Comment.updateManyByUser(user._id, { isDeleted: true, body: '[deleted user]' });
    Interaction.deleteManyByUser(user._id);
    res.json({ message: 'User deleted' });
  } catch (err) {
    next(err);
  }
}

async function inviteUser(req, res, next) {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });
    const inviteToken = uuidv4();
    const inviteUrl = `${process.env.FRONTEND_URL}/register?invite=${inviteToken}&email=${encodeURIComponent(email)}`;
    await sendInviteEmail(email, inviteUrl, req.user.name);
    res.json({ message: 'Invite sent' });
  } catch (err) {
    next(err);
  }
}

async function listPendingReports(req, res, next) {
  try {
    const reports = Report.listPending();
    res.json({ reports });
  } catch (err) {
    next(err);
  }
}

async function resolveReport(req, res, next) {
  try {
    const { action } = req.body;
    const report = Report.findById(req.params.id);
    if (!report) return res.status(404).json({ error: 'Report not found' });

    if (action === 'hide') {
      Comment.update(report.comment, { isHidden: true });
      Report.updateManyByComment(report.comment, { status: 'reviewed' });
    } else {
      Report.update(report._id, { status: 'dismissed' });
    }

    res.json({ message: 'Report resolved' });
  } catch (err) {
    next(err);
  }
}

async function pageLoadAnalytics(req, res, next) {
  try {
    const { page = 1, limit = 50, path, ip } = req.query;
    const filter = { path: path || undefined, ip: ip || undefined };
    const loads = PageLoad.list({
      ...filter,
      limit: Number(limit),
      offset: (Number(page) - 1) * Number(limit),
    });
    const total = PageLoad.count(filter);
    const summary = PageLoad.summary();
    const demographics = PageLoad.demographics();
    res.json({
      loads,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)) || 1,
      summary,
      demographics,
    });
  } catch (err) {
    next(err);
  }
}

async function errorAnalytics(req, res, next) {
  try {
    const { page = 1, limit = 50, source, path, q } = req.query;
    const filter = {
      source: source || undefined,
      path: path || undefined,
      q: q || undefined,
    };
    const errors = ErrorLog.list({
      ...filter,
      limit: Number(limit),
      offset: (Number(page) - 1) * Number(limit),
    });
    const total = ErrorLog.count(filter);
    const summary = ErrorLog.summary();
    res.json({
      errors,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)) || 1,
      summary,
    });
  } catch (err) {
    next(err);
  }
}

async function listTables(req, res, next) {
  try {
    const db = getDb();
    const names = listSqliteTables();
    const tables = names.map((name) => {
      const columns = db.prepare(`PRAGMA table_info(${name})`).all();
      const count = db.prepare(`SELECT COUNT(*) AS c FROM ${name}`).get().c;
      return {
        name,
        rowCount: count,
        columns: columns.map((c) => ({
          name: c.name,
          type: c.type,
          notnull: Boolean(c.notnull),
          pk: Boolean(c.pk),
          sensitive: SENSITIVE_COLUMNS.has(c.name),
        })),
      };
    });
    res.json({ tables });
  } catch (err) {
    next(err);
  }
}

async function browseTable(req, res, next) {
  try {
    const name = assertSafeTableName(req.params.name);
    const db = getDb();
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
    const offset = (page - 1) * limit;
    const q = String(req.query.q || '').trim();

    const columns = db.prepare(`PRAGMA table_info(${name})`).all();
    const colNames = columns.map((c) => c.name);
    const totalAll = db.prepare(`SELECT COUNT(*) AS c FROM ${name}`).get().c;

    let total = totalAll;
    let rows;
    if (q) {
      const textCols = columns
        .filter((c) => !SENSITIVE_COLUMNS.has(c.name))
        .filter((c) => /TEXT|CHAR|CLOB|VARCHAR/i.test(c.type || '') || !c.type)
        .map((c) => c.name);
      if (textCols.length) {
        const where = textCols.map((c) => `CAST(${c} AS TEXT) LIKE ?`).join(' OR ');
        const like = `%${q}%`;
        const params = textCols.map(() => like);
        total = db.prepare(`SELECT COUNT(*) AS c FROM ${name} WHERE ${where}`).get(...params).c;
        rows = db
          .prepare(`SELECT * FROM ${name} WHERE ${where} ORDER BY rowid DESC LIMIT ? OFFSET ?`)
          .all(...params, limit, offset);
      } else {
        rows = db.prepare(`SELECT * FROM ${name} ORDER BY rowid DESC LIMIT ? OFFSET ?`).all(limit, offset);
      }
    } else {
      rows = db.prepare(`SELECT * FROM ${name} ORDER BY rowid DESC LIMIT ? OFFSET ?`).all(limit, offset);
    }

    res.json({
      table: name,
      columns: colNames,
      rows: rows.map(redactRow),
      total,
      totalAll,
      page,
      pages: Math.ceil(total / limit) || 1,
      limit,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  dashboardStats,
  listUsers,
  makeAdmin,
  revokeAdmin,
  blockUser,
  unblockUser,
  suspendUser,
  unsuspendUser,
  deleteUser,
  inviteUser,
  listPendingReports,
  resolveReport,
  pageLoadAnalytics,
  errorAnalytics,
  listTables,
  browseTable,
};

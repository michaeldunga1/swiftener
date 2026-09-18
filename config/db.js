const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

let db;

const SCHEMA = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  username TEXT UNIQUE COLLATE NOCASE,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password TEXT NOT NULL,
  avatar TEXT NOT NULL DEFAULT '',
  bio TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  is_blocked INTEGER NOT NULL DEFAULT 0,
  is_suspended INTEGER NOT NULL DEFAULT 0,
  suspended_until TEXT,
  is_verified INTEGER NOT NULL DEFAULT 0,
  verify_token TEXT,
  reset_token TEXT,
  reset_token_expiry TEXT,
  invited_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  last_login_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  body TEXT NOT NULL,
  excerpt TEXT NOT NULL DEFAULT '',
  cover_image TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL,
  tags TEXT NOT NULL DEFAULT '[]',
  author_id INTEGER NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published')),
  published_at TEXT,
  views_count INTEGER NOT NULL DEFAULT 0,
  likes_count INTEGER NOT NULL DEFAULT 0,
  saves_count INTEGER NOT NULL DEFAULT 0,
  bookmarks_count INTEGER NOT NULL DEFAULT 0,
  comments_count INTEGER NOT NULL DEFAULT 0,
  shares_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_posts_category_status_published
  ON posts(category, status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status);

CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL REFERENCES posts(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  parent_comment_id INTEGER REFERENCES comments(id) ON DELETE SET NULL,
  is_deleted INTEGER NOT NULL DEFAULT 0,
  report_count INTEGER NOT NULL DEFAULT 0,
  is_hidden INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_comments_post_created ON comments(post_id, created_at);

CREATE TABLE IF NOT EXISTS interactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('like', 'save', 'bookmark')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, post_id, type)
);

CREATE INDEX IF NOT EXISTS idx_interactions_post_type ON interactions(post_id, type);

CREATE TABLE IF NOT EXISTS views (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ip_hash TEXT NOT NULL,
  user_agent TEXT NOT NULL DEFAULT '',
  referrer TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_views_post_ip_created ON views(post_id, ip_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_views_post_user_created ON views(post_id, user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recipient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT NOT NULL DEFAULT '',
  related_post_id INTEGER REFERENCES posts(id) ON DELETE SET NULL,
  related_comment_id INTEGER REFERENCES comments(id) ON DELETE SET NULL,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_read_created
  ON notifications(recipient_id, is_read, created_at DESC);

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  is_verified INTEGER NOT NULL DEFAULT 0,
  verify_token TEXT,
  unsubscribe_token TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  comment_id INTEGER NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  reported_by_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (comment_id, reported_by_id)
);

CREATE TABLE IF NOT EXISTS page_loads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  path TEXT NOT NULL,
  full_url TEXT NOT NULL DEFAULT '',
  query_string TEXT NOT NULL DEFAULT '',
  referrer TEXT NOT NULL DEFAULT '',
  ip TEXT NOT NULL DEFAULT '',
  user_agent TEXT NOT NULL DEFAULT '',
  accept_language TEXT NOT NULL DEFAULT '',
  language TEXT NOT NULL DEFAULT '',
  platform TEXT NOT NULL DEFAULT '',
  screen_width INTEGER,
  screen_height INTEGER,
  viewport_width INTEGER,
  viewport_height INTEGER,
  timezone TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  is_bot INTEGER NOT NULL DEFAULT 0,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_page_loads_created ON page_loads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_page_loads_path ON page_loads(path);
CREATE INDEX IF NOT EXISTS idx_page_loads_ip ON page_loads(ip);

CREATE TABLE IF NOT EXISTS error_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL DEFAULT 'server' CHECK (source IN ('server', 'client')),
  level TEXT NOT NULL DEFAULT 'error' CHECK (level IN ('error', 'warn', 'info')),
  message TEXT NOT NULL,
  stack TEXT NOT NULL DEFAULT '',
  status_code INTEGER,
  method TEXT NOT NULL DEFAULT '',
  path TEXT NOT NULL DEFAULT '',
  full_url TEXT NOT NULL DEFAULT '',
  ip TEXT NOT NULL DEFAULT '',
  user_agent TEXT NOT NULL DEFAULT '',
  referrer TEXT NOT NULL DEFAULT '',
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  meta TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_error_logs_created ON error_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_source ON error_logs(source);
CREATE INDEX IF NOT EXISTS idx_error_logs_path ON error_logs(path);
`;

function migrate(database) {
  const cols = database.prepare('PRAGMA table_info(users)').all();
  const names = new Set(cols.map((c) => c.name));
  if (!names.has('google_id')) database.exec('ALTER TABLE users ADD COLUMN google_id TEXT');
  if (!names.has('github_id')) database.exec('ALTER TABLE users ADD COLUMN github_id TEXT');
  if (!names.has('username')) database.exec('ALTER TABLE users ADD COLUMN username TEXT');
  database.exec(
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id) WHERE google_id IS NOT NULL'
  );
  database.exec(
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_users_github_id ON users(github_id) WHERE github_id IS NOT NULL'
  );

  backfillUsernames(database);

  const plCols = database.prepare('PRAGMA table_info(page_loads)').all();
  const plNames = new Set(plCols.map((c) => c.name));
  if (!plNames.has('country')) database.exec(`ALTER TABLE page_loads ADD COLUMN country TEXT NOT NULL DEFAULT ''`);
  if (!plNames.has('city')) database.exec(`ALTER TABLE page_loads ADD COLUMN city TEXT NOT NULL DEFAULT ''`);
  if (!plNames.has('is_bot')) database.exec(`ALTER TABLE page_loads ADD COLUMN is_bot INTEGER NOT NULL DEFAULT 0`);
  database.exec('CREATE INDEX IF NOT EXISTS idx_page_loads_country ON page_loads(country)');
  database.exec('CREATE INDEX IF NOT EXISTS idx_page_loads_is_bot ON page_loads(is_bot)');
}

function ensureUniqueUsernameIndex(database) {
  // Prefer a full unique index so every username is unique (no duplicates via NULL/blank).
  try {
    database.exec('DROP INDEX IF EXISTS idx_users_username');
  } catch {
    /* ignore */
  }
  database.exec(
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username COLLATE NOCASE)'
  );
}

function backfillUsernames(database) {
  const { allocateUsername } = require('../utils/username');
  const missing = database
    .prepare(`SELECT id, name, email FROM users WHERE username IS NULL OR trim(username) = ''`)
    .all();

  if (missing.length) {
    const taken = new Set(
      database
        .prepare(
          `SELECT lower(username) AS u FROM users WHERE username IS NOT NULL AND trim(username) != ''`
        )
        .all()
        .map((r) => r.u)
    );
    const update = database.prepare('UPDATE users SET username = ? WHERE id = ?');
    const tx = database.transaction((rows) => {
      for (const row of rows) {
        const seed = row.name || String(row.email || '').split('@')[0] || `user-${row.id}`;
        const username = allocateUsername(seed, (candidate) => taken.has(candidate.toLowerCase()));
        taken.add(username.toLowerCase());
        update.run(username, row.id);
      }
    });
    tx(missing);
    console.log(`[db] Backfilled usernames for ${missing.length} users`);
  }

  ensureUniqueUsernameIndex(database);
}

function backfillPageLoadGeo(database) {
  try {
    const { lookupGeo } = require('../utils/geoip');
    const { isBotUserAgent } = require('../utils/bot');
    const rows = database
      .prepare(
        `SELECT id, ip, user_agent, timezone, country
         FROM page_loads
         WHERE country = '' OR country IS NULL
         LIMIT 5000`
      )
      .all();
    if (!rows.length) return;
    const update = database.prepare(
      `UPDATE page_loads SET country = ?, city = ?, is_bot = ? WHERE id = ?`
    );
    const tx = database.transaction((items) => {
      for (const row of items) {
        const geo = lookupGeo(row.ip, { timezone: row.timezone });
        update.run(geo.country, geo.city, isBotUserAgent(row.user_agent) ? 1 : 0, row.id);
      }
    });
    tx(rows);
    console.log(`[db] Backfilled geo/bot for ${rows.length} page_loads`);
  } catch (err) {
    console.warn('[db] Geo backfill skipped:', err.message);
  }
}

function connectDB() {
  const rawPath = process.env.SQLITE_PATH || path.join(__dirname, '..', 'data', 'swiftener.db');
  const dbPath = path.isAbsolute(rawPath) ? rawPath : path.resolve(process.cwd(), rawPath);
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  db = new Database(dbPath);
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = DELETE');
  db.exec(SCHEMA);
  migrate(db);
  backfillPageLoadGeo(db);

  console.log(`[db] SQLite connected (${dbPath})`);
  return db;
}

function getDb() {
  if (!db) throw new Error('Database not initialized — call connectDB() first');
  return db;
}

function isUniqueViolation(err) {
  return err && (err.code === 'SQLITE_CONSTRAINT_UNIQUE' || String(err.message || '').includes('UNIQUE'));
}

module.exports = connectDB;
module.exports.connectDB = connectDB;
module.exports.getDb = getDb;
module.exports.isUniqueViolation = isUniqueViolation;

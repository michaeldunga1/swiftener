const { getDb, now, toIso, mapUser } = require('./_helpers');
const { allocateUsername, validateUsername } = require('../utils/username');
const { isUniqueViolation } = require('../config/db');

function usernameTaken(username, excludeId = null) {
  const row = excludeId
    ? getDb()
        .prepare('SELECT id FROM users WHERE lower(username) = lower(?) AND id != ?')
        .get(username, excludeId)
    : getDb().prepare('SELECT id FROM users WHERE lower(username) = lower(?)').get(username);
  return Boolean(row);
}

const User = {
  findById(id, { includePassword = false, includeTokens = false } = {}) {
    const row = getDb().prepare('SELECT * FROM users WHERE id = ?').get(id);
    return mapUser(row, { includeSecrets: includePassword || includeTokens });
  },

  findByUsername(username, opts = {}) {
    if (!username) return null;
    const row = getDb()
      .prepare('SELECT * FROM users WHERE lower(username) = lower(?)')
      .get(String(username));
    return mapUser(row, { includeSecrets: opts.includeSecrets });
  },

  findOne({ email, googleId, githubId, verifyToken, resetToken, resetTokenExpiryGt } = {}, opts = {}) {
    const db = getDb();
    let row;
    if (googleId != null) {
      row = db.prepare('SELECT * FROM users WHERE google_id = ?').get(String(googleId));
    } else if (githubId != null) {
      row = db.prepare('SELECT * FROM users WHERE github_id = ?').get(String(githubId));
    } else if (email != null) {
      row = db.prepare('SELECT * FROM users WHERE lower(email) = lower(?)').get(email);
    } else if (verifyToken != null) {
      row = db.prepare('SELECT * FROM users WHERE verify_token = ?').get(verifyToken);
    } else if (resetToken != null) {
      row = db
        .prepare(
          `SELECT * FROM users
           WHERE reset_token = ?
             AND reset_token_expiry IS NOT NULL
             AND reset_token_expiry > ?`
        )
        .get(resetToken, toIso(resetTokenExpiryGt || new Date()));
    }
    return mapUser(row, { includeSecrets: opts.includeSecrets });
  },

  create({
    name,
    email,
    password,
    username = null,
    verifyToken = null,
    invitedBy = null,
    role = 'user',
    googleId = null,
    githubId = null,
    avatar = '',
    isVerified = false,
  }) {
    const ts = now();
    const seed = username || name || String(email || '').split('@')[0] || 'user';
    const uniqueUsername = allocateUsername(seed, (candidate) => usernameTaken(candidate));

    const info = getDb()
      .prepare(
        `INSERT INTO users (
           name, username, email, password, verify_token, invited_by, role,
           google_id, github_id, avatar, is_verified, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        name,
        uniqueUsername,
        email.toLowerCase(),
        password,
        verifyToken,
        invitedBy,
        role,
        googleId,
        githubId,
        avatar || '',
        isVerified ? 1 : 0,
        ts,
        ts
      );
    return this.findById(info.lastInsertRowid);
  },

  update(id, fields) {
    const allowed = {
      name: 'name',
      username: 'username',
      email: 'email',
      password: 'password',
      avatar: 'avatar',
      bio: 'bio',
      role: 'role',
      isBlocked: 'is_blocked',
      isSuspended: 'is_suspended',
      suspendedUntil: 'suspended_until',
      isVerified: 'is_verified',
      verifyToken: 'verify_token',
      resetToken: 'reset_token',
      resetTokenExpiry: 'reset_token_expiry',
      lastLoginAt: 'last_login_at',
      googleId: 'google_id',
      githubId: 'github_id',
    };

    const sets = [];
    const values = [];
    for (const [key, col] of Object.entries(allowed)) {
      if (!(key in fields)) continue;
      let val = fields[key];
      if (key === 'username') {
        const check = validateUsername(val);
        if (!check.ok) {
          const err = new Error(check.error);
          err.statusCode = 400;
          throw err;
        }
        if (usernameTaken(check.username, id)) {
          const err = new Error('Username is already taken');
          err.statusCode = 409;
          throw err;
        }
        val = check.username;
      } else if (key === 'isBlocked' || key === 'isSuspended' || key === 'isVerified') {
        val = val ? 1 : 0;
      } else if (key === 'suspendedUntil' || key === 'resetTokenExpiry' || key === 'lastLoginAt') {
        val = toIso(val);
      } else if ((key === 'verifyToken' || key === 'resetToken') && val === undefined) {
        val = null;
      }
      sets.push(`${col} = ?`);
      values.push(val === undefined ? null : val);
    }
    if (!sets.length) return this.findById(id);

    sets.push('updated_at = ?');
    values.push(now());
    values.push(id);
    try {
      getDb().prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).run(...values);
    } catch (err) {
      if (isUniqueViolation(err)) {
        const e = new Error('Username is already taken');
        e.statusCode = 409;
        throw e;
      }
      throw err;
    }
    return this.findById(id, { includePassword: true, includeTokens: true });
  },

  delete(id) {
    const user = this.findById(id);
    if (!user) return null;
    getDb().prepare('DELETE FROM users WHERE id = ?').run(id);
    return user;
  },

  count(filter = {}) {
    if (filter.q) {
      const like = `%${filter.q}%`;
      return getDb()
        .prepare(
          'SELECT COUNT(*) AS c FROM users WHERE name LIKE ? OR email LIKE ? OR username LIKE ?'
        )
        .get(like, like, like).c;
    }
    return getDb().prepare('SELECT COUNT(*) AS c FROM users').get().c;
  },

  list({ q, limit = 20, offset = 0 } = {}) {
    const db = getDb();
    let rows;
    if (q) {
      const like = `%${q}%`;
      rows = db
        .prepare(
          `SELECT * FROM users
           WHERE name LIKE ? OR email LIKE ? OR username LIKE ?
           ORDER BY created_at DESC
           LIMIT ? OFFSET ?`
        )
        .all(like, like, like, Number(limit), Number(offset));
    } else {
      rows = db
        .prepare('SELECT * FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?')
        .all(Number(limit), Number(offset));
    }
    return rows.map((r) => mapUser(r));
  },

  recent(limit = 5) {
    return getDb()
      .prepare('SELECT * FROM users ORDER BY created_at DESC LIMIT ?')
      .all(Number(limit))
      .map((r) => mapUser(r));
  },
};

module.exports = User;

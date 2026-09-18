const slugify = require('slugify');

const RESERVED_USERNAMES = new Set([
  'me',
  'invite',
  'analytics',
  'admin',
  'api',
  'login',
  'register',
  'profile',
  'settings',
  'new',
  'edit',
  'null',
  'undefined',
]);

/** Normalize a display name or raw username into a URL slug. */
function normalizeUsername(input) {
  const raw = String(input || '').trim();
  const slug = slugify(raw, { lower: true, strict: true, trim: true })
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
  return slug;
}

function isReservedUsername(username) {
  return RESERVED_USERNAMES.has(String(username || '').toLowerCase());
}

/**
 * Allocate a unique username from a seed (name or email local-part).
 * `existsFn(username)` should return true when the slug is taken.
 */
function allocateUsername(seed, existsFn) {
  let base = normalizeUsername(seed);
  if (!base || base.length < 2) base = 'user';
  if (isReservedUsername(base)) base = `user-${base}`.slice(0, 32);

  let candidate = base;
  let n = 2;
  while (existsFn(candidate) || isReservedUsername(candidate)) {
    const suffix = `-${n}`;
    candidate = `${base.slice(0, Math.max(1, 32 - suffix.length))}${suffix}`;
    n += 1;
    if (n > 9999) {
      candidate = `user-${Date.now().toString(36)}`.slice(0, 32);
      break;
    }
  }
  return candidate;
}

function validateUsername(input) {
  const username = normalizeUsername(input);
  if (!username || username.length < 2) {
    return { ok: false, error: 'Username must be at least 2 characters' };
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(username)) {
    return { ok: false, error: 'Username can only use letters, numbers, and hyphens' };
  }
  if (isReservedUsername(username)) {
    return { ok: false, error: 'That username is reserved' };
  }
  return { ok: true, username };
}

module.exports = {
  RESERVED_USERNAMES,
  normalizeUsername,
  isReservedUsername,
  allocateUsername,
  validateUsername,
};

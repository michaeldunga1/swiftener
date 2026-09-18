const { getDb } = require('../config/db');

const BOOL_FIELDS = new Set([
  'isBlocked',
  'isSuspended',
  'isVerified',
  'isDeleted',
  'isHidden',
  'isRead',
  'isActive',
]);

function now() {
  return new Date().toISOString();
}

function toIso(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function fromIso(value) {
  if (value == null || value === '') return null;
  return new Date(value);
}

function mapBools(obj) {
  if (!obj) return obj;
  for (const key of BOOL_FIELDS) {
    if (key in obj) obj[key] = Boolean(obj[key]);
  }
  return obj;
}

function mapUser(row, { includeSecrets = false } = {}) {
  if (!row) return null;
  const user = mapBools({
    _id: row.id,
    name: row.name,
    username: row.username || null,
    email: row.email,
    avatar: row.avatar,
    bio: row.bio,
    role: row.role,
    isBlocked: row.is_blocked,
    isSuspended: row.is_suspended,
    suspendedUntil: fromIso(row.suspended_until),
    isVerified: row.is_verified,
    googleId: row.google_id || null,
    githubId: row.github_id || null,
    invitedBy: row.invited_by,
    lastLoginAt: fromIso(row.last_login_at),
    createdAt: fromIso(row.created_at),
    updatedAt: fromIso(row.updated_at),
  });
  if (includeSecrets) {
    if (row.password != null) user.password = row.password;
    if (row.verify_token !== undefined) user.verifyToken = row.verify_token;
    if (row.reset_token !== undefined) user.resetToken = row.reset_token;
    if (row.reset_token_expiry !== undefined) user.resetTokenExpiry = fromIso(row.reset_token_expiry);
  }
  user.isActiveForEngagement = function isActiveForEngagement() {
    if (this.isBlocked) return false;
    if (this.isSuspended) {
      if (!this.suspendedUntil) return false;
      if (this.suspendedUntil > new Date()) return false;
    }
    return true;
  };
  return user;
}

function mapPost(row, { author } = {}) {
  if (!row) return null;
  let tags = [];
  try {
    tags = JSON.parse(row.tags || '[]');
  } catch {
    tags = [];
  }
  const post = {
    _id: row.id,
    title: row.title,
    slug: row.slug,
    body: row.body,
    excerpt: row.excerpt,
    coverImage: row.cover_image,
    category: row.category,
    tags,
    author: author || row.author_id,
    status: row.status,
    publishedAt: fromIso(row.published_at),
    viewsCount: row.views_count,
    likesCount: row.likes_count,
    savesCount: row.saves_count,
    bookmarksCount: row.bookmarks_count,
    commentsCount: row.comments_count,
    sharesCount: row.shares_count,
    createdAt: fromIso(row.created_at),
    updatedAt: fromIso(row.updated_at),
  };
  return post;
}

function mapComment(row, { user } = {}) {
  if (!row) return null;
  return mapBools({
    _id: row.id,
    post: row.post_id,
    user: user || row.user_id,
    body: row.body,
    parentComment: row.parent_comment_id,
    isDeleted: row.is_deleted,
    reportCount: row.report_count,
    isHidden: row.is_hidden,
    createdAt: fromIso(row.created_at),
    updatedAt: fromIso(row.updated_at),
  });
}

function mapInteraction(row) {
  if (!row) return null;
  return {
    _id: row.id,
    user: row.user_id,
    post: row.post_id,
    type: row.type,
    createdAt: fromIso(row.created_at),
    updatedAt: fromIso(row.updated_at),
  };
}

function mapView(row) {
  if (!row) return null;
  return {
    _id: row.id,
    post: row.post_id,
    user: row.user_id,
    ipHash: row.ip_hash,
    userAgent: row.user_agent,
    referrer: row.referrer,
    createdAt: fromIso(row.created_at),
    updatedAt: fromIso(row.updated_at),
  };
}

function mapNotification(row) {
  if (!row) return null;
  return mapBools({
    _id: row.id,
    recipient: row.recipient_id,
    type: row.type,
    message: row.message,
    link: row.link,
    relatedPost: row.related_post_id,
    relatedComment: row.related_comment_id,
    isRead: row.is_read,
    createdAt: fromIso(row.created_at),
    updatedAt: fromIso(row.updated_at),
  });
}

function mapSubscriber(row, { includeSecrets = false } = {}) {
  if (!row) return null;
  const sub = mapBools({
    _id: row.id,
    email: row.email,
    user: row.user_id,
    isVerified: row.is_verified,
    isActive: row.is_active,
    createdAt: fromIso(row.created_at),
    updatedAt: fromIso(row.updated_at),
  });
  if (includeSecrets) {
    if (row.verify_token !== undefined) sub.verifyToken = row.verify_token;
    if (row.unsubscribe_token !== undefined) sub.unsubscribeToken = row.unsubscribe_token;
  }
  return sub;
}

function mapReport(row, extras = {}) {
  if (!row) return null;
  return {
    _id: row.id,
    comment: extras.comment || row.comment_id,
    reportedBy: extras.reportedBy || row.reported_by_id,
    reason: row.reason,
    status: row.status,
    createdAt: fromIso(row.created_at),
    updatedAt: fromIso(row.updated_at),
  };
}

module.exports = {
  getDb,
  now,
  toIso,
  fromIso,
  mapUser,
  mapPost,
  mapComment,
  mapInteraction,
  mapView,
  mapNotification,
  mapSubscriber,
  mapReport,
};

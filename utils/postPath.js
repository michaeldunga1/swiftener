/** Build a URL-safe tag segment for post paths. */
function tagSlug(tag) {
  const s = String(tag || 'general')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return s || 'general';
}

/** Primary tag for a post URL (first tag, else category). */
function primaryTag(post) {
  if (Array.isArray(post?.tags) && post.tags.length) return post.tags[0];
  if (post?.category) return post.category;
  return 'general';
}

/** Canonical public path: /posts/:tag/:slug */
function postPath(post, { hash = '' } = {}) {
  const slug = post?.slug;
  if (!slug) return '/';
  const path = `/posts/${encodeURIComponent(tagSlug(primaryTag(post)))}/${encodeURIComponent(slug)}`;
  return hash ? `${path}${hash.startsWith('#') ? hash : `#${hash}`}` : path;
}

module.exports = { tagSlug, primaryTag, postPath };

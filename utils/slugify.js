const slugify = require('slugify');
const Post = require('../models/Post');

function normalizeSlug(title) {
  const base = slugify(String(title || ''), { lower: true, strict: true, trim: true });
  return base || 'post';
}

async function generateUniqueSlug(title, existingPostId = null) {
  const base = normalizeSlug(title);
  let slug = base;
  let counter = 2;

  while (true) {
    const clash = existingPostId
      ? Post.findOneBySlugExcluding(slug, existingPostId)
      : Post.findOneBySlug(slug);
    if (!clash) return slug;
    slug = `${base}-${counter}`;
    counter += 1;
    if (counter > 9999) {
      return `${base}-${Date.now().toString(36)}`;
    }
  }
}

module.exports = { generateUniqueSlug, normalizeSlug };

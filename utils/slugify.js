const slugify = require('slugify');
const Post = require('../models/Post');

async function generateUniqueSlug(title, existingPostId = null) {
  const base = slugify(title, { lower: true, strict: true, trim: true });
  let slug = base;
  let counter = 2;

  while (true) {
    const clash = existingPostId
      ? Post.findOneBySlugExcluding(slug, existingPostId)
      : Post.findOneBySlug(slug);
    if (!clash) return slug;
    slug = `${base}-${counter}`;
    counter += 1;
  }
}

module.exports = { generateUniqueSlug };

const { getDb, now, toIso, mapPost } = require('./_helpers');
const Comment = require('./Comment');

function authorSnippet(row) {
  if (row.author_name == null) return row.author_id;
  return {
    _id: row.author_id,
    name: row.author_name,
    avatar: row.author_avatar,
    ...(row.author_bio !== undefined ? { bio: row.author_bio } : {}),
  };
}

const Post = {
  findById(id) {
    const row = getDb().prepare('SELECT * FROM posts WHERE id = ?').get(id);
    return mapPost(row);
  },

  findBySlug(slug, { withAuthor = false, authorFields = 'name avatar' } = {}) {
    if (!withAuthor) {
      return mapPost(getDb().prepare('SELECT * FROM posts WHERE slug = ?').get(slug));
    }
    const includeBio = authorFields.includes('bio');
    const row = getDb()
      .prepare(
        `SELECT p.*, u.name AS author_name, u.avatar AS author_avatar
         ${includeBio ? ', u.bio AS author_bio' : ''}
         FROM posts p
         JOIN users u ON u.id = p.author_id
         WHERE p.slug = ?`
      )
      .get(slug);
    if (!row) return null;
    return mapPost(row, { author: authorSnippet(row) });
  },

  findOneBySlugExcluding(slug, excludeId) {
    const row = getDb()
      .prepare('SELECT id FROM posts WHERE slug = ? AND id != ?')
      .get(slug, excludeId);
    return row ? { _id: row.id } : null;
  },

  findOneBySlug(slug) {
    const row = getDb().prepare('SELECT id FROM posts WHERE slug = ?').get(slug);
    return row ? { _id: row.id } : null;
  },

  create(data) {
    const ts = now();
    const tags = JSON.stringify(data.tags || []);
    const info = getDb()
      .prepare(
        `INSERT INTO posts (
           title, slug, body, excerpt, cover_image, category, tags, author_id,
           status, published_at, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        data.title,
        data.slug,
        data.body,
        data.excerpt || '',
        data.coverImage || '',
        data.category,
        tags,
        data.author,
        data.status || 'published',
        toIso(data.publishedAt),
        ts,
        ts
      );
    return this.findById(info.lastInsertRowid);
  },

  update(id, fields) {
    const allowed = {
      title: 'title',
      slug: 'slug',
      body: 'body',
      excerpt: 'excerpt',
      coverImage: 'cover_image',
      category: 'category',
      tags: 'tags',
      status: 'status',
      publishedAt: 'published_at',
      viewsCount: 'views_count',
      likesCount: 'likes_count',
      savesCount: 'saves_count',
      bookmarksCount: 'bookmarks_count',
      commentsCount: 'comments_count',
      sharesCount: 'shares_count',
    };

    const sets = [];
    const values = [];
    for (const [key, col] of Object.entries(allowed)) {
      if (!(key in fields)) continue;
      let val = fields[key];
      if (key === 'tags') val = JSON.stringify(val || []);
      if (key === 'publishedAt') val = toIso(val);
      sets.push(`${col} = ?`);
      values.push(val);
    }
    if (!sets.length) return this.findById(id);
    sets.push('updated_at = ?');
    values.push(now());
    values.push(id);
    getDb().prepare(`UPDATE posts SET ${sets.join(', ')} WHERE id = ?`).run(...values);
    return this.findById(id);
  },

  increment(id, field, by = 1) {
    const col = {
      viewsCount: 'views_count',
      likesCount: 'likes_count',
      savesCount: 'saves_count',
      bookmarksCount: 'bookmarks_count',
      commentsCount: 'comments_count',
      sharesCount: 'shares_count',
    }[field];
    if (!col) throw new Error(`Unknown counter: ${field}`);
    getDb()
      .prepare(
        `UPDATE posts SET ${col} = MAX(0, ${col} + ?), updated_at = ? WHERE id = ?`
      )
      .run(by, now(), id);
    return this.findById(id);
  },

  delete(id) {
    const post = this.findById(id);
    if (!post) return null;
    const db = getDb();
    // comments.post_id has no ON DELETE CASCADE — remove dependents first.
    // reports cascade from comments; interactions/views/notifications cascade or SET NULL from posts.
    db.transaction(() => {
      Comment.deleteByPost(id);
      db.prepare('DELETE FROM posts WHERE id = ?').run(id);
    })();
    return post;
  },

  listPublished({ category, tag, q, limit = 12, offset = 0 } = {}) {
    const where = ["p.status = 'published'"];
    const params = [];
    if (category) {
      where.push('p.category = ?');
      params.push(category);
    }
    if (tag) {
      where.push(`EXISTS (
        SELECT 1 FROM json_each(p.tags) je WHERE lower(je.value) = lower(?)
      )`);
      params.push(tag);
    }
    if (q) {
      where.push('(p.title LIKE ? OR p.body LIKE ? OR p.tags LIKE ?)');
      const like = `%${q}%`;
      params.push(like, like, like);
    }
    const whereSql = where.join(' AND ');
    const rows = getDb()
      .prepare(
        `SELECT p.*, u.name AS author_name, u.avatar AS author_avatar
         FROM posts p
         JOIN users u ON u.id = p.author_id
         WHERE ${whereSql}
         ORDER BY p.published_at DESC
         LIMIT ? OFFSET ?`
      )
      .all(...params, Number(limit), Number(offset));

    return rows.map((row) => mapPost(row, { author: authorSnippet(row) }));
  },

  countPublished(filter = {}) {
    const where = ["status = 'published'"];
    const params = [];
    if (filter.category) {
      where.push('category = ?');
      params.push(filter.category);
    }
    if (filter.tag) {
      where.push(`EXISTS (
        SELECT 1 FROM json_each(tags) je WHERE lower(je.value) = lower(?)
      )`);
      params.push(filter.tag);
    }
    if (filter.q) {
      where.push('(title LIKE ? OR body LIKE ? OR tags LIKE ?)');
      const like = `%${filter.q}%`;
      params.push(like, like, like);
    }
    return getDb().prepare(`SELECT COUNT(*) AS c FROM posts WHERE ${where.join(' AND ')}`).get(...params).c;
  },

  listDrafts() {
    return getDb()
      .prepare(`SELECT * FROM posts WHERE status = 'draft' ORDER BY updated_at DESC`)
      .all()
      .map((r) => mapPost(r));
  },

  findByIds(ids, { status } = {}) {
    if (!ids.length) return [];
    const placeholders = ids.map(() => '?').join(',');
    const params = [...ids];
    let sql = `SELECT * FROM posts WHERE id IN (${placeholders})`;
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    return getDb()
      .prepare(sql)
      .all(...params)
      .map((r) => mapPost(r));
  },

  count(filter = {}) {
    if (filter.status) {
      return getDb().prepare('SELECT COUNT(*) AS c FROM posts WHERE status = ?').get(filter.status).c;
    }
    return getDb().prepare('SELECT COUNT(*) AS c FROM posts').get().c;
  },

  topByViews(limit = 5) {
    return getDb()
      .prepare(
        `SELECT * FROM posts WHERE status = 'published'
         ORDER BY views_count DESC LIMIT ?`
      )
      .all(Number(limit))
      .map((r) => mapPost(r));
  },

  findRelated(post, limit = 4) {
    if (!post?._id) return [];
    const tags = Array.isArray(post.tags) ? post.tags.filter(Boolean) : [];
    const tagScoreSql = tags.length
      ? `+ (
           SELECT COUNT(*) FROM json_each(p.tags) je
           WHERE lower(je.value) IN (${tags.map(() => 'lower(?)').join(',')})
         )`
      : '';
    const rows = getDb()
      .prepare(
        `SELECT p.*, u.name AS author_name, u.avatar AS author_avatar,
           (
             CASE WHEN lower(p.category) = lower(?) THEN 3 ELSE 0 END
             ${tagScoreSql}
           ) AS score
         FROM posts p
         JOIN users u ON u.id = p.author_id
         WHERE p.status = 'published' AND p.id != ?
         ORDER BY score DESC, p.published_at DESC
         LIMIT ?`
      )
      .all(post.category || '', ...tags, post._id, Number(limit));

    return rows
      .filter((r) => Number(r.score) > 0)
      .map((row) => mapPost(row, { author: authorSnippet(row) }));
  },

  listFacets() {
    const categories = getDb()
      .prepare(
        `SELECT category AS label, COUNT(*) AS count
         FROM posts WHERE status = 'published' AND category != ''
         GROUP BY lower(category)
         ORDER BY count DESC, category ASC
         LIMIT 24`
      )
      .all();
    const tags = getDb()
      .prepare(
        `SELECT lower(je.value) AS label, COUNT(*) AS count
         FROM posts p, json_each(p.tags) je
         WHERE p.status = 'published' AND trim(je.value) != ''
         GROUP BY lower(je.value)
         ORDER BY count DESC, label ASC
         LIMIT 40`
      )
      .all();
    return { categories, tags };
  },

  listForSitemap() {
    return getDb()
      .prepare(
        `SELECT id, title, slug, category, tags, cover_image, excerpt,
                published_at, updated_at
         FROM posts WHERE status = 'published'
         ORDER BY published_at DESC`
      )
      .all()
      .map((r) => mapPost(r));
  },
};

module.exports = Post;

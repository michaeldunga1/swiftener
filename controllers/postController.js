const Post = require('../models/Post');
const Interaction = require('../models/Interaction');
const { generateUniqueSlug } = require('../utils/slugify');
const { renderMarkdown, extractToc } = require('../utils/markdown');
const { readingStats } = require('../utils/reading');
const { notifySubscribersOfNewPostAsync } = require('../utils/newsletterNotify');

async function createPost(req, res, next) {
  try {
    const { title, body, excerpt, category, tags, coverImage, status } = req.body;
    if (!title || !body || !category) return res.status(400).json({ error: 'title, body, and category are required' });

    const slug = await generateUniqueSlug(title);

    const nextStatus = status === 'draft' ? 'draft' : 'published';
    const post = Post.create({
      title,
      slug,
      body,
      excerpt: excerpt || '',
      category,
      tags: Array.isArray(tags) ? tags.map((t) => t.toLowerCase().trim()) : [],
      coverImage: coverImage || '',
      author: req.user._id,
      status: nextStatus,
      publishedAt: nextStatus === 'published' ? new Date() : null,
    });

    if (nextStatus === 'published') {
      notifySubscribersOfNewPostAsync(post);
    }

    res.status(201).json({ post });
  } catch (err) {
    next(err);
  }
}

async function updatePost(req, res, next) {
  try {
    const post = Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found' });

    const { title, body, excerpt, category, tags, coverImage, status } = req.body;
    const updates = {};

    if (title && title !== post.title) {
      updates.title = title;
      updates.slug = await generateUniqueSlug(title, post._id);
    }
    if (body !== undefined) updates.body = body;
    if (excerpt !== undefined) updates.excerpt = excerpt;
    if (category !== undefined) updates.category = category;
    if (tags !== undefined) updates.tags = tags.map((t) => t.toLowerCase().trim());
    if (coverImage !== undefined) updates.coverImage = coverImage;

    if (status && status !== post.status) {
      updates.status = status;
      if (status === 'published' && !post.publishedAt) updates.publishedAt = new Date();
    }

    const updated = Post.update(post._id, updates);
    const firstPublish =
      post.status !== 'published' && updated.status === 'published' && !post.publishedAt;
    if (firstPublish) {
      notifySubscribersOfNewPostAsync(updated);
    }

    res.json({ post: updated });
  } catch (err) {
    next(err);
  }
}

async function deletePost(req, res, next) {
  try {
    const post = Post.delete(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    res.json({ message: 'Post deleted' });
  } catch (err) {
    next(err);
  }
}

async function listPosts(req, res, next) {
  try {
    const { page = 1, limit = 12, category, tag, q } = req.query;
    const filter = {
      category: category || undefined,
      tag: tag ? tag.toLowerCase() : undefined,
      q: q || undefined,
    };

    const posts = Post.listPublished({
      ...filter,
      limit: Number(limit),
      offset: (Number(page) - 1) * Number(limit),
    });
    const total = Post.countPublished(filter);
    res.json({ posts, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (err) {
    next(err);
  }
}

async function listFacets(req, res, next) {
  try {
    res.json(Post.listFacets());
  } catch (err) {
    next(err);
  }
}

async function listDrafts(req, res, next) {
  try {
    const posts = Post.listDrafts();
    res.json({ posts });
  } catch (err) {
    next(err);
  }
}

async function getPostBySlug(req, res, next) {
  try {
    const post = Post.findBySlug(req.params.slug, {
      withAuthor: true,
      authorFields: 'name avatar bio',
    });
    if (!post || (post.status !== 'published' && req.user?.role !== 'admin')) {
      return res.status(404).json({ error: 'Post not found' });
    }

    post.renderedBody = renderMarkdown(post.body);
    const reading = readingStats(post.body);
    const toc = extractToc(post.body);
    const related = Post.findRelated(post, 4);

    let viewerState = { liked: false, saved: false, bookmarked: false };
    if (req.user) {
      const interactions = Interaction.find({ user: req.user._id, post: post._id });
      viewerState = {
        liked: interactions.some((i) => i.type === 'like'),
        saved: interactions.some((i) => i.type === 'save'),
        bookmarked: interactions.some((i) => i.type === 'bookmark'),
      };
    }

    res.json({ post, viewerState, reading, toc, related });
  } catch (err) {
    next(err);
  }
}

async function getAdminPost(req, res, next) {
  try {
    const post = Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    res.json({ post });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createPost,
  updatePost,
  deletePost,
  listPosts,
  listFacets,
  listDrafts,
  getPostBySlug,
  getAdminPost,
};

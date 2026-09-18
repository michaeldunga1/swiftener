const crypto = require('crypto');
const Post = require('../models/Post');
const Interaction = require('../models/Interaction');
const View = require('../models/View');
const Notification = require('../models/Notification');

const COUNT_FIELD = { like: 'likesCount', save: 'savesCount', bookmark: 'bookmarksCount' };
const { postPath } = require('../utils/postPath');

function toggleInteraction(type) {
  return async function (req, res, next) {
    try {
      const { postId } = req.params;
      const post = Post.findById(postId);
      if (!post) return res.status(404).json({ error: 'Post not found' });

      const existing = Interaction.findOne({ user: req.user._id, post: postId, type });

      if (existing) {
        Interaction.delete(existing._id);
        const updated = Post.increment(post._id, COUNT_FIELD[type], -1);
        return res.json({ active: false, [`${type}sCount`]: updated[COUNT_FIELD[type]] });
      }

      Interaction.create({ user: req.user._id, post: postId, type });
      const updated = Post.increment(post._id, COUNT_FIELD[type], 1);

      if (type === 'like' && String(post.author) !== String(req.user._id)) {
        Notification.createAsync({
          recipient: post.author,
          type: 'like',
          message: `${req.user.name} liked "${post.title}"`,
          link: postPath(post),
          relatedPost: post._id,
        }).catch((e) => console.error('[notification] create failed', e.message));
      }

      res.json({ active: true, [`${type}sCount`]: updated[COUNT_FIELD[type]] });
    } catch (err) {
      next(err);
    }
  };
}

async function sharePost(req, res, next) {
  try {
    const post = Post.increment(req.params.postId, 'sharesCount', 1);
    if (!post) return res.status(404).json({ error: 'Post not found' });

    const url = `${process.env.FRONTEND_URL}${postPath(post)}`;
    res.json({
      sharesCount: post.sharesCount,
      shareLinks: {
        whatsapp: `https://wa.me/?text=${encodeURIComponent(post.title + ' ' + url)}`,
        twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(post.title)}&url=${encodeURIComponent(url)}`,
        facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
        email: `mailto:?subject=${encodeURIComponent(post.title)}&body=${encodeURIComponent(url)}`,
        link: url,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function trackView(req, res, next) {
  try {
    const post = Post.findById(req.params.postId);
    if (!post) return res.status(404).json({ error: 'Post not found' });

    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
    const ipHash = crypto.createHash('sha256').update(ip + (process.env.JWT_SECRET || 'salt')).digest('hex');

    const windowHours = Number(process.env.VIEW_DEDUPE_WINDOW_HOURS || 12);
    const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);

    const alreadyViewed = View.findRecentDupe(
      req.user
        ? { post: post._id, user: req.user._id, since }
        : { post: post._id, ipHash, since }
    );

    View.create({
      post: post._id,
      user: req.user?._id || null,
      ipHash,
      userAgent: req.headers['user-agent'] || '',
      referrer: req.headers.referer || '',
    });

    let viewsCount = post.viewsCount;
    if (!alreadyViewed) {
      const updated = Post.increment(post._id, 'viewsCount', 1);
      viewsCount = updated.viewsCount;
    }

    res.json({ viewsCount, countedAsUnique: !alreadyViewed });
  } catch (err) {
    next(err);
  }
}

module.exports = { toggleInteraction, sharePost, trackView };

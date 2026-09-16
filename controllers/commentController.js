const Comment = require('../models/Comment');
const Report = require('../models/Report');
const Post = require('../models/Post');
const Notification = require('../models/Notification');
const { isUniqueViolation } = require('../config/db');

const REPORT_HIDE_THRESHOLD = 5;

async function createComment(req, res, next) {
  try {
    const { postId } = req.params;
    const { body, parentComment } = req.body;
    if (!body || !body.trim()) return res.status(400).json({ error: 'Comment body is required' });

    const post = Post.findById(postId);
    if (!post) return res.status(404).json({ error: 'Post not found' });

    const comment = Comment.create({
      post: postId,
      user: req.user._id,
      body: body.trim(),
      parentComment: parentComment || null,
    });

    Post.increment(post._id, 'commentsCount', 1);

    if (String(post.author) !== String(req.user._id)) {
      Notification.createAsync({
        recipient: post.author,
        type: 'comment',
        message: `${req.user.name} commented on "${post.title}"`,
        link: `/posts/${post.slug}#comment-${comment._id}`,
        relatedPost: post._id,
        relatedComment: comment._id,
      }).catch((e) => console.error('[notification] create failed', e.message));
    }

    res.status(201).json({ comment });
  } catch (err) {
    next(err);
  }
}

async function listComments(req, res, next) {
  try {
    const comments = Comment.listForPost(req.params.postId, {
      includeHidden: req.user?.role === 'admin',
    });
    res.json({ comments });
  } catch (err) {
    next(err);
  }
}

async function deleteComment(req, res, next) {
  try {
    const comment = Comment.findById(req.params.id);
    if (!comment) return res.status(404).json({ error: 'Comment not found' });

    const isOwner = String(comment.user) === String(req.user._id);
    if (!isOwner && req.user.role !== 'admin') return res.status(403).json({ error: 'Not allowed' });

    Comment.update(comment._id, { isDeleted: true, body: '[deleted]' });
    Post.increment(comment.post, 'commentsCount', -1);

    res.json({ message: 'Comment deleted' });
  } catch (err) {
    next(err);
  }
}

async function reportComment(req, res, next) {
  try {
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ error: 'A reason is required' });

    const comment = Comment.findById(req.params.id);
    if (!comment) return res.status(404).json({ error: 'Comment not found' });

    const report = Report.create({
      comment: comment._id,
      reportedBy: req.user._id,
      reason,
    });

    const reportCount = comment.reportCount + 1;
    Comment.update(comment._id, {
      reportCount,
      isHidden: reportCount >= REPORT_HIDE_THRESHOLD,
    });

    res.status(201).json({ report });
  } catch (err) {
    if (isUniqueViolation(err) || err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'You already reported this comment' });
    }
    next(err);
  }
}

module.exports = { createComment, listComments, deleteComment, reportComment };

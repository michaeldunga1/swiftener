const User = require('../models/User');
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const Report = require('../models/Report');
const Interaction = require('../models/Interaction');
const { v4: uuidv4 } = require('uuid');
const { sendInviteEmail } = require('../utils/email');

async function dashboardStats(req, res, next) {
  try {
    const totalPosts = Post.count();
    const publishedPosts = Post.count({ status: 'published' });
    const draftPosts = Post.count({ status: 'draft' });
    const totalUsers = User.count();
    const totalComments = Comment.count({ isDeleted: false });
    const pendingReports = Report.count({ status: 'pending' });

    const topPosts = Post.topByViews(5).map((p) => ({
      _id: p._id,
      title: p.title,
      slug: p.slug,
      viewsCount: p.viewsCount,
      likesCount: p.likesCount,
      commentsCount: p.commentsCount,
    }));

    const recentUsers = User.recent(5).map((u) => ({
      _id: u._id,
      name: u.name,
      email: u.email,
      createdAt: u.createdAt,
    }));

    res.json({
      totals: { totalPosts, publishedPosts, draftPosts, totalUsers, totalComments, pendingReports },
      topPosts,
      recentUsers,
    });
  } catch (err) {
    next(err);
  }
}

async function listUsers(req, res, next) {
  try {
    const { page = 1, limit = 20, q } = req.query;
    const users = User.list({
      q,
      limit: Number(limit),
      offset: (Number(page) - 1) * Number(limit),
    });
    const total = User.count({ q });
    res.json({ users, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
}

async function makeAdmin(req, res, next) {
  try {
    const user = User.update(req.params.id, { role: 'admin' });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch (err) {
    next(err);
  }
}

async function revokeAdmin(req, res, next) {
  try {
    const user = User.update(req.params.id, { role: 'user' });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch (err) {
    next(err);
  }
}

async function blockUser(req, res, next) {
  try {
    const user = User.update(req.params.id, { isBlocked: true });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch (err) {
    next(err);
  }
}

async function unblockUser(req, res, next) {
  try {
    const user = User.update(req.params.id, { isBlocked: false });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch (err) {
    next(err);
  }
}

async function suspendUser(req, res, next) {
  try {
    const { untilDate } = req.body;
    const user = User.update(req.params.id, {
      isSuspended: true,
      suspendedUntil: untilDate ? new Date(untilDate) : null,
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch (err) {
    next(err);
  }
}

async function unsuspendUser(req, res, next) {
  try {
    const user = User.update(req.params.id, { isSuspended: false, suspendedUntil: null });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch (err) {
    next(err);
  }
}

async function deleteUser(req, res, next) {
  try {
    const user = User.delete(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    Comment.updateManyByUser(user._id, { isDeleted: true, body: '[deleted user]' });
    Interaction.deleteManyByUser(user._id);
    res.json({ message: 'User deleted' });
  } catch (err) {
    next(err);
  }
}

async function inviteUser(req, res, next) {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });
    const inviteToken = uuidv4();
    const inviteUrl = `${process.env.FRONTEND_URL}/register?invite=${inviteToken}&email=${encodeURIComponent(email)}`;
    await sendInviteEmail(email, inviteUrl, req.user.name);
    res.json({ message: 'Invite sent' });
  } catch (err) {
    next(err);
  }
}

async function listPendingReports(req, res, next) {
  try {
    const reports = Report.listPending();
    res.json({ reports });
  } catch (err) {
    next(err);
  }
}

async function resolveReport(req, res, next) {
  try {
    const { action } = req.body;
    const report = Report.findById(req.params.id);
    if (!report) return res.status(404).json({ error: 'Report not found' });

    if (action === 'hide') {
      Comment.update(report.comment, { isHidden: true });
      Report.updateManyByComment(report.comment, { status: 'reviewed' });
    } else {
      Report.update(report._id, { status: 'dismissed' });
    }

    res.json({ message: 'Report resolved' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  dashboardStats,
  listUsers,
  makeAdmin,
  revokeAdmin,
  blockUser,
  unblockUser,
  suspendUser,
  unsuspendUser,
  deleteUser,
  inviteUser,
  listPendingReports,
  resolveReport,
};

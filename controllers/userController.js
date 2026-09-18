const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const User = require('../models/User');
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const Interaction = require('../models/Interaction');
const View = require('../models/View');
const { sendInviteEmail } = require('../utils/email');

async function getMyProfile(req, res, next) {
  try {
    const { password, verifyToken, resetToken, resetTokenExpiry, ...safe } = req.user;
    res.json({ user: safe });
  } catch (err) {
    next(err);
  }
}

async function getPublicProfile(req, res, next) {
  try {
    const key = String(req.params.usernameOrId || '').trim();
    if (!key) return res.status(404).json({ error: 'User not found' });

    let user = null;
    let lookedUpById = false;
    if (/^\d+$/.test(key)) {
      user = User.findById(key);
      lookedUpById = true;
    } else {
      user = User.findByUsername(key);
    }
    if (!user) return res.status(404).json({ error: 'User not found' });

    const payload = {
      _id: user._id,
      name: user.name,
      username: user.username,
      avatar: user.avatar,
      bio: user.bio,
    };
    if (req.user?.role === 'admin') {
      payload.createdAt = user.createdAt;
    }
    if (lookedUpById && user.username && String(user.username) !== key) {
      payload.canonicalPath = `/users/${user.username}`;
    }
    res.json({ user: payload });
  } catch (err) {
    next(err);
  }
}

async function updateProfile(req, res, next) {
  try {
    const { name, bio, avatar, username } = req.body;
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (bio !== undefined) updates.bio = bio;
    if (avatar !== undefined) updates.avatar = avatar;
    if (username !== undefined) updates.username = username;

    const user = User.update(req.user._id, updates);
    const { password, verifyToken, resetToken, resetTokenExpiry, ...safe } = user;
    res.json({ user: safe });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    next(err);
  }
}

async function changePassword(req, res, next) {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Both current and new password are required' });
    if (newPassword.length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters' });

    const user = User.findById(req.user._id, { includePassword: true });
    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) return res.status(401).json({ error: 'Current password is incorrect' });

    User.update(user._id, { password: await bcrypt.hash(newPassword, 12) });
    res.json({ message: 'Password updated' });
  } catch (err) {
    next(err);
  }
}

async function myInteractedPosts(req, res, next) {
  try {
    const { type } = req.params;
    if (!['save', 'bookmark', 'like'].includes(type)) return res.status(400).json({ error: 'Invalid type' });

    const interactions = Interaction.find({ user: req.user._id, type });
    const postIds = interactions.map((i) => i.post);
    const posts = Post.findByIds(postIds, { status: 'published' }).map((p) => ({
      _id: p._id,
      title: p.title,
      slug: p.slug,
      excerpt: p.excerpt,
      coverImage: p.coverImage,
      category: p.category,
      tags: p.tags,
      viewsCount: p.viewsCount,
      likesCount: p.likesCount,
      publishedAt: p.publishedAt,
    }));

    const order = new Map(postIds.map((id, idx) => [String(id), idx]));
    posts.sort((a, b) => order.get(String(a._id)) - order.get(String(b._id)));

    res.json({ posts });
  } catch (err) {
    next(err);
  }
}

async function inviteFriend(req, res, next) {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });
    const inviteToken = uuidv4();
    const inviteUrl = `${process.env.FRONTEND_URL}/register?invite=${inviteToken}&email=${encodeURIComponent(email)}`;
    await sendInviteEmail(email, inviteUrl, req.user.name);
    res.json({ message: 'Invite sent', shareUrl: inviteUrl });
  } catch (err) {
    next(err);
  }
}

async function postAnalytics(req, res, next) {
  try {
    const post = Post.findById(req.params.postId);
    if (!post) return res.status(404).json({ error: 'Post not found' });

    const viewsByDay = View.viewsByDay(post._id);

    res.json({
      post: {
        title: post.title,
        slug: post.slug,
        viewsCount: post.viewsCount,
        likesCount: post.likesCount,
        savesCount: post.savesCount,
        bookmarksCount: post.bookmarksCount,
        commentsCount: post.commentsCount,
        sharesCount: post.sharesCount,
      },
      viewsByDay,
    });
  } catch (err) {
    next(err);
  }
}

async function myProfileAnalytics(req, res, next) {
  try {
    const commentsCount = Comment.count({ user: req.user._id, isDeleted: false });
    const likesGiven = Interaction.count({ user: req.user._id, type: 'like' });
    const savesCount = Interaction.count({ user: req.user._id, type: 'save' });
    const bookmarksCount = Interaction.count({ user: req.user._id, type: 'bookmark' });
    res.json({ commentsCount, likesGiven, savesCount, bookmarksCount, memberSince: req.user.createdAt });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getMyProfile,
  getPublicProfile,
  updateProfile,
  changePassword,
  myInteractedPosts,
  inviteFriend,
  postAnalytics,
  myProfileAnalytics,
};

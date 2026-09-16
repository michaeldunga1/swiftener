const Notification = require('../models/Notification');

async function listMyNotifications(req, res, next) {
  try {
    const { page = 1, limit = 20 } = req.query;
    const notifications = Notification.listForUser(req.user._id, {
      limit: Number(limit),
      offset: (Number(page) - 1) * Number(limit),
    });
    const unreadCount = Notification.countUnread(req.user._id);
    res.json({ notifications, unreadCount });
  } catch (err) {
    next(err);
  }
}

async function markAsRead(req, res, next) {
  try {
    const notification = Notification.markRead(req.params.id, req.user._id);
    if (!notification) return res.status(404).json({ error: 'Notification not found' });
    res.json({ notification });
  } catch (err) {
    next(err);
  }
}

async function markAllAsRead(req, res, next) {
  try {
    Notification.markAllRead(req.user._id);
    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    next(err);
  }
}

module.exports = { listMyNotifications, markAsRead, markAllAsRead };

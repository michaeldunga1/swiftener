const jwt = require('jsonwebtoken');
const User = require('../models/User');

async function requireAuth(req, res, next) {
  try {
    const cookieName = process.env.COOKIE_NAME || 'sw_token';
    const token =
      req.cookies?.[cookieName] ||
      (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null);

    if (!token) return res.status(401).json({ error: 'Not authenticated' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = User.findById(decoded.id);
    if (!user) return res.status(401).json({ error: 'Not authenticated' });
    if (user.isBlocked) return res.status(403).json({ error: 'Account blocked' });

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
}

async function attachUserIfPresent(req, res, next) {
  try {
    const cookieName = process.env.COOKIE_NAME || 'sw_token';
    const token =
      req.cookies?.[cookieName] ||
      (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null);
    if (!token) return next();
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = User.findById(decoded.id);
    if (user && !user.isBlocked) req.user = user;
    next();
  } catch {
    next();
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

function requireActiveForEngagement(req, res, next) {
  if (!req.user.isActiveForEngagement()) {
    return res.status(403).json({ error: 'Your account is currently restricted from this action' });
  }
  next();
}

module.exports = { requireAuth, attachUserIfPresent, requireAdmin, requireActiveForEngagement };

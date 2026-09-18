const jwt = require('jsonwebtoken');
const User = require('../models/User');

function readToken(req) {
  const cookieName = process.env.COOKIE_NAME || 'sw_token';
  return (
    req.cookies?.[cookieName] ||
    (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null)
  );
}

function getUserFromRequest(req) {
  const token = readToken(req);
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = User.findById(decoded.id);
    if (!user || user.isBlocked) return null;
    return user;
  } catch {
    return null;
  }
}

async function requireAuth(req, res, next) {
  try {
    const token = readToken(req);
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
    const user = getUserFromRequest(req);
    if (user) req.user = user;
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

module.exports = {
  getUserFromRequest,
  requireAuth,
  attachUserIfPresent,
  requireAdmin,
  requireActiveForEngagement,
};

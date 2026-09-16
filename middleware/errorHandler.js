const { isUniqueViolation } = require('../config/db');
const ErrorLog = require('../models/ErrorLog');

function clientIp(req) {
  const xf = req.headers['x-forwarded-for'];
  if (xf) return String(xf).split(',')[0].trim();
  return req.socket?.remoteAddress || req.ip || '';
}

function logRequestError(err, req, status) {
  ErrorLog.create({
    source: 'server',
    level: 'error',
    message: err.message || 'Server error',
    stack: err.stack || '',
    statusCode: status,
    method: req.method,
    path: req.originalUrl || req.url || '',
    fullUrl: `${req.protocol}://${req.get('host') || ''}${req.originalUrl || ''}`,
    ip: clientIp(req),
    userAgent: req.headers['user-agent'] || '',
    referrer: req.headers.referer || '',
    userId: req.user?._id || null,
    meta: {
      code: err.code || null,
      name: err.name || null,
    },
  });
}

function notFound(req, res, next) {
  res.status(404).json({ error: 'Route not found' });
}

function errorHandler(err, req, res, next) {
  console.error(err);
  const status = err.status || 500;

  if (err.code === 11000 || isUniqueViolation(err)) {
    logRequestError(err, req, 409);
    return res.status(409).json({ error: 'Duplicate value' });
  }

  // Log 4xx/5xx that go through this handler (not intentional 401/404 from controllers)
  if (status >= 400) {
    logRequestError(err, req, status);
  }

  res.status(status).json({ error: err.message || 'Server error' });
}

module.exports = { notFound, errorHandler, clientIp };

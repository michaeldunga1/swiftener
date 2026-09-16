const PageLoad = require('../models/PageLoad');
const ErrorLog = require('../models/ErrorLog');
const { clientIp } = require('../middleware/errorHandler');

async function trackPageLoad(req, res, next) {
  try {
    const body = req.body || {};
    const path = String(body.path || req.query.path || '/').slice(0, 500);
    // Skip noisy internal paths if ever posted
    if (path.startsWith('/api/')) return res.status(204).end();

    PageLoad.create({
      path,
      fullUrl: String(body.fullUrl || '').slice(0, 1000),
      queryString: String(body.queryString || '').slice(0, 500),
      referrer: String(body.referrer || req.headers.referer || '').slice(0, 500),
      ip: clientIp(req),
      userAgent: String(req.headers['user-agent'] || body.userAgent || '').slice(0, 1000),
      acceptLanguage: String(req.headers['accept-language'] || '').slice(0, 200),
      language: String(body.language || '').slice(0, 64),
      platform: String(body.platform || '').slice(0, 128),
      screenWidth: Number.isFinite(Number(body.screenWidth)) ? Number(body.screenWidth) : null,
      screenHeight: Number.isFinite(Number(body.screenHeight)) ? Number(body.screenHeight) : null,
      viewportWidth: Number.isFinite(Number(body.viewportWidth)) ? Number(body.viewportWidth) : null,
      viewportHeight: Number.isFinite(Number(body.viewportHeight)) ? Number(body.viewportHeight) : null,
      timezone: String(body.timezone || '').slice(0, 64),
      userId: req.user?._id || null,
    });

    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

async function reportClientError(req, res, next) {
  try {
    const body = req.body || {};
    // Avoid logging our own reporter failures in a loop
    const path = String(body.path || '').slice(0, 500);
    if (path.includes('/api/analytics/error')) return res.status(204).end();

    ErrorLog.create({
      source: 'client',
      level: body.level === 'warn' ? 'warn' : 'error',
      message: body.message || 'Client error',
      stack: body.stack || '',
      statusCode: null,
      method: 'CLIENT',
      path,
      fullUrl: String(body.fullUrl || '').slice(0, 1000),
      ip: clientIp(req),
      userAgent: String(req.headers['user-agent'] || body.userAgent || '').slice(0, 500),
      referrer: String(body.referrer || req.headers.referer || '').slice(0, 500),
      userId: req.user?._id || null,
      meta: {
        type: body.type || 'error',
        filename: body.filename || null,
        lineno: body.lineno ?? null,
        colno: body.colno ?? null,
      },
    });

    res.status(204).end();
  } catch (err) {
    // Never fail the client for logging
    res.status(204).end();
  }
}

module.exports = { trackPageLoad, reportClientError };

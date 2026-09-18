const { getUserFromRequest } = require('./auth');

const TIMESTAMP_KEYS = new Set(['createdAt', 'updatedAt', 'created_at', 'updated_at']);

function stripTimestampsDeep(value) {
  if (Array.isArray(value)) return value.map(stripTimestampsDeep);
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (TIMESTAMP_KEYS.has(k)) continue;
      out[k] = stripTimestampsDeep(v);
    }
    return out;
  }
  return value;
}

function hideTimestampsFromNonAdmins(req, res, next) {
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    const user = req.user || getUserFromRequest(req);
    if (user?.role === 'admin') return originalJson(body);
    return originalJson(stripTimestampsDeep(body));
  };
  next();
}

module.exports = { hideTimestampsFromNonAdmins, stripTimestampsDeep };

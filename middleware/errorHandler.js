const { isUniqueViolation } = require('../config/db');

function notFound(req, res, next) {
  res.status(404).json({ error: 'Route not found' });
}

function errorHandler(err, req, res, next) {
  console.error(err);
  const status = err.status || 500;
  if (err.code === 11000 || isUniqueViolation(err)) {
    return res.status(409).json({ error: 'Duplicate value' });
  }
  res.status(status).json({ error: err.message || 'Server error' });
}

module.exports = { notFound, errorHandler };

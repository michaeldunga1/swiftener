const jwt = require('jsonwebtoken');

function signToken(userId) {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });
}

function setAuthCookie(res, token) {
  const secure = process.env.NODE_ENV === 'production';
  res.cookie(process.env.COOKIE_NAME || 'sw_token', token, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

function clearAuthCookie(res) {
  const name = process.env.COOKIE_NAME || 'sw_token';
  res.clearCookie(name, { path: '/', httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' });
}

module.exports = { signToken, setAuthCookie, clearAuthCookie };

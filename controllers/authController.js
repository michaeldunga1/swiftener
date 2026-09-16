const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const User = require('../models/User');
const { sendResetPasswordEmail, sendVerifyEmail } = require('../utils/email');
const { signToken, setAuthCookie, clearAuthCookie } = require('../utils/session');
const {
  createState,
  setOAuthCookies,
  verifyStateCookie,
  getStoredRedirectUri,
  clearOAuthCookies,
  providersConfigured,
  callbackUrl,
  buildGoogleAuthUrl,
  buildGithubAuthUrl,
  exchangeGoogleCode,
  exchangeGithubCode,
  getPublicOrigin,
} = require('../utils/oauth');

function oauthRedirect(req, res, path) {
  const base = getPublicOrigin(req);
  res.redirect(`${base}${path}`);
}

function findOrCreateOAuthUser(provider, profile) {
  const idField = provider === 'google' ? 'googleId' : 'githubId';
  const lookup = provider === 'google' ? { googleId: profile.providerId } : { githubId: profile.providerId };

  let user = User.findOne(lookup);
  if (user) {
    if (user.isBlocked) return { error: 'blocked', user: null };
    const updates = { lastLoginAt: new Date() };
    if (profile.avatar && !user.avatar) updates.avatar = profile.avatar;
    User.update(user._id, updates);
    return { user: User.findById(user._id), error: null };
  }

  if (profile.email) {
    user = User.findOne({ email: profile.email });
    if (user) {
      if (user.isBlocked) return { error: 'blocked', user: null };
      const link = { lastLoginAt: new Date(), isVerified: true };
      link[idField] = profile.providerId;
      if (profile.avatar && !user.avatar) link.avatar = profile.avatar;
      User.update(user._id, link);
      return { user: User.findById(user._id), error: null };
    }
  }

  if (!profile.email) {
    return { error: 'no_email', user: null };
  }

  const password = bcrypt.hashSync(crypto.randomBytes(32).toString('hex'), 12);
  const createFields = {
    name: profile.name,
    email: profile.email,
    password,
    avatar: profile.avatar || '',
    isVerified: true,
  };
  createFields[idField] = profile.providerId;
  user = User.create(createFields);
  return { user, error: null };
}

function loginOAuthUser(res, user) {
  const token = signToken(user._id);
  setAuthCookie(res, token);
}

async function register(req, res, next) {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'Name, email, and password are required' });
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

    const existing = User.findOne({ email: email.toLowerCase() });
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const hashed = await bcrypt.hash(password, 12);
    const verifyToken = uuidv4();

    const user = User.create({
      name,
      email: email.toLowerCase(),
      password: hashed,
      verifyToken,
    });

    const verifyUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verifyToken}`;
    sendVerifyEmail(user.email, verifyUrl).catch((e) => console.error('[email] verify send failed', e.message));

    loginOAuthUser(res, user);

    res.status(201).json({
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    next(err);
  }
}

async function verifyEmail(req, res, next) {
  try {
    const { token } = req.query;
    const user = User.findOne({ verifyToken: token }, { includeSecrets: true });
    if (!user) return res.status(400).json({ error: 'Invalid or expired verification link' });
    User.update(user._id, { isVerified: true, verifyToken: null });
    res.json({ message: 'Email verified' });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

    const user = User.findOne({ email: email.toLowerCase() }, { includeSecrets: true });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    if (user.isBlocked) return res.status(403).json({ error: 'This account has been blocked' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });

    User.update(user._id, { lastLoginAt: new Date() });
    loginOAuthUser(res, user);

    res.json({ user: { id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    next(err);
  }
}

function logout(req, res) {
  clearAuthCookie(res);
  res.json({ message: 'Logged out' });
}

function authProviders(req, res) {
  res.json(providersConfigured(req));
}

function startGoogle(req, res) {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.status(503).json({ error: 'Google login is not configured' });
  }
  const state = createState();
  const redirectUri = callbackUrl('google', req);
  setOAuthCookies(res, state, redirectUri);
  res.redirect(buildGoogleAuthUrl(state, redirectUri));
}

async function googleCallback(req, res, next) {
  try {
    const { code, state, error } = req.query;
    const redirectUri = getStoredRedirectUri(req) || callbackUrl('google', req);
    clearOAuthCookies(res);
    if (error) return oauthRedirect(req, res, `/login?error=${encodeURIComponent(String(error))}`);
    if (!verifyStateCookie(req, state)) return oauthRedirect(req, res, '/login?error=invalid_state');
    if (!code) return oauthRedirect(req, res, '/login?error=missing_code');

    const profile = await exchangeGoogleCode(String(code), redirectUri);
    const { user, error: authError } = findOrCreateOAuthUser('google', profile);
    if (authError === 'blocked') return oauthRedirect(req, res, '/login?error=blocked');
    if (authError === 'no_email') return oauthRedirect(req, res, '/login?error=no_email');

    loginOAuthUser(res, user);
    oauthRedirect(req, res, '/');
  } catch (err) {
    next(err);
  }
}

function startGithub(req, res) {
  if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET) {
    return res.status(503).json({ error: 'GitHub login is not configured' });
  }
  const state = createState();
  const redirectUri = callbackUrl('github', req);
  setOAuthCookies(res, state, redirectUri);
  res.redirect(buildGithubAuthUrl(state, redirectUri));
}

async function githubCallback(req, res, next) {
  try {
    const { code, state, error, error_description: errorDescription } = req.query;
    const redirectUri = getStoredRedirectUri(req) || callbackUrl('github', req);
    clearOAuthCookies(res);
    if (error) {
      return oauthRedirect(req, res, `/login?error=${encodeURIComponent(String(errorDescription || error))}`);
    }
    if (!verifyStateCookie(req, state)) return oauthRedirect(req, res, '/login?error=invalid_state');
    if (!code) return oauthRedirect(req, res, '/login?error=missing_code');

    const profile = await exchangeGithubCode(String(code), redirectUri);
    const { user, error: authError } = findOrCreateOAuthUser('github', profile);
    if (authError === 'blocked') return oauthRedirect(req, res, '/login?error=blocked');
    if (authError === 'no_email') return oauthRedirect(req, res, '/login?error=no_email');

    loginOAuthUser(res, user);
    oauthRedirect(req, res, '/');
  } catch (err) {
    next(err);
  }
}

async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body;
    const user = User.findOne({ email: (email || '').toLowerCase() });
    if (!user) return res.json({ message: 'If that email exists, a reset link has been sent' });

    const resetToken = crypto.randomBytes(32).toString('hex');
    User.update(user._id, {
      resetToken: crypto.createHash('sha256').update(resetToken).digest('hex'),
      resetTokenExpiry: new Date(Date.now() + 60 * 60 * 1000),
    });

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    sendResetPasswordEmail(user.email, resetUrl).catch((e) => console.error('[email] reset send failed', e.message));

    res.json({ message: 'If that email exists, a reset link has been sent' });
  } catch (err) {
    next(err);
  }
}

async function resetPassword(req, res, next) {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) return res.status(400).json({ error: 'Token and new password are required' });
    if (newPassword.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const user = User.findOne(
      { resetToken: hashedToken, resetTokenExpiryGt: new Date() },
      { includeSecrets: true }
    );

    if (!user) return res.status(400).json({ error: 'Invalid or expired reset link' });

    User.update(user._id, {
      password: await bcrypt.hash(newPassword, 12),
      resetToken: null,
      resetTokenExpiry: null,
    });

    res.json({ message: 'Password reset successful. You can now log in.' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  register,
  verifyEmail,
  login,
  logout,
  forgotPassword,
  resetPassword,
  authProviders,
  startGoogle,
  googleCallback,
  startGithub,
  githubCallback,
};

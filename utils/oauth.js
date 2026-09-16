const crypto = require('crypto');

const STATE_COOKIE = 'oauth_state';
const REDIRECT_URI_COOKIE = 'oauth_redirect_uri';
const STATE_TTL_MS = 10 * 60 * 1000;

/** Public site origin used in OAuth redirect_uri (must match Google/GitHub console exactly). */
function getPublicOrigin(req) {
  if (process.env.OAUTH_PUBLIC_ORIGIN) {
    return process.env.OAUTH_PUBLIC_ORIGIN.replace(/\/$/, '');
  }
  if (process.env.FRONTEND_URL) {
    return process.env.FRONTEND_URL.replace(/\/$/, '');
  }
  if (req) {
    const proto = String(req.get('x-forwarded-proto') || req.protocol || 'https')
      .split(',')[0]
      .trim();
    const host = req.get('x-forwarded-host') || req.get('host');
    if (host) return `${proto}://${host}`.replace(/\/$/, '');
  }
  return 'http://localhost:4000';
}

function callbackUrl(provider, req) {
  const envKey = provider === 'google' ? 'GOOGLE_REDIRECT_URI' : 'GITHUB_REDIRECT_URI';
  if (process.env[envKey]) return process.env[envKey].replace(/\/$/, '');
  // Must match GitHub/Google console (e.g. https://swiftener.com/auth/github/callback)
  return `${getPublicOrigin(req)}/auth/${provider}/callback`;
}

function createState() {
  return crypto.randomBytes(24).toString('hex');
}

function setOAuthCookies(res, state, redirectUri) {
  const opts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: STATE_TTL_MS,
  };
  res.cookie(STATE_COOKIE, state, opts);
  res.cookie(REDIRECT_URI_COOKIE, redirectUri, opts);
}

function verifyStateCookie(req, state) {
  const expected = req.cookies?.[STATE_COOKIE];
  return expected && state && expected === state;
}

function getStoredRedirectUri(req) {
  return req.cookies?.[REDIRECT_URI_COOKIE] || null;
}

function clearOAuthCookies(res) {
  res.clearCookie(STATE_COOKIE);
  res.clearCookie(REDIRECT_URI_COOKIE);
}

function providersConfigured(req) {
  const origin = getPublicOrigin(req);
  return {
    google: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    github: Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),
    redirectUris: {
      google: `${origin}/auth/google/callback`,
      github: `${origin}/auth/github/callback`,
    },
    publicOrigin: origin,
  };
}

function buildGoogleAuthUrl(state, redirectUri) {
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', process.env.GOOGLE_CLIENT_ID);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid email profile');
  url.searchParams.set('state', state);
  url.searchParams.set('access_type', 'online');
  url.searchParams.set('prompt', 'select_account');
  return url.toString();
}

function buildGithubAuthUrl(state, redirectUri) {
  const url = new URL('https://github.com/login/oauth/authorize');
  url.searchParams.set('client_id', process.env.GITHUB_CLIENT_ID);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('scope', 'read:user user:email');
  url.searchParams.set('state', state);
  return url.toString();
}

async function exchangeGoogleCode(code, redirectUri) {
  const body = new URLSearchParams({
    code,
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const tokenData = await tokenRes.json();
  if (!tokenRes.ok) throw new Error(tokenData.error_description || tokenData.error || 'Google token exchange failed');

  const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const profile = await profileRes.json();
  if (!profileRes.ok) throw new Error('Google profile fetch failed');

  return {
    providerId: String(profile.id),
    email: profile.email?.toLowerCase() || null,
    name: profile.name || profile.email?.split('@')[0] || 'User',
    avatar: profile.picture || '',
  };
}

async function exchangeGithubCode(code, redirectUri) {
  const body = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID,
    client_secret: process.env.GITHUB_CLIENT_SECRET,
    code,
    redirect_uri: redirectUri,
  });
  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body,
  });
  const tokenData = await tokenRes.json();
  if (!tokenRes.ok || tokenData.error) {
    throw new Error(tokenData.error_description || tokenData.error || 'GitHub token exchange failed');
  }

  const headers = {
    Authorization: `Bearer ${tokenData.access_token}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'Swiftener-Blog',
  };

  const profileRes = await fetch('https://api.github.com/user', { headers });
  const profile = await profileRes.json();
  if (!profileRes.ok) throw new Error('GitHub profile fetch failed');

  let email = profile.email?.toLowerCase() || null;
  if (!email) {
    const emailsRes = await fetch('https://api.github.com/user/emails', { headers });
    const emails = await emailsRes.json();
    if (emailsRes.ok && Array.isArray(emails)) {
      const primary = emails.find((e) => e.primary && e.verified) || emails.find((e) => e.verified);
      email = primary?.email?.toLowerCase() || null;
    }
  }

  return {
    providerId: String(profile.id),
    email,
    name: profile.name || profile.login || 'User',
    avatar: profile.avatar_url || '',
  };
}

module.exports = {
  STATE_COOKIE,
  getPublicOrigin,
  callbackUrl,
  createState,
  setOAuthCookies,
  verifyStateCookie,
  getStoredRedirectUri,
  clearOAuthCookies,
  providersConfigured,
  buildGoogleAuthUrl,
  buildGithubAuthUrl,
  exchangeGoogleCode,
  exchangeGithubCode,
};

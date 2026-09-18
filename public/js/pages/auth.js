import { api } from '../api.js';
import { escapeHtml, getQuery, toast, passwordInput, initPasswordToggles } from '../ui.js';
import { navigate } from '../router.js';
import { refreshUser } from '../state.js';
import { setNoIndex } from '../seo.js';

function authPanel(title, bodyHtml) {
  setNoIndex(title);
  return `
    <div class="panel auth-panel">
      <h2>${escapeHtml(title)}</h2>
      ${bodyHtml}
    </div>
  `;
}

async function oauthButtonsHtml() {
  try {
    const providers = await api.get('/auth/providers');
    const parts = [];
    if (providers.google) {
      parts.push('<a class="btn btn-oauth btn-google" href="/api/auth/google">Continue with Google</a>');
    }
    if (providers.github) {
      parts.push('<a class="btn btn-oauth btn-github" href="/api/auth/github">Continue with GitHub</a>');
    }
    if (!parts.length) return '';
    return `<div class="oauth-stack">${parts.join('')}</div><p class="oauth-divider"><span>or</span></p>`;
  } catch {
    return '';
  }
}

function showOAuthError(root) {
  const err = getQuery().error;
  if (!err) return;
  const msg =
    err === 'blocked'
      ? 'This account is blocked.'
      : err === 'no_email'
        ? 'We could not get an email from the provider. Use email/password or grant email access.'
        : err === 'invalid_state'
          ? 'Login session expired. Try again.'
          : decodeURIComponent(String(err).replace(/\+/g, ' '));
  const panel = root.querySelector('.panel');
  if (panel) {
    const el = document.createElement('p');
    el.className = 'oauth-error';
    el.textContent = msg;
    panel.prepend(el);
  }
}

export async function renderLogin(root) {
  const oauth = await oauthButtonsHtml();
  root.innerHTML = authPanel(
    'Welcome back',
    `${oauth}<form id="login-form" class="form-stack">
      <label>Email<input type="email" name="email" required autocomplete="email" /></label>
      <label>Password${passwordInput({ name: 'password', required: true, autocomplete: 'current-password' })}</label>
      <button type="submit" class="btn btn-primary">Log in</button>
      <p class="muted"><a href="/register" data-link>Create account</a> · <a href="/forgot-password" data-link>Forgot password?</a></p>
    </form>`
  );
  showOAuthError(root);
  initPasswordToggles(root);
  root.querySelector('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await api.post('/auth/login', {
        email: fd.get('email'),
        password: fd.get('password'),
      });
      await refreshUser();
      toast('Logged in');
      navigate('/');
    } catch (err) {
      toast(err.message, { error: true });
    }
  });
}

export async function renderRegister(root) {
  const oauth = await oauthButtonsHtml();
  root.innerHTML = authPanel(
    'Join Swiftener',
    `${oauth}<form id="register-form" class="form-stack">
      <label>Name<input type="text" name="name" required autocomplete="name" /></label>
      <label>Email<input type="email" name="email" required autocomplete="email" /></label>
      <label>Password<span class="hint">At least 8 characters</span>
        ${passwordInput({ name: 'password', required: true, minlength: 8, autocomplete: 'new-password' })}</label>
      <button type="submit" class="btn btn-primary">Create account</button>
      <p class="muted"><a href="/login" data-link>Already have an account?</a></p>
    </form>`
  );
  showOAuthError(root);
  initPasswordToggles(root);
  root.querySelector('#register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await api.post('/auth/register', {
        name: fd.get('name'),
        email: fd.get('email'),
        password: fd.get('password'),
      });
      await refreshUser();
      toast('Account created — check email to verify');
      navigate('/');
    } catch (err) {
      toast(err.message, { error: true });
    }
  });
}

export async function renderForgotPassword(root) {
  root.innerHTML = authPanel(
    'Reset password',
    `<form id="forgot-form" class="form-stack">
      <label>Email<input type="email" name="email" required /></label>
      <button type="submit" class="btn btn-primary">Send reset link</button>
      <p class="muted"><a href="/login" data-link>Back to login</a></p>
    </form>`
  );
  root.querySelector('#forgot-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = new FormData(e.target).get('email');
    try {
      await api.post('/auth/forgot-password', { email });
      toast('If that email exists, a reset link was sent');
    } catch (err) {
      toast(err.message, { error: true });
    }
  });
}

export async function renderResetPassword(root) {
  const token = getQuery().token || '';
  root.innerHTML = authPanel(
    'Choose a new password',
    `<form id="reset-form" class="form-stack">
      <input type="hidden" name="token" value="${escapeHtml(token)}" />
      <label>New password${passwordInput({ name: 'newPassword', required: true, minlength: 8, autocomplete: 'new-password' })}</label>
      <button type="submit" class="btn btn-primary">Update password</button>
    </form>`
  );
  initPasswordToggles(root);
  root.querySelector('#reset-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await api.post('/auth/reset-password', {
        token: fd.get('token'),
        newPassword: fd.get('newPassword'),
      });
      toast('Password updated — you can log in');
      navigate('/login');
    } catch (err) {
      toast(err.message, { error: true });
    }
  });
}

export async function renderVerifyEmail(root) {
  const token = getQuery().token;
  root.innerHTML = authPanel('Verify email', '<p class="muted">Confirming your address…</p>');
  if (!token) {
    root.querySelector('.panel').innerHTML += '<p>Missing verification token.</p>';
    return;
  }
  try {
    await api.get(`/auth/verify-email?token=${encodeURIComponent(token)}`);
    root.querySelector('.panel').innerHTML = '<h2>Email verified</h2><p><a href="/login" data-link>Log in</a></p>';
  } catch (err) {
    root.querySelector('.panel').innerHTML = `<h2>Verification failed</h2><p>${escapeHtml(err.message)}</p>`;
  }
}

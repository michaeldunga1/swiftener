import { loadAdSense } from './seo.js';

const STORAGE_KEY = 'sw_consent_v1';

/** @typedef {{ ads: boolean; analytics: boolean; decidedAt: string }} ConsentState */

function readConsent() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.ads !== 'boolean' || typeof parsed?.analytics !== 'boolean') return null;
    return /** @type {ConsentState} */ (parsed);
  } catch {
    return null;
  }
}

function writeConsent(partial) {
  const next = {
    ads: Boolean(partial.ads),
    analytics: Boolean(partial.analytics),
    decidedAt: new Date().toISOString(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function getConsent() {
  return readConsent();
}

export function hasAdsConsent() {
  return readConsent()?.ads === true;
}

export function hasAnalyticsConsent() {
  return readConsent()?.analytics === true;
}

function applyConsent(state) {
  window.dispatchEvent(new CustomEvent('swiftener:consent', { detail: state }));
  if (state.ads) loadAdSense();
}

export function setConsent({ ads, analytics }) {
  const prev = readConsent();
  const state = writeConsent({ ads, analytics });
  hideBanner();
  if (prev?.ads && !state.ads) {
    window.location.reload();
    return state;
  }
  applyConsent(state);
  return state;
}

function hideBanner() {
  document.getElementById('consent-banner')?.remove();
}

function bannerHtml() {
  return `
    <div class="consent-banner" id="consent-banner" role="dialog" aria-labelledby="consent-title" aria-describedby="consent-desc">
      <div class="consent-banner-inner container">
        <div class="consent-copy">
          <p class="consent-title" id="consent-title">Cookies &amp; ads</p>
          <p class="consent-desc" id="consent-desc">
            We use cookies for signing in and site reliability. With your permission, we also use Google AdSense
            (and related Google advertising/measurement cookies) to show ads and understand traffic.
            See our <a href="/privacy" data-link>Privacy Policy</a>.
          </p>
        </div>
        <div class="consent-actions">
          <button type="button" class="btn btn-ghost" data-consent="reject">Reject ads</button>
          <button type="button" class="btn btn-primary" data-consent="accept">Accept</button>
        </div>
      </div>
    </div>
  `;
}

export function showConsentBanner({ force = false } = {}) {
  if (!force && readConsent()) return;
  hideBanner();
  document.body.insertAdjacentHTML('beforeend', bannerHtml());
  const root = document.getElementById('consent-banner');
  root?.querySelector('[data-consent="accept"]')?.addEventListener('click', () => {
    setConsent({ ads: true, analytics: true });
  });
  root?.querySelector('[data-consent="reject"]')?.addEventListener('click', () => {
    setConsent({ ads: false, analytics: false });
  });
}

/** Call once at boot: restore prior choice or ask. */
export function initConsent() {
  const existing = readConsent();
  if (existing) {
    applyConsent(existing);
    return existing;
  }
  showConsentBanner();
  return null;
}

export function openConsentSettings() {
  showConsentBanner({ force: true });
}

const DEFAULT_DESCRIPTION =
  'Long-form writing, thoughtful comments, and clean editorial design on Swiftener.';

function upsertMeta(attr, key, content) {
  if (content == null || content === '') return;
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertLink(rel, href) {
  let el = document.head.querySelector(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

function upsertJsonLd(id, data) {
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement('script');
    el.type = 'application/ld+json';
    el.id = id;
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
}

function siteUrl() {
  return window.__SWIFTENER__?.siteUrl || window.location.origin;
}

function absolute(url) {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  return `${siteUrl()}${url.startsWith('/') ? url : `/${url}`}`;
}

export function setPageSeo({
  title,
  description = DEFAULT_DESCRIPTION,
  path,
  image = '',
  type = 'website',
  noindex = false,
  jsonLd = null,
} = {}) {
  const fullTitle = title
    ? title.includes('Swiftener')
      ? title
      : `${title} · Swiftener`
    : 'Swiftener';
  document.title = fullTitle;

  const url = absolute(path || window.location.pathname);
  const img = absolute(image || '/favicon.svg');
  const robots = noindex ? 'noindex,nofollow' : 'index,follow,max-image-preview:large';

  upsertMeta('name', 'description', description);
  upsertMeta('name', 'robots', robots);
  upsertLink('canonical', url);
  upsertMeta('property', 'og:site_name', 'Swiftener');
  upsertMeta('property', 'og:type', type);
  upsertMeta('property', 'og:title', fullTitle);
  upsertMeta('property', 'og:description', description);
  upsertMeta('property', 'og:url', url);
  upsertMeta('property', 'og:image', img);
  upsertMeta('name', 'twitter:card', 'summary_large_image');
  upsertMeta('name', 'twitter:title', fullTitle);
  upsertMeta('name', 'twitter:description', description);
  upsertMeta('name', 'twitter:image', img);

  const existing = document.getElementById('page-jsonld');
  if (existing && !jsonLd) existing.remove();
  if (jsonLd) upsertJsonLd('page-jsonld', jsonLd);
}

export function setNoIndex(title = 'Swiftener') {
  setPageSeo({ title, noindex: true, description: DEFAULT_DESCRIPTION });
}

let adsenseLoaded = false;

export function loadAdSense() {
  const client = window.__SWIFTENER__?.adsenseClient;
  if (!client || adsenseLoaded) return;
  if (!/^ca-pub-\d+$/.test(client)) return;
  adsenseLoaded = true;

  upsertMeta('name', 'google-adsense-account', client);

  const s = document.createElement('script');
  s.async = true;
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`;
  s.crossOrigin = 'anonymous';
  document.head.appendChild(s);
}

/** Render a responsive AdSense unit. Needs a real slot id from AdSense. */
export function adSlotHtml(slot, { format = 'auto', fullWidth = true } = {}) {
  const client = window.__SWIFTENER__?.adsenseClient;
  if (!client || !/^ca-pub-\d+$/.test(client)) return '';
  if (!slot || slot === 'auto') return '';
  return `
    <aside class="ad-slot panel" aria-label="Advertisement">
      <ins class="adsbygoogle"
        style="display:block"
        data-ad-client="${client}"
        data-ad-slot="${slot}"
        data-ad-format="${format}"
        data-full-width-responsive="${fullWidth ? 'true' : 'false'}"></ins>
    </aside>`;
}

export function pushAds() {
  const client = window.__SWIFTENER__?.adsenseClient;
  if (!client) return;
  const pending = document.querySelectorAll('ins.adsbygoogle:not([data-adsbygoogle-status])');
  if (!pending.length) return;
  try {
    pending.forEach(() => {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    });
  } catch {
    /* ignore until script loads */
  }
}

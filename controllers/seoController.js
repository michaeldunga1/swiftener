const fs = require('fs');
const path = require('path');
const Post = require('../models/Post');
const { postPath, tagSlug, primaryTag } = require('../utils/postPath');
const { renderMarkdown } = require('../utils/markdown');
const { readingStats } = require('../utils/reading');
const {
  siteOrigin,
  absoluteUrl,
  escapeXml,
  escapeHtml,
  stripMarkdown,
  truncate,
} = require('../utils/site');

const INDEX_PATH = path.join(__dirname, '..', 'public', 'index.html');
let indexTemplate;

function loadIndexTemplate() {
  if (!indexTemplate) indexTemplate = fs.readFileSync(INDEX_PATH, 'utf8');
  return indexTemplate;
}

const DEFAULT_ADSENSE_CLIENT = 'ca-pub-4387430227395169';

function adsenseClient() {
  return process.env.ADSENSE_CLIENT || DEFAULT_ADSENSE_CLIENT;
}

function siteConfigScript() {
  const cfg = {
    siteUrl: siteOrigin(),
    adsenseClient: adsenseClient(),
    googleSiteVerification: process.env.GOOGLE_SITE_VERIFICATION || '',
  };
  return `<script>window.__SWIFTENER__=${JSON.stringify(cfg)};</script>`;
}

function defaultSeo({
  title = 'Swiftener — practical cheat sheets',
  description = 'Practical cheat sheets for coding, terminals, and Microsoft Office — quick reference when you need it.',
  path: pagePath = '/',
  image = '',
  type = 'website',
  noindex = false,
  jsonLd = null,
} = {}) {
  const url = absoluteUrl(pagePath);
  const fullTitle = title.includes('Swiftener') ? title : `${title} · Swiftener`;
  const img = image ? absoluteUrl(image) : absoluteUrl('/favicon.svg');
  const robots = noindex ? 'noindex,nofollow' : 'index,follow,max-image-preview:large';
  const verification = process.env.GOOGLE_SITE_VERIFICATION
    ? `<meta name="google-site-verification" content="${escapeHtml(process.env.GOOGLE_SITE_VERIFICATION)}" />`
    : '';
  const adsenseMeta = adsenseClient()
    ? `<meta name="google-adsense-account" content="${escapeHtml(adsenseClient())}" />`
    : '';

  const ld = Array.isArray(jsonLd) ? jsonLd : jsonLd ? [jsonLd] : [];
  const ldTags = ld
    .map((obj) => `<script type="application/ld+json">${JSON.stringify(obj)}</script>`)
    .join('\n');

  return `
    <title>${escapeHtml(fullTitle)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <meta name="robots" content="${robots}" />
    <link rel="canonical" href="${escapeHtml(url)}" />
    <meta property="og:site_name" content="Swiftener" />
    <meta property="og:type" content="${escapeHtml(type)}" />
    <meta property="og:title" content="${escapeHtml(fullTitle)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${escapeHtml(url)}" />
    <meta property="og:image" content="${escapeHtml(img)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(fullTitle)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${escapeHtml(img)}" />
    ${verification}
    ${adsenseMeta}
    ${ldTags}
  `;
}

function websiteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Swiftener',
    url: siteOrigin(),
    description: 'Practical cheat sheets for coding, terminals, and Microsoft Office.',
    potentialAction: {
      '@type': 'SearchAction',
      target: `${siteOrigin()}/?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };
}

function organizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Swiftener',
    url: siteOrigin(),
    logo: absoluteUrl('/favicon.svg'),
    sameAs: [],
  };
}

function articleJsonLd(post, reading) {
  const url = absoluteUrl(postPath(post));
  const description = truncate(post.excerpt || stripMarkdown(post.body), 160);
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description,
    datePublished: post.publishedAt ? new Date(post.publishedAt).toISOString() : undefined,
    dateModified: post.updatedAt ? new Date(post.updatedAt).toISOString() : undefined,
    image: post.coverImage ? [absoluteUrl(post.coverImage)] : undefined,
    author: {
      '@type': 'Person',
      name: post.author?.name || 'Swiftener',
    },
    publisher: {
      '@type': 'Organization',
      name: 'Swiftener',
      logo: {
        '@type': 'ImageObject',
        url: absoluteUrl('/favicon.svg'),
      },
    },
    mainEntityOfPage: url,
    wordCount: reading?.words,
    timeRequired: reading?.minutes ? `PT${reading.minutes}M` : undefined,
    articleSection: post.category || undefined,
    keywords: Array.isArray(post.tags) ? post.tags.join(', ') : undefined,
  };
}

function renderSpaHtml({ head = '', prerender = '' } = {}) {
  let html = loadIndexTemplate();
  html = html.replace('<!--SEO_HEAD-->', (head && String(head).trim()) || defaultSeo());
  html = html.replace('<!--SITE_CONFIG-->', siteConfigScript());
  html = html.replace('<!--PRERENDER-->', prerender || '');
  return html;
}

function robotsTxt(_req, res) {
  const origin = siteOrigin();
  res.type('text/plain').send(
    [
      'User-agent: *',
      'Allow: /',
      'Disallow: /admin',
      'Disallow: /admin/',
      'Disallow: /profile',
      'Disallow: /profile/',
      'Disallow: /login',
      'Disallow: /register',
      'Disallow: /forgot-password',
      'Disallow: /reset-password',
      'Disallow: /verify-email',
      'Disallow: /api/',
      '',
      `Sitemap: ${origin}/sitemap.xml`,
      '',
    ].join('\n')
  );
}

function adsTxt(_req, res) {
  const pub = String(adsenseClient() || '').replace(/^ca-/, '');
  if (!pub || !pub.startsWith('pub-')) {
    return res
      .status(404)
      .type('text/plain')
      .send('# Set ADSENSE_CLIENT=ca-pub-XXXXXXXX in .env to enable ads.txt\n');
  }
  res.type('text/plain').send(`google.com, ${pub}, DIRECT, f08c47fec0942fa0\n`);
}

function sitemapXml(_req, res) {
  try {
    const posts = Post.listForSitemap();
    const staticPaths = ['/', '/about', '/contact', '/privacy', '/terms', '/newsletter'];
    const urls = [
      ...staticPaths.map((p) => ({
        loc: absoluteUrl(p),
        changefreq: p === '/' ? 'daily' : 'monthly',
        priority: p === '/' ? '1.0' : '0.5',
      })),
      ...posts.map((p) => ({
        loc: absoluteUrl(postPath(p)),
        lastmod: (p.updatedAt || p.publishedAt || new Date()).toISOString(),
        changefreq: 'weekly',
        priority: '0.8',
      })),
    ];

    const body = urls
      .map((u) => {
        const last = u.lastmod ? `<lastmod>${escapeXml(u.lastmod)}</lastmod>` : '';
        return `<url><loc>${escapeXml(u.loc)}</loc>${last}<changefreq>${u.changefreq}</changefreq><priority>${u.priority}</priority></url>`;
      })
      .join('');

    res
      .type('application/xml')
      .send(
        `<?xml version="1.0" encoding="UTF-8"?>` +
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`
      );
  } catch (err) {
    res.status(500).type('text/plain').send('Sitemap error');
  }
}

function sendHomeHtml(_req, res) {
  const head = defaultSeo({
    title: 'Swiftener — practical cheat sheets',
    description: 'Practical cheat sheets for coding, terminals, and Microsoft Office — quick reference when you need it.',
    path: '/',
    jsonLd: [websiteJsonLd(), organizationJsonLd()],
  });
  res.type('html').send(renderSpaHtml({ head }));
}

function sendStaticPageHtml(pagePath, title, description) {
  return (_req, res) => {
    const head = defaultSeo({
      title,
      description,
      path: pagePath,
      jsonLd: organizationJsonLd(),
    });
    res.type('html').send(renderSpaHtml({ head }));
  };
}

function sendPostHtml(req, res, next) {
  try {
    const slug = req.params.slug;
    const post = Post.findBySlug(slug, { withAuthor: true, authorFields: 'name avatar bio' });
    if (!post || post.status !== 'published') return next();

    const reading = readingStats(post.body);
    const pagePath = postPath(post);
    const description = truncate(post.excerpt || stripMarkdown(post.body), 160);
    const htmlBody = renderMarkdown(post.body);
    const head = defaultSeo({
      title: post.title,
      description,
      path: pagePath,
      image: post.coverImage || '',
      type: 'article',
      jsonLd: articleJsonLd(post, reading),
    });

    const prerender = `
      <noscript>
        <article class="container panel" style="margin:2rem auto;max-width:48rem">
          <h1>${escapeHtml(post.title)}</h1>
          <p>${escapeHtml(description)}</p>
          ${post.coverImage ? `<img src="${escapeHtml(absoluteUrl(post.coverImage))}" alt="${escapeHtml(post.title)}" />` : ''}
          <div>${htmlBody}</div>
        </article>
      </noscript>
      <script type="application/json" id="seo-post-bootstrap">${JSON.stringify({
        slug: post.slug,
        path: pagePath,
      }).replace(/</g, '\\u003c')}</script>
    `;

    // Canonicalize /posts/:slug and wrong-tag URLs
    if (req.path === `/posts/${post.slug}`) {
      return res.redirect(301, pagePath);
    }
    if (req.params.tag && tagSlug(req.params.tag) !== tagSlug(primaryTag(post))) {
      return res.redirect(301, pagePath);
    }

    res.type('html').send(renderSpaHtml({ head, prerender }));
  } catch (err) {
    next(err);
  }
}

function sendSpaHtml(req, res) {
  const noindex =
    /^\/(admin|profile|login|register|forgot-password|reset-password|verify-email)/.test(req.path);
  const head = defaultSeo({
    title: 'Swiftener',
    description: 'Practical cheat sheets for coding, terminals, and Microsoft Office.',
    path: req.path || '/',
    noindex,
  });
  res.type('html').send(renderSpaHtml({ head }));
}

module.exports = {
  robotsTxt,
  adsTxt,
  sitemapXml,
  sendHomeHtml,
  sendStaticPageHtml,
  sendPostHtml,
  sendSpaHtml,
  defaultSeo,
  websiteJsonLd,
  organizationJsonLd,
};

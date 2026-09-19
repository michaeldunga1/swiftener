const seo = require('../controllers/seoController');

function mountSeoRoutes(app) {
  app.get('/robots.txt', seo.robotsTxt);
  app.get('/sitemap.xml', seo.sitemapXml);
  app.get('/ads.txt', seo.adsTxt);

  app.get('/', seo.sendHomeHtml);
  app.get(
    '/about',
    seo.sendStaticPageHtml(
      '/about',
      'About',
      'About Swiftener — clear, practical How-to guides on useful IT topics for beginners and intermediate readers.'
    )
  );
  app.get(
    '/contact',
    seo.sendStaticPageHtml(
      '/contact',
      'Contact',
      'Contact Swiftener about guides, corrections, or account help.'
    )
  );
  app.get(
    '/privacy',
    seo.sendStaticPageHtml(
      '/privacy',
      'Privacy Policy',
      'How Swiftener collects and uses data when you read guides, comment, or view ads.'
    )
  );
  app.get(
    '/terms',
    seo.sendStaticPageHtml(
      '/terms',
      'Terms of Use',
      'Terms for using Swiftener’s guides, comments, and related services.'
    )
  );
  app.get(
    '/newsletter',
    seo.sendStaticPageHtml(
      '/newsletter',
      'Newsletter',
      'Subscribe for new Swiftener How-to guides and updates.'
    )
  );
  app.get('/tags/:tag', (req, res) => {
    const tag = String(req.params.tag || '')
      .trim()
      .replace(/^#+/, '')
      .toLowerCase();
    seo.sendStaticPageHtml(
      `/tags/${encodeURIComponent(tag)}`,
      `#${tag}`,
      `Guides tagged #${tag} on Swiftener.`
    )(req, res);
  });

  app.get('/posts/:tag/:slug', seo.sendPostHtml);
  app.get('/posts/:slug', seo.sendPostHtml);
}

module.exports = { mountSeoRoutes, sendSpaHtml: seo.sendSpaHtml };

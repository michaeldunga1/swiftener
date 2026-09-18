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
      'About Swiftener — practical cheat sheets for coding, terminals, and Microsoft Office.'
    )
  );
  app.get(
    '/contact',
    seo.sendStaticPageHtml('/contact', 'Contact', 'Contact Swiftener about cheat sheets, corrections, or account help.')
  );
  app.get(
    '/privacy',
    seo.sendStaticPageHtml(
      '/privacy',
      'Privacy Policy',
      'How Swiftener collects and uses data when you read cheat sheets, comment, or view ads.'
    )
  );
  app.get(
    '/terms',
    seo.sendStaticPageHtml(
      '/terms',
      'Terms of Use',
      'Terms for using Swiftener’s cheat sheets, comments, and related services.'
    )
  );
  app.get(
    '/newsletter',
    seo.sendStaticPageHtml(
      '/newsletter',
      'Newsletter',
      'Subscribe for new Swiftener cheat sheets and guide updates.'
    )
  );

  app.get('/posts/:tag/:slug', seo.sendPostHtml);
  app.get('/posts/:slug', seo.sendPostHtml);
}

module.exports = { mountSeoRoutes, sendSpaHtml: seo.sendSpaHtml };

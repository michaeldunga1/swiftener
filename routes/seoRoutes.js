const seo = require('../controllers/seoController');

function mountSeoRoutes(app) {
  app.get('/robots.txt', seo.robotsTxt);
  app.get('/sitemap.xml', seo.sitemapXml);
  app.get('/ads.txt', seo.adsTxt);

  app.get('/', seo.sendHomeHtml);
  app.get('/about', seo.sendStaticPageHtml('/about', 'About', 'About Swiftener — long-form writing and thoughtful discussion.'));
  app.get('/contact', seo.sendStaticPageHtml('/contact', 'Contact', 'Contact Swiftener for questions, feedback, or partnership ideas.'));
  app.get(
    '/privacy',
    seo.sendStaticPageHtml('/privacy', 'Privacy Policy', 'How Swiftener collects, uses, and protects your information, including ads and analytics.')
  );
  app.get('/terms', seo.sendStaticPageHtml('/terms', 'Terms of Use', 'Terms of use for the Swiftener publishing platform.'));
  app.get(
    '/newsletter',
    seo.sendStaticPageHtml('/newsletter', 'Newsletter', 'Subscribe to the Swiftener newsletter for occasional writing and updates.')
  );

  app.get('/posts/:tag/:slug', seo.sendPostHtml);
  app.get('/posts/:slug', seo.sendPostHtml);
}

module.exports = { mountSeoRoutes, sendSpaHtml: seo.sendSpaHtml };

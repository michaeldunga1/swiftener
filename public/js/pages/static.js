import { escapeHtml } from '../ui.js';
import { setPageSeo } from '../seo.js';

function pageShell(title, bodyHtml) {
  return `
    <article class="panel static-page">
      <h1>${escapeHtml(title)}</h1>
      ${bodyHtml}
    </article>
  `;
}

export function renderAbout(root) {
  setPageSeo({
    title: 'About',
    description:
      'About Swiftener — clear, practical How-to guides on useful IT topics for beginners and intermediate readers.',
    path: '/about',
  });
  root.innerHTML = pageShell(
    'About',
    `
      <p>Swiftener publishes clear, practical IT writing for beginners and intermediate readers — the kind of guides you can follow step by step and actually use.</p>
      <p>We’re experienced technical writers and IT bloggers. We focus on “How to…” posts on useful, currently relevant topics: setting up a home lab, securing a Linux server, automating backups with rsync, configuring Cloudflare Tunnel, writing better shell scripts, and similar hands-on work.</p>
      <p>Expect skimmable explanations, real commands, and beginner-to-intermediate depth — useful when you’re learning something new or need a reliable reference later.</p>
      <p>You can comment on guides, save or bookmark pages you rely on, and <a href="/newsletter" data-link>subscribe</a> for updates when new posts go live.</p>
    `
  );
}

export function renderContact(root) {
  setPageSeo({
    title: 'Contact',
    description: 'Contact Swiftener about guides, corrections, or account help.',
    path: '/contact',
  });
  root.innerHTML = pageShell(
    'Contact',
    `
      <p>Spot an error in a guide, want a topic covered, or need help with your account? We’d like to hear from you.</p>
      <p><a href="mailto:michaeldunga1@gmail.com">michaeldunga1@gmail.com</a></p>
      <p class="muted">For account help, try <a href="/forgot-password" data-link>resetting your password</a> or signing in again.</p>
    `
  );
}

export function renderPrivacy(root) {
  setPageSeo({
    title: 'Privacy Policy',
    description: 'How Swiftener collects and uses data when you read guides, comment, or view ads.',
    path: '/privacy',
  });
  root.innerHTML = pageShell(
    'Privacy Policy',
    `
      <p>Last updated: September 18, 2026</p>
      <p>Swiftener publishes educational How-to guides and related reference articles. This policy explains what we collect when you browse those guides, create an account, comment, or interact with the site.</p>
      <h2>Information we collect</h2>
      <p>We collect account details you provide (such as name and email), comments and other content you post, and basic usage data such as page views of guides and other articles, to operate and improve Swiftener.</p>
      <p>Authentication cookies keep you signed in. Analytics may include IP address, browser, device, and approximate location derived from IP.</p>
      <h2>Advertising</h2>
      <p>We may show ads served by Google AdSense (and similar partners) alongside guides and other pages. These partners may use cookies or similar technologies to show relevant ads based on your visits to this and other sites. We ask for your consent before loading AdSense or sending non-essential analytics. You can change your choice anytime via <strong>Cookie settings</strong> in the footer.</p>
      <p>You can also learn more and manage ad personalization in <a href="https://adssettings.google.com/" rel="noopener noreferrer" target="_blank">Google Ads Settings</a> and review Google’s policies at <a href="https://policies.google.com/technologies/ads" rel="noopener noreferrer" target="_blank">How Google uses information from sites or apps that use our services</a>.</p>
      <p>We do not sell your personal information. Contact us if you want to update or delete your account data.</p>
      <p><a href="/contact" data-link>Contact</a></p>
    `
  );
}

export function renderTerms(root) {
  setPageSeo({
    title: 'Terms of Use',
    description: 'Terms for using Swiftener’s guides, comments, and related services.',
    path: '/terms',
  });
  root.innerHTML = pageShell(
    'Terms of Use',
    `
      <p>Last updated: September 18, 2026</p>
      <p>By using Swiftener you agree to use the service lawfully, respect other readers and commenters, and not abuse, scrape, or disrupt the platform.</p>
      <h2>Educational reference content</h2>
      <p>How-to guides on Swiftener are provided for personal learning and practical reference. They may contain mistakes or become outdated as software changes. Use them at your own risk; we do not guarantee completeness or fitness for a particular purpose.</p>
      <p>Swiftener is an independent educational site. It is not affiliated with, endorsed by, or sponsored by Microsoft, Git, or the publishers of other tools mentioned in our guides, unless we say otherwise.</p>
      <h2>Your content</h2>
      <p>You retain ownership of comments and other content you submit. By posting, you grant Swiftener a license to host and display that content on the service.</p>
      <p>We may suspend accounts that violate these terms or harm the community. The service is provided as-is without warranties.</p>
      <p><a href="/contact" data-link>Contact</a> if you have questions about these terms.</p>
    `
  );
}

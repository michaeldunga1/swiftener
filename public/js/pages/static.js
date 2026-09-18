import { escapeHtml } from '../ui.js';
import { setPageSeo } from '../seo.js';

function pageShell(title, bodyHtml) {
  return `
    <article class="panel static-page">
      <h1 style="font-family:var(--font-display);margin-top:0">${escapeHtml(title)}</h1>
      ${bodyHtml}
    </article>
  `;
}

export function renderAbout(root) {
  setPageSeo({
    title: 'About',
    description: 'About Swiftener — practical cheat sheets for coding, terminals, and Microsoft Office.',
    path: '/about',
  });
  root.innerHTML = pageShell(
    'About',
    `
      <p>Swiftener is a library of practical cheat sheets: quick-reference guides for programming languages, developer tools, terminals, and everyday Microsoft Office apps.</p>
      <p>Browse sheets for JavaScript, Python, Git, Linux, PowerShell, Windows CMD, Excel, Word, Access, PowerPoint, and more. Each guide is written to be skimmable when you need an answer fast, and deep enough to learn from.</p>
      <p>You can comment on guides, save or bookmark pages you rely on, and subscribe for updates when new sheets are published.</p>
    `
  );
}

export function renderContact(root) {
  setPageSeo({
    title: 'Contact',
    description: 'Contact Swiftener about cheat sheets, corrections, or account help.',
    path: '/contact',
  });
  root.innerHTML = pageShell(
    'Contact',
    `
      <p>Spot an error in a cheat sheet, want a topic covered, or need help with your account? We’d like to hear from you.</p>
      <p><a href="mailto:hello@swiftener.com">hello@swiftener.com</a></p>
      <p class="muted">For account help, try <a href="/forgot-password" data-link>resetting your password</a> or signing in again.</p>
    `
  );
}

export function renderPrivacy(root) {
  setPageSeo({
    title: 'Privacy Policy',
    description: 'How Swiftener collects and uses data when you read cheat sheets, comment, or view ads.',
    path: '/privacy',
  });
  root.innerHTML = pageShell(
    'Privacy Policy',
    `
      <p>Last updated: September 18, 2026</p>
      <p>Swiftener publishes educational cheat sheets and related reference articles. This policy explains what we collect when you browse those guides, create an account, comment, or interact with the site.</p>
      <h2 style="font-family:var(--font-display);font-size:1.25rem">Information we collect</h2>
      <p>We collect account details you provide (such as name and email), comments and other content you post, and basic usage data such as page views of cheat sheets and other articles, to operate and improve Swiftener.</p>
      <p>Authentication cookies keep you signed in. Analytics may include IP address, browser, device, and approximate location derived from IP.</p>
      <h2 style="font-family:var(--font-display);font-size:1.25rem">Advertising</h2>
      <p>We may show ads served by Google AdSense (and similar partners) alongside cheat sheets and other pages. These partners may use cookies or similar technologies to show relevant ads based on your visits to this and other sites. You can learn more and manage ad personalization in <a href="https://adssettings.google.com/" rel="noopener noreferrer" target="_blank">Google Ads Settings</a> and review Google’s policies at <a href="https://policies.google.com/technologies/ads" rel="noopener noreferrer" target="_blank">How Google uses information from sites or apps that use our services</a>.</p>
      <p>We do not sell your personal information. Contact us if you want to update or delete your account data.</p>
      <p><a href="/contact" data-link>Contact</a></p>
    `
  );
}

export function renderTerms(root) {
  setPageSeo({
    title: 'Terms of Use',
    description: 'Terms for using Swiftener’s cheat sheets, comments, and related services.',
    path: '/terms',
  });
  root.innerHTML = pageShell(
    'Terms of Use',
    `
      <p>Last updated: September 18, 2026</p>
      <p>By using Swiftener you agree to use the service lawfully, respect other readers and commenters, and not abuse, scrape, or disrupt the platform.</p>
      <h2 style="font-family:var(--font-display);font-size:1.25rem">Educational reference content</h2>
      <p>Cheat sheets and guides on Swiftener are provided for personal learning and quick reference. They may contain mistakes or become outdated as software changes. Use them at your own risk; we do not guarantee completeness or fitness for a particular purpose.</p>
      <p>Swiftener is an independent educational site. It is not affiliated with, endorsed by, or sponsored by Microsoft, Git, or the publishers of other tools mentioned in our guides, unless we say otherwise.</p>
      <h2 style="font-family:var(--font-display);font-size:1.25rem">Your content</h2>
      <p>You retain ownership of comments and other content you submit. By posting, you grant Swiftener a license to host and display that content on the service.</p>
      <p>We may suspend accounts that violate these terms or harm the community. The service is provided as-is without warranties.</p>
      <p><a href="/contact" data-link>Contact</a> if you have questions about these terms.</p>
    `
  );
}

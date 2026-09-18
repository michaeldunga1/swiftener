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
    description: 'About Swiftener — long-form writing and thoughtful discussion.',
    path: '/about',
  });
  root.innerHTML = pageShell(
    'About',
    `
      <p>Swiftener is a place to publish long-form writing, sharpen ideas in public, and host thoughtful discussion.</p>
      <p>The platform focuses on clean editorial design, comments, and simple publishing tools for writers and readers.</p>
    `
  );
}

export function renderContact(root) {
  setPageSeo({
    title: 'Contact',
    description: 'Contact Swiftener for questions, feedback, or partnership ideas.',
    path: '/contact',
  });
  root.innerHTML = pageShell(
    'Contact',
    `
      <p>Questions, feedback, or partnership ideas? Reach out and we’ll get back to you.</p>
      <p><a href="mailto:hello@swiftener.com">hello@swiftener.com</a></p>
      <p class="muted">For account help, try <a href="/forgot-password" data-link>resetting your password</a> or signing in again.</p>
    `
  );
}

export function renderPrivacy(root) {
  setPageSeo({
    title: 'Privacy Policy',
    description: 'How Swiftener collects, uses, and protects your information, including ads and analytics.',
    path: '/privacy',
  });
  root.innerHTML = pageShell(
    'Privacy Policy',
    `
      <p>Last updated: September 18, 2026</p>
      <p>We collect account details you provide (such as name and email), content you publish or comment with, and basic usage data like page views to operate and improve Swiftener.</p>
      <p>Authentication cookies keep you signed in. Analytics may include IP address, browser, device, and approximate location derived from IP.</p>
      <h2 style="font-family:var(--font-display);font-size:1.25rem">Advertising</h2>
      <p>We may show ads served by Google AdSense (and similar partners). These partners may use cookies or similar technologies to show relevant ads based on your visits to this and other sites. You can learn more and manage ad personalization in <a href="https://adssettings.google.com/" rel="noopener noreferrer" target="_blank">Google Ads Settings</a> and review Google’s policies at <a href="https://policies.google.com/technologies/ads" rel="noopener noreferrer" target="_blank">How Google uses information from sites or apps that use our services</a>.</p>
      <p>We do not sell your personal information. Contact us if you want to update or delete your account data.</p>
      <p><a href="/contact" data-link>Contact</a></p>
    `
  );
}

export function renderTerms(root) {
  setPageSeo({
    title: 'Terms of Use',
    description: 'Terms of use for the Swiftener publishing platform.',
    path: '/terms',
  });
  root.innerHTML = pageShell(
    'Terms of Use',
    `
      <p>Last updated: September 16, 2026</p>
      <p>By using Swiftener you agree to use the service lawfully, respect other users, and not abuse, scrape, or disrupt the platform.</p>
      <p>You retain ownership of content you publish. By posting, you grant Swiftener a license to host and display that content on the service.</p>
      <p>We may suspend accounts that violate these terms or harm the community. The service is provided as-is without warranties.</p>
      <p><a href="/contact" data-link>Contact</a> if you have questions about these terms.</p>
    `
  );
}

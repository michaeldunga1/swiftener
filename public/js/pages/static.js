import { escapeHtml } from '../ui.js';

function pageShell(title, bodyHtml) {
  return `
    <article class="panel static-page">
      <h1 style="font-family:var(--font-display);margin-top:0">${escapeHtml(title)}</h1>
      ${bodyHtml}
    </article>
  `;
}

export function renderAbout(root) {
  root.innerHTML = pageShell(
    'About',
    `
      <p>Swiftener is a place to publish long-form writing, sharpen ideas in public, and host thoughtful discussion.</p>
      <p>The platform focuses on clean editorial design, comments, and simple publishing tools for writers and readers.</p>
    `
  );
}

export function renderContact(root) {
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
  root.innerHTML = pageShell(
    'Privacy Policy',
    `
      <p>Last updated: September 16, 2026</p>
      <p>We collect account details you provide (such as name and email), content you publish or comment with, and basic usage data like page views to operate and improve Swiftener.</p>
      <p>Authentication cookies keep you signed in. Analytics may include IP address, browser, device, and approximate location derived from IP.</p>
      <p>We do not sell your personal information. Contact us if you want to update or delete your account data.</p>
      <p><a href="/contact" data-link>Contact</a></p>
    `
  );
}

export function renderTerms(root) {
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

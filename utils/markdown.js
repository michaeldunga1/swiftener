const { marked } = require('marked');
const sanitizeHtml = require('sanitize-html');

// Renders markdown to safe HTML. Admin-authored content is still sanitized
// defensively (protects readers even if an admin account is compromised).
function renderMarkdown(raw) {
  const html = marked.parse(raw || '', { breaks: true, gfm: true });
  return sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'h1', 'h2', 'del']),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      img: ['src', 'alt', 'title'],
      a: ['href', 'name', 'target', 'rel'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
  });
}

module.exports = { renderMarkdown };

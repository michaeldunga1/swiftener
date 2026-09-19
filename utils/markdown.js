const { marked } = require('marked');
const sanitizeHtml = require('sanitize-html');
const { tagSlug } = require('./postPath');
const { linkHashtagsInMarkdown } = require('./hashtags');

function renderMarkdown(raw) {
  const withHashtags = linkHashtagsInMarkdown(raw || '');
  const html = marked.parse(withHashtags, { breaks: true, gfm: true });
  return sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'h1', 'h2', 'del']),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      img: ['src', 'alt', 'title'],
      a: ['href', 'name', 'target', 'rel', 'class'],
      h1: ['id'],
      h2: ['id'],
      h3: ['id'],
      h4: ['id'],
      h5: ['id'],
      h6: ['id'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    transformTags: {
      a: (tagName, attribs) => {
        const href = attribs.href || '';
        if (href.startsWith('/tags/')) {
          return { tagName, attribs: { ...attribs, class: 'hashtag' } };
        }
        return { tagName, attribs };
      },
    },
  });
}

/** Extract TOC entries from markdown source (h2/h3). */
function extractToc(raw = '') {
  const used = new Map();
  const items = [];
  const re = /^(#{2,3})\s+(.+)$/gm;
  let m;
  while ((m = re.exec(String(raw)))) {
    const level = m[1].length;
    const text = m[2].replace(/[#*_`[\]]/g, '').replace(/\(.*?\)/g, '').trim();
    if (!text) continue;
    let id = tagSlug(text);
    const n = used.get(id) || 0;
    used.set(id, n + 1);
    if (n) id = `${id}-${n}`;
    items.push({ id, text, level });
  }
  return items;
}

module.exports = { renderMarkdown, extractToc };

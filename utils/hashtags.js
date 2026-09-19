const MAX_HASHTAG_LEN = 32;
const MAX_HASHTAGS_PER_POST = 24;

/** Normalize a single hashtag: strip #, lowercase, slugify-ish. */
function normalizeHashtag(input) {
  const raw = String(input || '')
    .trim()
    .replace(/^#+/, '')
    .toLowerCase();
  const slug = raw
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/_+/g, '_')
    .slice(0, MAX_HASHTAG_LEN);
  if (!slug || slug.length < 2) return null;
  if (!/^[a-z][a-z0-9_-]*$/.test(slug)) return null;
  return slug;
}

/** Dedupe and normalize a list of hashtag inputs. */
function normalizeHashtagList(list = []) {
  const out = [];
  const seen = new Set();
  for (const item of list) {
    const tag = normalizeHashtag(item);
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag);
    if (out.length >= MAX_HASHTAGS_PER_POST) break;
  }
  return out;
}

/** Pull #hashtags out of free text (skips fenced/inline code and markdown headings). */
function extractHashtagsFromText(text = '') {
  const found = [];
  const parts = String(text).split(/(```[\s\S]*?```|`[^`]+`)/);
  parts.forEach((part, i) => {
    if (i % 2 === 1) return;
    part.split('\n').forEach((line) => {
      if (/^\s{0,3}#{1,6}\s/.test(line)) return;
      const re = /(^|[^&\w/#])#([a-zA-Z][\w-]{0,31})\b/g;
      let m;
      while ((m = re.exec(line))) {
        found.push(m[2]);
      }
    });
  });
  return normalizeHashtagList(found);
}

/**
 * Merge explicit tags with hashtags found in the body.
 * Explicit tags win order; body hashtags fill remaining slots.
 */
function resolvePostHashtags(tags, body) {
  return normalizeHashtagList([...(Array.isArray(tags) ? tags : []), ...extractHashtagsFromText(body)]);
}

/** Turn bare #hashtags in markdown into links (outside code/headings). */
function linkHashtagsInMarkdown(src = '') {
  const parts = String(src).split(/(```[\s\S]*?```|`[^`]+`)/);
  return parts
    .map((part, i) => {
      if (i % 2 === 1) return part;
      return part
        .split('\n')
        .map((line) => {
          if (/^\s{0,3}#{1,6}\s/.test(line)) return line;
          return line.replace(/(^|[^&\w/#])#([a-zA-Z][\w-]{0,31})\b/g, (match, pre, raw) => {
            const tag = normalizeHashtag(raw);
            if (!tag) return match;
            return `${pre}[#${tag}](/tags/${encodeURIComponent(tag)})`;
          });
        })
        .join('\n');
    })
    .join('');
}

module.exports = {
  MAX_HASHTAG_LEN,
  MAX_HASHTAGS_PER_POST,
  normalizeHashtag,
  normalizeHashtagList,
  extractHashtagsFromText,
  resolvePostHashtags,
  linkHashtagsInMarkdown,
};

const MARKED_CDN = 'https://cdn.jsdelivr.net/npm/marked@13.0.3/lib/marked.esm.js';

let markedModPromise;

async function loadMarked() {
  if (!markedModPromise) {
    markedModPromise = import(MARKED_CDN).then((mod) => {
      const marked = mod.marked || mod.default || mod;
      if (marked?.setOptions) {
        marked.setOptions({ breaks: true, gfm: true });
      }
      return marked;
    });
  }
  return markedModPromise;
}

function normalizeHashtag(input) {
  const slug = String(input || '')
    .trim()
    .replace(/^#+/, '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
  if (!slug || slug.length < 2) return null;
  if (!/^[a-z][a-z0-9_-]*$/.test(slug)) return null;
  return slug;
}

/** Link bare #hashtags in markdown (outside code fences/headings). */
export function linkHashtagsInMarkdown(src = '') {
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

/** True when a string still looks like unrendered markdown rather than HTML. */
export function looksLikeMarkdown(text = '') {
  const s = String(text);
  if (!s.trim()) return false;
  if (/<[a-z][\s\S]*>/i.test(s) && !/^\s*#/m.test(s) && !/^\s*\[.+\]\(.+\)/m.test(s)) {
    return false;
  }
  return (
    /^\s{0,3}#{1,6}\s/m.test(s) ||
    /\[[^\]]+\]\([^)]+\)/.test(s) ||
    /```[\s\S]*?```/.test(s) ||
    /(^|\n)\s*[-*+]\s+\S/.test(s)
  );
}

/**
 * Render post markdown to HTML. Prefer parsing `body` on the client so
 * markdown never appears as plain text; fall back to server HTML if needed.
 */
export async function htmlForPostBody(post = {}) {
  const source = linkHashtagsInMarkdown(post.body || '');
  try {
    const marked = await loadMarked();
    const parse = marked.parse ? marked.parse.bind(marked) : marked;
    const html = parse(source, { breaks: true, gfm: true });
    if (html && String(html).trim()) {
      return String(html).replace(
        /<a\s+([^>]*?)href="(\/tags\/[^"]+)"([^>]*)>/gi,
        (m, pre, href, post) => {
          if (/\bdata-link\b/i.test(pre + post)) return m;
          return `<a ${pre}href="${href}" data-link${post}>`;
        }
      );
    }
  } catch {
    /* fall through */
  }
  if (post.renderedBody && /<[a-z][\s\S]*>/i.test(post.renderedBody)) {
    return post.renderedBody;
  }
  return escapeBasic(source);
}

function escapeBasic(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');
}

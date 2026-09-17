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
  const source = post.body || '';
  try {
    const marked = await loadMarked();
    const parse = marked.parse ? marked.parse.bind(marked) : marked;
    const html = parse(source, { breaks: true, gfm: true });
    if (html && String(html).trim()) return html;
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

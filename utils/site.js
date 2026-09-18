function siteOrigin() {
  return String(process.env.FRONTEND_URL || 'http://localhost:4000').replace(/\/+$/, '');
}

function absoluteUrl(pathname = '/') {
  if (!pathname) return siteOrigin();
  if (/^https?:\/\//i.test(pathname)) return pathname;
  return `${siteOrigin()}${pathname.startsWith('/') ? pathname : `/${pathname}`}`;
}

function escapeXml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function stripMarkdown(text = '') {
  return String(text)
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, ' ')
    .replace(/\[[^\]]*\]\(([^)]+)\)/g, ' ')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_~>#-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncate(text, max = 160) {
  const s = String(text || '').trim();
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1).trim()}…`;
}

module.exports = {
  siteOrigin,
  absoluteUrl,
  escapeXml,
  escapeHtml,
  stripMarkdown,
  truncate,
};

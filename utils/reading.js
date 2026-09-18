/** Estimate reading time from markdown/plain text (words ÷ 220). */
function readingStats(text = '') {
  const words = String(text)
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[#>*_\-\[\]()`]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  const minutes = Math.max(1, Math.ceil(words / 220));
  return { words, minutes };
}

module.exports = { readingStats };

const BOT_UA =
  /bot|crawl|spider|slurp|scrapy|httpclient|python-requests|curl\/|wget|libwww|java\/|go-http|okhttp|headlesschrome|phantomjs|puppeteer|playwright|selenium|facebookexternalhit|facebot|twitterbot|linkedinbot|discordbot|telegrambot|whatsapp|preview|monitor|uptime|pingdom|statuscake|bytespider|semrush|ahrefs|mj12bot|dotbot|petalbot|yandexbot|bingbot|googlebot|baiduspider|duckduckbot|applebot|ia_archiver/i;

function isBotUserAgent(ua = '') {
  const value = String(ua || '').trim();
  if (!value) return true;
  return BOT_UA.test(value);
}

module.exports = { isBotUserAgent };

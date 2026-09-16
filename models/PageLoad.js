const { getDb, now, fromIso } = require('./_helpers');
const { lookupGeo } = require('../utils/geoip');
const { isBotUserAgent } = require('../utils/bot');

function mapRow(row) {
  if (!row) return null;
  return {
    _id: row.id,
    path: row.path,
    fullUrl: row.full_url,
    queryString: row.query_string,
    referrer: row.referrer,
    ip: row.ip,
    userAgent: row.user_agent,
    acceptLanguage: row.accept_language,
    language: row.language,
    platform: row.platform,
    screenWidth: row.screen_width,
    screenHeight: row.screen_height,
    viewportWidth: row.viewport_width,
    viewportHeight: row.viewport_height,
    timezone: row.timezone,
    country: row.country || '',
    city: row.city || '',
    isBot: Boolean(row.is_bot),
    user: row.user_id
      ? { _id: row.user_id, name: row.user_name || null, email: row.user_email || null }
      : row.user_id,
    createdAt: fromIso(row.created_at),
  };
}

const PageLoad = {
  create(data) {
    const ua = data.userAgent || '';
    const geo =
      data.country || data.city
        ? { country: data.country || 'Unknown', city: data.city || 'Unknown' }
        : lookupGeo(data.ip || '', { timezone: data.timezone || '' });
    const isBot = data.isBot != null ? Boolean(data.isBot) : isBotUserAgent(ua);

    const info = getDb()
      .prepare(
        `INSERT INTO page_loads (
           path, full_url, query_string, referrer, ip, user_agent, accept_language,
           language, platform, screen_width, screen_height, viewport_width, viewport_height,
           timezone, country, city, is_bot, user_id, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        data.path || '/',
        data.fullUrl || '',
        data.queryString || '',
        data.referrer || '',
        data.ip || '',
        ua,
        data.acceptLanguage || '',
        data.language || '',
        data.platform || '',
        data.screenWidth ?? null,
        data.screenHeight ?? null,
        data.viewportWidth ?? null,
        data.viewportHeight ?? null,
        data.timezone || '',
        geo.country || '',
        geo.city || '',
        isBot ? 1 : 0,
        data.userId ?? null,
        now()
      );
    return mapRow(getDb().prepare('SELECT * FROM page_loads WHERE id = ?').get(info.lastInsertRowid));
  },

  list({ limit = 50, offset = 0, path, ip } = {}) {
    const where = [];
    const params = [];
    if (path) {
      where.push('pl.path LIKE ?');
      params.push(`%${path}%`);
    }
    if (ip) {
      where.push('pl.ip LIKE ?');
      params.push(`%${ip}%`);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const rows = getDb()
      .prepare(
        `SELECT pl.*, u.name AS user_name, u.email AS user_email
         FROM page_loads pl
         LEFT JOIN users u ON u.id = pl.user_id
         ${whereSql}
         ORDER BY pl.created_at DESC
         LIMIT ? OFFSET ?`
      )
      .all(...params, Number(limit), Number(offset));
    return rows.map(mapRow);
  },

  count({ path, ip } = {}) {
    const where = [];
    const params = [];
    if (path) {
      where.push('path LIKE ?');
      params.push(`%${path}%`);
    }
    if (ip) {
      where.push('ip LIKE ?');
      params.push(`%${ip}%`);
    }
    const sql = where.length
      ? `SELECT COUNT(*) AS c FROM page_loads WHERE ${where.join(' AND ')}`
      : 'SELECT COUNT(*) AS c FROM page_loads';
    return getDb().prepare(sql).get(...params).c;
  },

  summary() {
    const db = getDb();
    const total = db.prepare('SELECT COUNT(*) AS c FROM page_loads').get().c;
    const uniqueIps = db.prepare('SELECT COUNT(DISTINCT ip) AS c FROM page_loads WHERE ip != \'\'').get().c;
    const today = db
      .prepare(`SELECT COUNT(*) AS c FROM page_loads WHERE date(created_at) = date('now')`)
      .get().c;
    const topPaths = db
      .prepare(
        `SELECT path, COUNT(*) AS count
         FROM page_loads
         GROUP BY path
         ORDER BY count DESC
         LIMIT 10`
      )
      .all();
    const topIps = db
      .prepare(
        `SELECT ip, COUNT(*) AS count
         FROM page_loads
         WHERE ip != ''
         GROUP BY ip
         ORDER BY count DESC
         LIMIT 10`
      )
      .all();
    const byDay = db
      .prepare(
        `SELECT date(created_at) AS day, COUNT(*) AS count
         FROM page_loads
         GROUP BY date(created_at)
         ORDER BY day DESC
         LIMIT 14`
      )
      .all();
    return { total, uniqueIps, today, topPaths, topIps, byDay };
  },

  demographics() {
    const db = getDb();

    const groupCount = (sql) => db.prepare(sql).all();

    const byLanguage = groupCount(
      `SELECT COALESCE(
         NULLIF(TRIM(language), ''),
         NULLIF(TRIM(substr(accept_language, 1, instr(accept_language || ',', ',') - 1)), ''),
         'Unknown'
       ) AS label, COUNT(*) AS count
       FROM page_loads
       GROUP BY label
       ORDER BY count DESC
       LIMIT 15`
    );

    const byPlatform = groupCount(
      `SELECT COALESCE(NULLIF(TRIM(platform), ''), 'Unknown') AS label, COUNT(*) AS count
       FROM page_loads
       GROUP BY label
       ORDER BY count DESC
       LIMIT 15`
    );

    const byTimezone = groupCount(
      `SELECT COALESCE(NULLIF(TRIM(timezone), ''), 'Unknown') AS label, COUNT(*) AS count
       FROM page_loads
       GROUP BY label
       ORDER BY count DESC
       LIMIT 15`
    );

    const byScreen = groupCount(
      `SELECT
         CASE
           WHEN screen_width IS NULL OR screen_height IS NULL THEN 'Unknown'
           ELSE printf('%d×%d', screen_width, screen_height)
         END AS label,
         COUNT(*) AS count
       FROM page_loads
       GROUP BY label
       ORDER BY count DESC
       LIMIT 15`
    );

    const byViewport = groupCount(
      `SELECT
         CASE
           WHEN viewport_width IS NULL OR viewport_height IS NULL THEN 'Unknown'
           ELSE printf('%d×%d', viewport_width, viewport_height)
         END AS label,
         COUNT(*) AS count
       FROM page_loads
       GROUP BY label
       ORDER BY count DESC
       LIMIT 15`
    );

    const byDevice = groupCount(
      `SELECT
         CASE
           WHEN screen_width IS NULL THEN 'Unknown'
           WHEN screen_width < 768 THEN 'Mobile'
           WHEN screen_width < 1024 THEN 'Tablet'
           ELSE 'Desktop'
         END AS label,
         COUNT(*) AS count
       FROM page_loads
       GROUP BY label
       ORDER BY count DESC`
    );

    const byBrowser = groupCount(
      `SELECT
         CASE
           WHEN user_agent = '' OR user_agent IS NULL THEN 'Unknown'
           WHEN user_agent LIKE '%Edg/%' THEN 'Edge'
           WHEN user_agent LIKE '%OPR/%' OR user_agent LIKE '%Opera%' THEN 'Opera'
           WHEN user_agent LIKE '%Chrome/%' AND user_agent NOT LIKE '%Edg/%' AND user_agent NOT LIKE '%OPR/%' THEN 'Chrome'
           WHEN user_agent LIKE '%Firefox/%' THEN 'Firefox'
           WHEN user_agent LIKE '%Safari/%' AND user_agent NOT LIKE '%Chrome/%' THEN 'Safari'
           ELSE 'Other'
         END AS label,
         COUNT(*) AS count
       FROM page_loads
       GROUP BY label
       ORDER BY count DESC`
    );

    // Prefer explicit platform, then refine with UA (Ubuntu, Android, etc.)
    const byOs = groupCount(
      `SELECT
         CASE
           WHEN user_agent LIKE '%Android%' THEN 'Android'
           WHEN user_agent LIKE '%iPhone%' OR user_agent LIKE '%iPad%' THEN 'iOS'
           WHEN user_agent LIKE '%Windows%' OR platform LIKE 'Win%' THEN 'Windows'
           WHEN user_agent LIKE '%Ubuntu%' THEN 'Ubuntu'
           WHEN user_agent LIKE '%CrOS%' THEN 'ChromeOS'
           WHEN user_agent LIKE '%Mac OS X%' OR user_agent LIKE '%Macintosh%' OR platform LIKE 'Mac%' THEN 'macOS'
           WHEN platform LIKE 'Linux%' OR user_agent LIKE '%Linux%' THEN 'Linux'
           WHEN NULLIF(TRIM(platform), '') IS NOT NULL THEN platform
           WHEN user_agent = '' OR user_agent IS NULL THEN 'Unknown'
           ELSE 'Other'
         END AS label,
         COUNT(*) AS count
       FROM page_loads
       GROUP BY label
       ORDER BY count DESC`
    );

    const byUserAgent = groupCount(
      `SELECT
         CASE
           WHEN user_agent = '' OR user_agent IS NULL THEN 'Unknown'
           ELSE substr(user_agent, 1, 120)
         END AS label,
         COUNT(*) AS count
       FROM page_loads
       GROUP BY label
       ORDER BY count DESC
       LIMIT 12`
    );

    const byClientProfile = groupCount(
      `SELECT
         trim(
           COALESCE(NULLIF(TRIM(platform), ''), 'Unknown') || ' · ' ||
           COALESCE(
             NULLIF(TRIM(language), ''),
             NULLIF(TRIM(substr(accept_language, 1, instr(accept_language || ',', ',') - 1)), ''),
             'Unknown'
           ) || ' · ' ||
           COALESCE(NULLIF(TRIM(timezone), ''), 'Unknown') || ' · ' ||
           CASE
             WHEN screen_width IS NULL OR screen_height IS NULL THEN 'Unknown'
             ELSE printf('%d×%d', screen_width, screen_height)
           END
         ) AS label,
         COUNT(*) AS count
       FROM page_loads
       GROUP BY label
       ORDER BY count DESC
       LIMIT 20`
    );

    const byAuth = groupCount(
      `SELECT
         CASE WHEN user_id IS NULL THEN 'Guest' ELSE 'Signed in' END AS label,
         COUNT(*) AS count
       FROM page_loads
       GROUP BY label
       ORDER BY count DESC`
    );

    const byReferrer = db
      .prepare(
        `SELECT
           CASE
             WHEN referrer IS NULL OR TRIM(referrer) = '' THEN 'Direct / none'
             WHEN referrer LIKE '%/%' THEN
               REPLACE(REPLACE(REPLACE(referrer, 'https://', ''), 'http://', ''), 'www.', '')
             ELSE referrer
           END AS raw,
           COUNT(*) AS count
         FROM page_loads
         GROUP BY raw
         ORDER BY count DESC
         LIMIT 40`
      )
      .all()
      .map((row) => {
        const raw = String(row.raw || '');
        if (!raw || raw === 'Direct / none') return { label: 'Direct / none', count: row.count };
        const host = raw.split('/')[0] || raw;
        return { label: host.slice(0, 60), count: row.count };
      })
      .reduce((acc, row) => {
        const existing = acc.find((x) => x.label === row.label);
        if (existing) existing.count += row.count;
        else acc.push(row);
        return acc;
      }, [])
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const byHour = groupCount(
      `SELECT printf('%02d', CAST(strftime('%H', created_at) AS INTEGER)) AS label, COUNT(*) AS count
       FROM page_loads
       GROUP BY label
       ORDER BY label`
    );

    const byDayAsc = groupCount(
      `SELECT date(created_at) AS label, COUNT(*) AS count
       FROM page_loads
       GROUP BY date(created_at)
       ORDER BY label ASC
       LIMIT 30`
    );

    const byCountry = groupCount(
      `SELECT COALESCE(NULLIF(TRIM(country), ''), 'Unknown') AS label, COUNT(*) AS count
       FROM page_loads
       GROUP BY label
       ORDER BY count DESC
       LIMIT 20`
    );

    const byCity = groupCount(
      `SELECT
         CASE
           WHEN NULLIF(TRIM(city), '') IS NULL AND NULLIF(TRIM(country), '') IS NULL THEN 'Unknown'
           WHEN NULLIF(TRIM(city), '') IS NULL THEN country
           WHEN NULLIF(TRIM(country), '') IS NULL THEN city
           WHEN city = country THEN city
           ELSE city || ', ' || country
         END AS label,
         COUNT(*) AS count
       FROM page_loads
       GROUP BY label
       ORDER BY count DESC
       LIMIT 20`
    );

    const byBot = groupCount(
      `SELECT CASE WHEN is_bot = 1 THEN 'Bot' ELSE 'Human' END AS label, COUNT(*) AS count
       FROM page_loads
       GROUP BY label
       ORDER BY count DESC`
    );

    const byPath = groupCount(
      `SELECT path AS label, COUNT(*) AS count
       FROM page_loads
       GROUP BY path
       ORDER BY count DESC
       LIMIT 15`
    );

    const byIp = groupCount(
      `SELECT
         CASE WHEN ip = '' OR ip IS NULL THEN 'Unknown' ELSE ip END AS label,
         COUNT(*) AS count
       FROM page_loads
       GROUP BY label
       ORDER BY count DESC
       LIMIT 15`
    );

    const byLoginMethod = groupCount(
      `SELECT
         CASE
           WHEN pl.user_id IS NULL THEN 'Guest'
           WHEN u.google_id IS NOT NULL AND TRIM(u.google_id) != '' THEN 'Google'
           WHEN u.github_id IS NOT NULL AND TRIM(u.github_id) != '' THEN 'GitHub'
           ELSE 'Password'
         END AS label,
         COUNT(*) AS count
       FROM page_loads pl
       LEFT JOIN users u ON u.id = pl.user_id
       GROUP BY label
       ORDER BY count DESC`
    );

    const byAccountLoginMethod = groupCount(
      `SELECT
         CASE
           WHEN google_id IS NOT NULL AND TRIM(google_id) != '' THEN 'Google'
           WHEN github_id IS NOT NULL AND TRIM(github_id) != '' THEN 'GitHub'
           ELSE 'Password'
         END AS label,
         COUNT(*) AS count
       FROM users
       GROUP BY label
       ORDER BY count DESC`
    );

    return {
      byLanguage,
      byPlatform,
      byTimezone,
      byScreen,
      byViewport,
      byDevice,
      byBrowser,
      byOs,
      byUserAgent,
      byClientProfile,
      byAuth,
      byReferrer,
      byHour,
      byDay: byDayAsc,
      byCountry,
      byCity,
      byBot,
      byPath,
      byIp,
      byLoginMethod,
      byAccountLoginMethod,
    };
  },
};

module.exports = PageLoad;

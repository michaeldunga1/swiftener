let geoip;

function loadGeoip() {
  if (geoip !== undefined) return geoip;
  try {
    // eslint-disable-next-line global-require
    geoip = require('geoip-lite');
  } catch {
    geoip = null;
  }
  return geoip;
}

const TZ_HINTS = {
  'Africa/Nairobi': { country: 'Kenya', city: 'Nairobi' },
  'Africa/Lagos': { country: 'Nigeria', city: 'Lagos' },
  'Africa/Cairo': { country: 'Egypt', city: 'Cairo' },
  'Africa/Johannesburg': { country: 'South Africa', city: 'Johannesburg' },
  'Europe/London': { country: 'United Kingdom', city: 'London' },
  'Europe/Paris': { country: 'France', city: 'Paris' },
  'Europe/Berlin': { country: 'Germany', city: 'Berlin' },
  'America/New_York': { country: 'United States', city: 'New York' },
  'America/Los_Angeles': { country: 'United States', city: 'Los Angeles' },
  'America/Chicago': { country: 'United States', city: 'Chicago' },
  'Asia/Dubai': { country: 'United Arab Emirates', city: 'Dubai' },
  'Asia/Kolkata': { country: 'India', city: 'Kolkata' },
  'Asia/Tokyo': { country: 'Japan', city: 'Tokyo' },
  'Australia/Sydney': { country: 'Australia', city: 'Sydney' },
};

const COUNTRY_NAMES = {
  KE: 'Kenya',
  NG: 'Nigeria',
  EG: 'Egypt',
  ZA: 'South Africa',
  GB: 'United Kingdom',
  US: 'United States',
  DE: 'Germany',
  FR: 'France',
  IN: 'India',
  AE: 'United Arab Emirates',
  JP: 'Japan',
  AU: 'Australia',
  CA: 'Canada',
  BR: 'Brazil',
  CN: 'China',
  RU: 'Russia',
  NL: 'Netherlands',
  SE: 'Sweden',
  UG: 'Uganda',
  TZ: 'Tanzania',
  RW: 'Rwanda',
  ET: 'Ethiopia',
};

function isPrivateIp(ip = '') {
  const value = String(ip || '')
    .replace(/^::ffff:/i, '')
    .trim();
  if (!value || value === '::1' || value === '127.0.0.1' || value === 'localhost') return true;
  if (value.startsWith('10.') || value.startsWith('192.168.') || value.startsWith('169.254.')) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(value)) return true;
  if (value.startsWith('fc') || value.startsWith('fd') || value.startsWith('fe80:')) return true;
  return false;
}

function fromTimezone(timezone) {
  const tz = String(timezone || '').trim();
  if (!tz) return null;
  if (TZ_HINTS[tz]) return { ...TZ_HINTS[tz] };
  if (tz.includes('/')) {
    const city = tz.split('/').pop().replace(/_/g, ' ');
    return { country: 'Unknown', city };
  }
  return null;
}

function lookupGeo(ip, { timezone } = {}) {
  const cleaned = String(ip || '')
    .replace(/^::ffff:/i, '')
    .trim();

  if (!cleaned || isPrivateIp(cleaned)) {
    const hint = fromTimezone(timezone);
    if (hint) return hint;
    return { country: 'Local / private', city: 'Local / private' };
  }

  const lib = loadGeoip();
  if (lib) {
    try {
      const hit = lib.lookup(cleaned);
      if (hit) {
        const code = hit.country || '';
        return {
          country: COUNTRY_NAMES[code] || code || 'Unknown',
          city: hit.city || hit.region || 'Unknown',
        };
      }
    } catch {
      /* fall through */
    }
  }

  const hint = fromTimezone(timezone);
  if (hint) return hint;
  return { country: 'Unknown', city: 'Unknown' };
}

module.exports = { lookupGeo, isPrivateIp };

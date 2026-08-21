const TZ_KEY = 'workspace_timezone';
const DATE_FMT_KEY = 'workspace_date_format';

export function getWorkspaceTz() {
  return localStorage.getItem(TZ_KEY) || 'Europe/London';
}

export function setWorkspaceTz(tz) {
  localStorage.setItem(TZ_KEY, tz);
}

export function getDateFormat() {
  return localStorage.getItem(DATE_FMT_KEY) || 'GB';
}

export function setDateFormat(fmt) {
  localStorage.setItem(DATE_FMT_KEY, fmt);
}

export function getTzLabel(tz) {
  try {
    const offset = getUtcOffset(tz);
    return `${tz.replace(/_/g, ' ')} (UTC${offset})`;
  } catch {
    return tz;
  }
}

export function getUtcOffset(tz) {
  try {
    const now = new Date();
    const utcDate = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
    const tzDate = new Date(now.toLocaleString('en-US', { timeZone: tz }));
    const diff = (tzDate - utcDate) / 60000;
    const h = Math.floor(Math.abs(diff) / 60);
    const m = Math.abs(diff) % 60;
    const sign = diff >= 0 ? '+' : '-';
    return `${sign}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  } catch {
    return '+00:00';
  }
}

// Returns all IANA timezones supported by the browser, sorted by UTC offset
export function getAllTimezones() {
  let zones;
  try {
    zones = Intl.supportedValuesOf('timeZone');
  } catch {
    // Fallback for older browsers
    zones = FALLBACK_ZONES;
  }

  return zones
    .map(tz => {
      const offset = getUtcOffset(tz);
      const sortKey = offsetToMinutes(offset);
      const region = tz.split('/')[0];
      const city = tz.split('/').slice(1).join('/').replace(/_/g, ' ') || tz;
      return { value: tz, label: `(UTC${offset}) ${tz.replace(/_/g, ' ')}`, offset, sortKey, region, city };
    })
    .sort((a, b) => a.sortKey - b.sortKey || a.value.localeCompare(b.value));
}

function offsetToMinutes(offset) {
  const sign = offset[0] === '+' ? 1 : -1;
  const [h, m] = offset.slice(1).split(':').map(Number);
  return sign * (h * 60 + m);
}

// Format a UTC ISO string into the workspace timezone
export function formatInTz(dateStr, options = {}) {
  if (!dateStr) return '—';
  const tz = getWorkspaceTz();
  const fmt = getDateFormat();
  const date = new Date(dateStr);
  if (isNaN(date)) return '—';

  const locale = fmt === 'US' ? 'en-US' : fmt === 'ISO' ? 'sv-SE' : 'en-GB';

  const defaults = {
    timeZone: tz,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  };

  if (options.timeOnly) {
    return date.toLocaleTimeString(locale, { timeZone: tz, hour: '2-digit', minute: '2-digit' });
  }

  if (options.dateTime) {
    return date.toLocaleString(locale, { ...defaults, hour: '2-digit', minute: '2-digit' });
  }

  return date.toLocaleDateString(locale, defaults);
}

// Common fallback zones if Intl.supportedValuesOf not available
const FALLBACK_ZONES = [
  'Pacific/Midway','Pacific/Honolulu','America/Anchorage','America/Los_Angeles',
  'America/Denver','America/Chicago','America/New_York','America/Caracas',
  'America/Halifax','America/St_Johns','America/Sao_Paulo','Atlantic/Azores',
  'UTC','Europe/London','Europe/Paris','Europe/Berlin','Europe/Helsinki',
  'Europe/Istanbul','Asia/Dubai','Asia/Karachi','Asia/Kolkata','Asia/Dhaka',
  'Asia/Bangkok','Asia/Shanghai','Asia/Tokyo','Australia/Sydney','Pacific/Auckland',
];

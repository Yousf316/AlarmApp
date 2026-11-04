const BASE_URL = 'https://api.aladhan.com/v1';
const REQUEST_TIMEOUT_MS = 15000;

export const PRAYERS = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

// Aladhan calculation methods: https://aladhan.com/calculation-methods
const METHOD_BY_COUNTRY = {
  SA: 4, // Umm Al-Qura, Makkah
  EG: 5, // Egyptian General Authority of Survey
  AE: 8, // Gulf Region
};
const DEFAULT_METHOD = 4;

export const getMethodForCountry = country =>
  METHOD_BY_COUNTRY[country] ?? DEFAULT_METHOD;

const fetchWithTimeout = async (url, timeoutMs = REQUEST_TIMEOUT_MS) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {signal: controller.signal});
  } finally {
    clearTimeout(timer);
  }
};

/**
 * Convert one Aladhan calendar entry (requested with iso8601=true) into:
 *   {
 *     date: 'DD-MM-YYYY',
 *     timings:    { Fajr: '04:41', ... }        – local time of the city, for display
 *     timestamps: { Fajr: 1793515260000, ... }  – exact instant (ms since epoch)
 *   }
 * Using the ISO string with its UTC offset makes alarms correct even when the
 * device timezone differs from the selected city's timezone.
 */
export const normalizeDay = entry => {
  const timings = {};
  const timestamps = {};
  for (const prayer of PRAYERS) {
    const iso = entry?.timings?.[prayer];
    if (typeof iso !== 'string') {
      continue;
    }
    const ms = Date.parse(iso);
    if (Number.isNaN(ms)) {
      continue;
    }
    timings[prayer] = iso.substring(11, 16); // "HH:MM" in the city's local time
    timestamps[prayer] = ms;
  }
  return {date: entry?.date?.gregorian?.date, timings, timestamps};
};

const fetchMonth = async (city, country, month, year) => {
  const url =
    `${BASE_URL}/calendarByCity?city=${encodeURIComponent(city)}` +
    `&country=${encodeURIComponent(country)}` +
    `&method=${getMethodForCountry(country)}` +
    `&month=${month}&year=${year}&iso8601=true`;

  const response = await fetchWithTimeout(url);
  const data = await response.json();
  if (data.code !== 200 || !Array.isArray(data.data)) {
    throw new Error(`Prayer API error: ${data.status || data.code}`);
  }
  return data.data.map(normalizeDay);
};

/**
 * Prayer times for today + the next (daysAhead - 1) days.
 * @returns {Promise<Array<{date:string,timings:object,timestamps:object}>|null>}
 */
export const getPrayerTimesForNextDays = async (
  city,
  country,
  daysAhead = 7,
) => {
  if (!city || !country) {
    return null;
  }
  try {
    const today = new Date();
    let month = today.getMonth() + 1;
    let year = today.getFullYear();

    const current = await fetchMonth(city, country, month, year);
    const result = current.slice(today.getDate() - 1, today.getDate() - 1 + daysAhead);

    if (result.length < daysAhead) {
      month += 1;
      if (month > 12) {
        month = 1;
        year += 1;
      }
      const next = await fetchMonth(city, country, month, year);
      result.push(...next.slice(0, daysAhead - result.length));
    }
    return result;
  } catch (error) {
    console.warn('Prayer API error:', error?.message ?? error);
    return null;
  }
};

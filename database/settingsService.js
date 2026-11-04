import {query, run} from './db';

export const DEFAULT_LOCATION = {city: 'Jeddah', country: 'SA'};

export const getSetting = async key => {
  const rows = await query('SELECT value FROM settings WHERE key = ?', [key]);
  return rows.length ? rows[0].value : null;
};

export const setSetting = (key, value) =>
  run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [
    key,
    value,
  ]);

/** @returns {Promise<{city:string,country:string}>} */
export const getLocation = async () => {
  const raw = await getSetting('location');
  if (!raw) {
    return DEFAULT_LOCATION;
  }
  try {
    const parsed = JSON.parse(raw);
    return parsed?.city && parsed?.country ? parsed : DEFAULT_LOCATION;
  } catch {
    return DEFAULT_LOCATION;
  }
};

export const setLocation = (city, country) =>
  setSetting('location', JSON.stringify({city, country}));

/** Last successfully fetched prayer times, used when offline. */
export const getPrayerCache = async () => {
  const raw = await getSetting('prayer_cache');
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const setPrayerCache = (city, country, days) =>
  setSetting('prayer_cache', JSON.stringify({city, country, days}));

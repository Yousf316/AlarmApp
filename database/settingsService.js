import {getJSON, setJSON, storage} from '../src/core/storage/mmkv';

export const DEFAULT_LOCATION = {city: 'Jeddah', country: 'SA'};

// Keys keep the "setting:" prefix used by the SQLite → MMKV migration.
export const getSetting = async key => storage.getString(`setting:${key}`) ?? null;

export const setSetting = async (key, value) => {
  storage.set(`setting:${key}`, value);
};

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

export {getJSON, setJSON};

import {fromAladhanDate} from '../time/zone';
import {METHODS, resolveMethod} from './methods';
import {PRAYERS} from './localCalc';

const BASE_URL = 'https://api.aladhan.com/v1';
const TIMEOUT_MS = 20000;

const fetchJson = async (url, fetchImpl) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetchImpl(url, {signal: controller.signal});
    if (!response.ok) {
      throw new Error(`Aladhan HTTP ${response.status}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
};

/** One Aladhan entry (iso8601=true) → { dateKey, times } or null. */
export const normalizeEntry = entry => {
  const dateKey = fromAladhanDate(entry?.date?.gregorian?.date);
  if (!dateKey) {
    return null;
  }
  const times = {};
  for (const prayer of PRAYERS) {
    // iso8601=true gives e.g. "2026-11-04T05:07:00+03:00" – an exact instant.
    const ms = Date.parse(entry?.timings?.[prayer]);
    if (Number.isNaN(ms)) {
      return null; // incomplete day: skip it, local calc fills the gap
    }
    times[prayer] = ms;
  }
  return {dateKey, times};
};

/**
 * A whole year in one request.
 * location: {lat,lng} or {city,country}.
 * @returns {Promise<{days: Record<string, Record<string, number>>, tz?: string, lat?: number, lng?: number}>}
 */
export const fetchYear = async ({location, method, year, fetchImpl = fetch}) => {
  const id = METHODS[resolveMethod(method)].aladhan;
  const common = `method=${id}&annual=true&iso8601=true`;
  const url =
    location.lat != null && location.lng != null
      ? `${BASE_URL}/calendar/${year}?latitude=${location.lat}&longitude=${location.lng}&${common}`
      : `${BASE_URL}/calendarByCity/${year}?city=${encodeURIComponent(
          location.city,
        )}&country=${encodeURIComponent(location.country)}&${common}`;

  const body = await fetchJson(url, fetchImpl);
  if (body?.code !== 200 || !body.data || typeof body.data !== 'object') {
    throw new Error(`Aladhan error: ${body?.status ?? body?.code}`);
  }

  const days = {};
  let meta = null;
  for (const month of Object.values(body.data)) {
    for (const entry of Array.isArray(month) ? month : []) {
      const day = normalizeEntry(entry);
      if (day) {
        days[day.dateKey] = day.times;
        meta = meta ?? entry.meta;
      }
    }
  }
  if (!Object.keys(days).length) {
    throw new Error('Aladhan returned no usable days');
  }
  return {
    days,
    tz: meta?.timezone,
    lat: meta?.latitude != null ? Number(meta.latitude) : undefined,
    lng: meta?.longitude != null ? Number(meta.longitude) : undefined,
  };
};

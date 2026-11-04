import {addDays, dateKeyOf, deviceZone} from '../time/zone';
import {DEFAULT_METHOD, resolveMethod} from './methods';
import {lookupCity} from './cities';
import {computeDays, supportsLocal} from './localCalc';
import {fetchYear} from './aladhan';

/** Refresh when fewer than this many consecutive days are stored. */
export const MIN_COVERAGE_DAYS = 45;
/** How far the offline fallback computes. */
export const LOCAL_FILL_DAYS = 120;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Identifies "which timetable is this": rounded coordinates (≈11 km) or the
 * city name, plus the calculation method. A change means refetch.
 */
export const timetableKey = (location, method = DEFAULT_METHOD) => {
  const m = resolveMethod(method);
  if (location.lat != null && location.lng != null) {
    return `gps:${Number(location.lat).toFixed(1)},${Number(location.lng).toFixed(1)}|${m}`;
  }
  return `city:${location.country}:${location.city}|${m}`.toLowerCase();
};

/** Consecutive days with data, counted from today (in the timetable's zone). */
export const coverageDays = (timetable, now = Date.now()) => {
  if (!timetable?.days || !timetable.tz) {
    return 0;
  }
  let key = dateKeyOf(now, timetable.tz);
  let count = 0;
  while (timetable.days[key]) {
    count++;
    key = addDays(key, 1, timetable.tz);
  }
  return count;
};

/** @returns {string|null} why a refresh is needed, or null */
export const needsRefresh = ({timetable, location, method, now = Date.now()}) => {
  if (!timetable) {
    return 'empty';
  }
  if (timetable.key !== timetableKey(location, method)) {
    return 'location-or-method-changed';
  }
  if (coverageDays(timetable, now) < MIN_COVERAGE_DAYS) {
    return 'low-coverage';
  }
  return null;
};

const coordinatesFor = (location, cached) => {
  if (location.lat != null && location.lng != null) {
    return {lat: location.lat, lng: location.lng, tz: cached?.tz ?? location.tz ?? deviceZone()};
  }
  if (cached?.lat != null && cached?.lng != null && cached?.tz) {
    return {lat: cached.lat, lng: cached.lng, tz: cached.tz};
  }
  return lookupCity(location.city, location.country);
};

const prune = (days, now, tz) => {
  const earliest = dateKeyOf(now - DAY_MS, tz);
  return Object.fromEntries(Object.entries(days).filter(([key]) => key >= earliest));
};

/**
 * Prayer timetable for the next weeks, resilient to every failure:
 *
 *   cached & fresh  → cached
 *   otherwise       → API (whole year, next year when needed)
 *   API fails       → offline calculation (adhan) merged under any cached API days
 *   nothing works   → stale cache, or null
 *
 * @param {object} args
 * @param {{lat?:number,lng?:number,tz?:string,city?:string,country?:string}} args.location
 * @param {{load:()=>object|null, save:(t:object)=>void}} args.store
 * @returns {Promise<{timetable:object, status:'cached'|'api'|'local'|'stale', error?:string}|null>}
 */
export const getTimetable = async ({
  location,
  method = DEFAULT_METHOD,
  now = Date.now(),
  force = false,
  store,
  fetchImpl,
}) => {
  const key = timetableKey(location, method);
  const stored = store.load();
  const cached = stored && stored.key === key ? stored : null;

  if (!force && cached && coverageDays(cached, now) >= MIN_COVERAGE_DAYS) {
    return {timetable: cached, status: 'cached'};
  }

  const coords = coordinatesFor(location, cached);
  let error;

  try {
    const zoneGuess = cached?.tz ?? coords?.tz ?? deviceZone();
    const year = Number(dateKeyOf(now, zoneGuess).slice(0, 4));
    const first = await fetchYear({location, method, year, fetchImpl});

    let days = {...(cached?.days ?? {}), ...first.days};
    const tz = first.tz ?? cached?.tz ?? coords?.tz ?? zoneGuess;
    const draft = {
      key,
      tz,
      lat: first.lat ?? coords?.lat,
      lng: first.lng ?? coords?.lng,
      source: 'api',
      fetchedAt: now,
      days,
    };

    if (coverageDays(draft, now) < MIN_COVERAGE_DAYS) {
      try {
        const next = await fetchYear({location, method, year: year + 1, fetchImpl});
        days = {...days, ...next.days};
      } catch (e) {
        error = e?.message ?? String(e); // year-end coverage is topped up below
      }
    }

    let timetable = {...draft, days};
    if (coverageDays(timetable, now) < MIN_COVERAGE_DAYS && coords && supportsLocal(method)) {
      timetable = {
        ...timetable,
        days: {
          ...computeDays({
            lat: timetable.lat ?? coords.lat,
            lng: timetable.lng ?? coords.lng,
            tz,
            method,
            startDateKey: dateKeyOf(now, tz),
            days: LOCAL_FILL_DAYS,
          }),
          ...timetable.days,
        },
        source: 'mixed',
      };
    }
    timetable.days = prune(timetable.days, now, tz);
    store.save(timetable);
    return {timetable, status: 'api', ...(error ? {error} : {})};
  } catch (e) {
    error = e?.message ?? String(e);
  }

  // API unavailable → offline calculation.
  if (coords && supportsLocal(method)) {
    const tz = cached?.tz ?? coords.tz;
    const local = computeDays({
      lat: coords.lat,
      lng: coords.lng,
      tz,
      method,
      startDateKey: dateKeyOf(now, tz),
      days: LOCAL_FILL_DAYS,
    });
    const timetable = {
      key,
      tz,
      lat: coords.lat,
      lng: coords.lng,
      source: cached?.source === 'api' || cached?.source === 'mixed' ? 'mixed' : 'local',
      fetchedAt: now,
      // Days that came from the API keep priority over computed ones.
      days: prune({...local, ...(cached?.days ?? {})}, now, tz),
    };
    store.save(timetable);
    return {timetable, status: 'local', error};
  }

  if (cached && coverageDays(cached, now) > 0) {
    return {timetable: cached, status: 'stale', error};
  }
  return null;
};

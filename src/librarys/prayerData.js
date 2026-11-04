import {getPrayerTimesForNextDays} from '../../api/prayerTimes';
import {getPrayerCache, setPrayerCache} from '../../database/settingsService';

export const DAYS_AHEAD = 20;
const MEMO_TTL_MS = 10 * 60 * 1000;

let memo = null; // { key, at, promise }

/**
 * Load prayer times for a location: network first, falling back to the last
 * cached response (so deleting/rescheduling still works offline).
 * Concurrent / recent calls for the same location share one request.
 *
 * @returns {Promise<{days: Array, fromCache: boolean} | null>}
 */
export const loadPrayerTimes = ({city, country}, {force = false} = {}) => {
  const key = `${city}|${country}`;
  if (!force && memo && memo.key === key && Date.now() - memo.at < MEMO_TTL_MS) {
    return memo.promise;
  }

  const promise = (async () => {
    const days = await getPrayerTimesForNextDays(city, country, DAYS_AHEAD);
    if (days && days.length) {
      await setPrayerCache(city, country, days);
      return {days, fromCache: false};
    }
    const cache = await getPrayerCache();
    if (cache && cache.city === city && cache.country === country && cache.days?.length) {
      return {days: cache.days, fromCache: true};
    }
    return null;
  })();

  memo = {key, at: Date.now(), promise};
  promise.then(
    result => {
      // don't memoize failures / stale cache – retry next time
      if (!result || result.fromCache) {
        memo = null;
      }
    },
    () => {
      memo = null;
    },
  );
  return promise;
};

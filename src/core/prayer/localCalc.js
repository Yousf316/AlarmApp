import {Coordinates, CalculationMethod, PrayerTimes} from 'adhan';
import {addDays, partsOf} from '../time/zone';
import {METHODS, resolveMethod} from './methods';

export const PRAYERS = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

/** @returns {boolean} whether the method can be computed offline */
export const supportsLocal = methodId => !!METHODS[resolveMethod(methodId)].adhan;

/**
 * Compute `days` days of prayer instants starting at `startDateKey`
 * (a date in the location's zone) entirely offline.
 *
 * adhan reads Y/M/D of the Date it is given in the *device* zone, so the Date
 * is built from the location's calendar-date components; the result is
 * absolute UTC instants and does not depend on the device zone.
 *
 * @returns {Record<string, Record<string, number>>} { 'YYYY-MM-DD': {Fajr: ms, …} }
 */
export const computeDays = ({lat, lng, tz, method, startDateKey, days}) => {
  const methodName = METHODS[resolveMethod(method)].adhan ?? METHODS.UmmAlQura.adhan;
  const coordinates = new Coordinates(lat, lng);
  const out = {};
  for (let i = 0; i < days; i++) {
    const key = addDays(startDateKey, i, tz);
    const {year, month, day} = partsOf(key);
    const times = new PrayerTimes(
      coordinates,
      new Date(year, month - 1, day),
      CalculationMethod[methodName](),
    );
    out[key] = {
      Fajr: times.fajr.getTime(),
      Dhuhr: times.dhuhr.getTime(),
      Asr: times.asr.getTime(),
      Maghrib: times.maghrib.getTime(),
      Isha: times.isha.getTime(),
    };
  }
  return out;
};

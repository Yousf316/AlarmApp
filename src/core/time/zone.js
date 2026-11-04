import {DateTime} from 'luxon';

/**
 * Date keys ('YYYY-MM-DD') are always relative to a given IANA zone – the
 * prayer location's zone – never the device's, so a day boundary does not
 * move when the phone's timezone changes.
 */

export const isValidZone = tz => !!tz && DateTime.local().setZone(tz).isValid;

export const deviceZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
};

export const dateKeyOf = (ms, tz) =>
  DateTime.fromMillis(ms, {zone: tz}).toFormat('yyyy-LL-dd');

/** 0 = Sunday … 6 = Saturday (matches JS Date.getDay). */
export const weekdayOf = (dateKey, tz) =>
  DateTime.fromISO(dateKey, {zone: tz}).weekday % 7;

export const addDays = (dateKey, n, tz = 'UTC') =>
  DateTime.fromISO(dateKey, {zone: tz}).plus({days: n}).toFormat('yyyy-LL-dd');

/** 'DD-MM-YYYY' (Aladhan) → 'YYYY-MM-DD'. Returns null if malformed. */
export const fromAladhanDate = value => {
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value ?? '');
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
};

/** Y, M, D of a dateKey. */
export const partsOf = dateKey => {
  const [year, month, day] = dateKey.split('-').map(Number);
  return {year, month, day};
};

import {DateTime} from 'luxon';
import {dateKeyOf, partsOf, weekdayOf} from './zone';

// Fixed tables: Hermes' Intl may lack Arabic data, and these must never fall
// back to English.
const WEEKDAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const MONTHS = [
  'يناير',
  'فبراير',
  'مارس',
  'أبريل',
  'مايو',
  'يونيو',
  'يوليو',
  'أغسطس',
  'سبتمبر',
  'أكتوبر',
  'نوفمبر',
  'ديسمبر',
];

/** Coverage shorter than this many days is shown as a warning. */
export const WARN_BELOW_DAYS = 2;

/** Whole calendar days from `now` to `ms`, in the given zone. */
export const daysUntil = (ms, tz, now = Date.now()) =>
  Math.round(
    DateTime.fromISO(dateKeyOf(ms, tz), {zone: tz})
      .diff(DateTime.fromISO(dateKeyOf(now, tz), {zone: tz}), 'days').days,
  );

const countLabel = days => {
  if (days <= 0) {
    return 'اليوم';
  }
  if (days === 1) {
    return 'غداً';
  }
  if (days === 2) {
    return 'يومان';
  }
  return days <= 10 ? `${days} أيام` : `${days} يوماً`;
};

/**
 * "المنبهات مجدولة حتى الخميس 12 نوفمبر (6 أيام)".
 * @returns {{text:string, days:number, warn:boolean}|null} null when nothing is scheduled
 */
export const formatCoverage = ({coverageUntil, tz, now = Date.now()}) => {
  if (coverageUntil == null) {
    return null;
  }
  const key = dateKeyOf(coverageUntil, tz);
  const {month, day} = partsOf(key);
  const days = daysUntil(coverageUntil, tz, now);
  return {
    text: `المنبهات مجدولة حتى ${WEEKDAYS[weekdayOf(key, tz)]} ${day} ${MONTHS[month - 1]} (${countLabel(days)})`,
    days,
    warn: days < WARN_BELOW_DAYS,
  };
};

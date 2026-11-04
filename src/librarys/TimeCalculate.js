/**
 * Pure time helpers (no UI side effects – callers decide how to report errors).
 */

const pad = n => n.toString().padStart(2, '0');

/**
 * Parse 'DD-MM-YYYY' (Aladhan format) or 'YYYY-MM-DD' into {year, month, day}.
 */
export const parseDateString = date => {
  if (typeof date !== 'string') {
    return null;
  }
  const parts = date.split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) {
    return null;
  }
  const [a, b, c] = parts;
  return a > 1900 ? {year: a, month: b, day: c} : {year: c, month: b, day: a};
};

/** Parse 'HH:MM' or 'HH:MM (+03)' into {hour, minute}. */
export const parseTimeString = time => {
  if (typeof time !== 'string' || !time.includes(':')) {
    return null;
  }
  const [h, m] = time.split(' ')[0].split(':').map(p => parseInt(p, 10));
  if (Number.isNaN(h) || Number.isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) {
    return null;
  }
  return {hour: h, minute: m};
};

/**
 * Compute the alarm instant `hoursBefore:minutesBefore` before a prayer.
 *
 * @param {object} args
 * @param {number} [args.prayerTimestamp] exact prayer instant in ms (preferred)
 * @param {string} [args.date]            'DD-MM-YYYY' – fallback when no timestamp
 * @param {string} [args.prayerTime]      'HH:MM'      – fallback when no timestamp
 * @param {number} args.hoursBefore
 * @param {number} args.minutesBefore
 * @returns {number|null} alarm timestamp in ms, or null if input is invalid
 */
export const calculateAlarmTimestamp = ({
  prayerTimestamp,
  date,
  prayerTime,
  hoursBefore,
  minutesBefore,
}) => {
  const h = Number(hoursBefore);
  const m = Number(minutesBefore);
  if (!Number.isFinite(h) || !Number.isFinite(m) || h < 0 || m < 0) {
    return null;
  }
  const offsetMs = (h * 60 + m) * 60 * 1000;

  if (Number.isFinite(prayerTimestamp)) {
    return prayerTimestamp - offsetMs;
  }

  // Fallback: interpret date + time in the device's local timezone.
  const d = parseDateString(date);
  const t = parseTimeString(prayerTime);
  if (!d || !t) {
    return null;
  }
  const local = new Date(d.year, d.month - 1, d.day, t.hour, t.minute, 0, 0);
  // setMinutes handles day/month rollover (e.g. 5h before Fajr → previous day)
  local.setMinutes(local.getMinutes() - (h * 60 + m));
  return local.getTime();
};

/** '17:05' → '5:05 PM' */
export const convertTo12HourFormat = time => {
  const t = parseTimeString(time);
  if (!t) {
    return '';
  }
  const period = t.hour >= 12 ? 'PM' : 'AM';
  return `${t.hour % 12 || 12}:${pad(t.minute)} ${period}`;
};

/** Date → 'HH:MM' in the device's timezone. */
export const formatTime = date => `${pad(date.getHours())}:${pad(date.getMinutes())}`;

/** (1, 5) → '01:05' */
export const formatDuration = (hour, minute) => `${pad(hour)}:${pad(minute)}`;

export const isValidTime = (hours, minutes) =>
  hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60;

// Backwards-compatible class wrapper for existing call sites.
class TimeCalculate {
  convertTo12HourFormat = convertTo12HourFormat;
  formatTime = formatTime;
  static isValidTime = isValidTime;
}

export default TimeCalculate;

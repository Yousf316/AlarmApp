import {
  calculateAlarmTimestamp,
  convertTo12HourFormat,
  formatDuration,
  parseDateString,
} from '../src/librarys/TimeCalculate';
import {normalizeDay} from '../api/prayerTimes';

describe('calculateAlarmTimestamp', () => {
  it('subtracts the offset from an exact prayer timestamp', () => {
    const fajr = Date.parse('2026-11-05T04:41:00+03:00');
    const ts = calculateAlarmTimestamp({
      prayerTimestamp: fajr,
      hoursBefore: 0,
      minutesBefore: 10,
    });
    expect(new Date(ts).toISOString()).toBe('2026-11-05T01:31:00.000Z'); // 04:31 +03
  });

  it('crosses midnight to the previous day (bug: alarm fired 24h late on iOS)', () => {
    const fajr = Date.parse('2026-11-05T04:30:00+03:00');
    const ts = calculateAlarmTimestamp({
      prayerTimestamp: fajr,
      hoursBefore: 5,
      minutesBefore: 0,
    });
    expect(new Date(ts).toISOString()).toBe('2026-11-04T20:30:00.000Z'); // 23:30 +03 on the 4th
  });

  it('fallback: DD-MM-YYYY + HH:MM is interpreted in local time, not UTC', () => {
    const ts = calculateAlarmTimestamp({
      date: '05-11-2026',
      prayerTime: '04:30 (+03)',
      hoursBefore: 5,
      minutesBefore: 0,
    });
    const d = new Date(ts);
    expect([d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes()]).toEqual([
      2026, 11, 4, 23, 30,
    ]);
  });

  it('returns null for invalid input instead of showing UI alerts', () => {
    expect(calculateAlarmTimestamp({date: 'x', prayerTime: 'y', hoursBefore: 0, minutesBefore: 5})).toBeNull();
    expect(calculateAlarmTimestamp({prayerTimestamp: 1, hoursBefore: NaN, minutesBefore: 5})).toBeNull();
  });
});

describe('formatting helpers', () => {
  it('formats durations with padding (was "0:5")', () => {
    expect(formatDuration(0, 5)).toBe('00:05');
  });

  it('converts to 12-hour format', () => {
    expect(convertTo12HourFormat('17:05')).toBe('5:05 PM');
    expect(convertTo12HourFormat('00:15 (+03)')).toBe('12:15 AM');
    expect(convertTo12HourFormat(undefined)).toBe('');
  });

  it('parses both date formats', () => {
    expect(parseDateString('05-11-2026')).toEqual({year: 2026, month: 11, day: 5});
    expect(parseDateString('2026-11-05')).toEqual({year: 2026, month: 11, day: 5});
  });
});

describe('normalizeDay (Aladhan iso8601 response)', () => {
  it('keeps the city-local display time and the exact instant', () => {
    const day = normalizeDay({
      timings: {
        Fajr: '2026-11-01T04:41:00+02:00',
        Dhuhr: '2026-11-01T11:39:00+02:00',
        Sunrise: '2026-11-01T06:09:00+02:00',
      },
      date: {gregorian: {date: '01-11-2026'}},
    });
    expect(day.date).toBe('01-11-2026');
    expect(day.timings).toEqual({Fajr: '04:41', Dhuhr: '11:39'});
    expect(day.timestamps.Fajr).toBe(Date.UTC(2026, 10, 1, 2, 41));
  });
});

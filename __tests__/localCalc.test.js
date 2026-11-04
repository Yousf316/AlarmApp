/* eslint-env jest */
import {computeDays, supportsLocal} from '../src/core/prayer/localCalc';
import {METHODS, resolveMethod} from '../src/core/prayer/methods';
import {lookupCity} from '../src/core/prayer/cities';
import {addDays, dateKeyOf, fromAladhanDate, weekdayOf} from '../src/core/time/zone';

const MIN = 60 * 1000;
const MAKKAH = {lat: 21.4225, lng: 39.8262, tz: 'Asia/Riyadh'};

describe('computeDays (adhan, offline)', () => {
  it('matches known Makkah / Umm Al-Qura times for 4 Nov 2026 (±2 min)', () => {
    const day = computeDays({...MAKKAH, method: 'UmmAlQura', startDateKey: '2026-11-04', days: 1})['2026-11-04'];
    const expected = {
      Fajr: '2026-11-04T05:07:00+03:00',
      Dhuhr: '2026-11-04T12:04:00+03:00',
      Asr: '2026-11-04T15:18:00+03:00',
      Maghrib: '2026-11-04T17:43:00+03:00',
      Isha: '2026-11-04T19:13:00+03:00',
    };
    for (const [prayer, iso] of Object.entries(expected)) {
      expect(Math.abs(day[prayer] - Date.parse(iso))).toBeLessThanOrEqual(2 * MIN);
    }
  });

  it('returns consecutive date keys across month and year ends', () => {
    const out = computeDays({...MAKKAH, method: 'UmmAlQura', startDateKey: '2026-12-30', days: 4});
    expect(Object.keys(out)).toEqual(['2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02']);
  });

  it('prayers are ordered within a day', () => {
    const day = computeDays({...MAKKAH, method: 'MuslimWorldLeague', startDateKey: '2026-06-01', days: 1})['2026-06-01'];
    const order = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'].map(p => day[p]);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it('result does not depend on the device timezone', () => {
    const original = process.env.TZ;
    const run = tz => {
      process.env.TZ = tz;
      return computeDays({...MAKKAH, method: 'UmmAlQura', startDateKey: '2026-11-04', days: 3});
    };
    try {
      const a = run('Pacific/Auckland');
      const b = run('America/Los_Angeles');
      const c = run('UTC');
      expect(b).toEqual(a);
      expect(c).toEqual(a);
    } finally {
      if (original === undefined) {
        delete process.env.TZ;
      } else {
        process.env.TZ = original;
      }
    }
  });
});

describe('methods', () => {
  it('maps app ids to Aladhan ids and falls back to Umm Al-Qura', () => {
    expect(METHODS.UmmAlQura.aladhan).toBe(4);
    expect(resolveMethod('nonsense')).toBe('UmmAlQura');
    expect(resolveMethod(undefined)).toBe('UmmAlQura');
  });

  it('flags API-only methods', () => {
    expect(supportsLocal('UmmAlQura')).toBe(true);
    expect(supportsLocal('Gulf')).toBe(false);
  });
});

describe('cities and zone helpers', () => {
  it('knows Jeddah and is case-insensitive', () => {
    expect(lookupCity('JEDDAH', 'sa')).toMatchObject({tz: 'Asia/Riyadh'});
    expect(lookupCity('Atlantis', 'XX')).toBeNull();
  });

  it('dateKeyOf uses the given zone, not the device’s', () => {
    const instant = Date.parse('2026-11-06T21:30:00Z'); // 00:30 on the 7th in Riyadh
    expect(dateKeyOf(instant, 'Asia/Riyadh')).toBe('2026-11-07');
    expect(dateKeyOf(instant, 'America/New_York')).toBe('2026-11-06');
  });

  it('weekdayOf: 0 = Sunday … 5 = Friday', () => {
    expect(weekdayOf('2026-11-06', 'Asia/Riyadh')).toBe(5);
    expect(weekdayOf('2026-11-08', 'Asia/Riyadh')).toBe(0);
  });

  it('addDays handles month/year/leap boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('fromAladhanDate converts DD-MM-YYYY and rejects junk', () => {
    expect(fromAladhanDate('04-11-2026')).toBe('2026-11-04');
    expect(fromAladhanDate('2026-11-04')).toBeNull();
    expect(fromAladhanDate(undefined)).toBeNull();
  });
});

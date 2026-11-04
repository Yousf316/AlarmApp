/* eslint-env jest */
import {daysUntil, formatCoverage} from '../src/core/time/format';
import {methodForCountry} from '../src/core/prayer/methods';

const TZ = 'Asia/Riyadh';
const at = (dateKey, hh = '05') => Date.parse(`${dateKey}T${hh}:00:00+03:00`);

describe('formatCoverage', () => {
  const coverageUntil = at('2026-11-12');

  it('names the weekday and date with the number of days left', () => {
    const result = formatCoverage({coverageUntil, tz: TZ, now: at('2026-11-06', '10')});
    expect(result.text).toBe('المنبهات مجدولة حتى الخميس 12 نوفمبر (6 أيام)');
    expect(result.days).toBe(6);
    expect(result.warn).toBe(false);
  });

  it('warns when less than two days are left', () => {
    expect(formatCoverage({coverageUntil, tz: TZ, now: at('2026-11-11', '10')})).toMatchObject({
      days: 1,
      warn: true,
    });
    expect(formatCoverage({coverageUntil, tz: TZ, now: at('2026-11-10', '10')})).toMatchObject({
      days: 2,
      warn: false,
    });
  });

  it('says today / tomorrow / two days instead of a bare number', () => {
    const text = now => formatCoverage({coverageUntil, tz: TZ, now}).text;
    expect(text(at('2026-11-12', '01'))).toContain('(اليوم)');
    expect(text(at('2026-11-11', '10'))).toContain('(غداً)');
    expect(text(at('2026-11-10', '10'))).toContain('(يومان)');
    expect(text(at('2026-11-01', '10'))).toContain('(11 يوماً)');
  });

  it('counts days in the prayer location zone, not the device zone', () => {
    // 23:30 UTC on the 11th is already the 12th in Riyadh (UTC+3).
    const now = Date.parse('2026-11-11T23:30:00Z');
    expect(daysUntil(coverageUntil, TZ, now)).toBe(0);
  });

  it('is null when nothing is scheduled', () => {
    expect(formatCoverage({coverageUntil: null, tz: TZ})).toBeNull();
  });
});

describe('methodForCountry', () => {
  it('matches the method the prayer-times screen uses', () => {
    expect(methodForCountry('SA')).toBe('UmmAlQura');
    expect(methodForCountry('EG')).toBe('Egyptian');
    expect(methodForCountry('AE')).toBe('Gulf');
    expect(methodForCountry('XX')).toBe('UmmAlQura');
  });
});

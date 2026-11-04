/* eslint-env jest */
import {DEFAULT_ALARM, fromLegacyUserTime, normalizeAlarm} from '../src/core/alarms/model';

describe('normalizeAlarm', () => {
  it('fills defaults', () => {
    expect(normalizeAlarm({id: 1, prayer: 'Fajr'})).toEqual({id: '1', prayer: 'Fajr', ...DEFAULT_ALARM});
  });

  it('rejects unknown prayers and missing ids', () => {
    expect(normalizeAlarm({id: 1, prayer: 'Sunrise'})).toBeNull();
    expect(normalizeAlarm({prayer: 'Fajr'})).toBeNull();
    expect(normalizeAlarm(null)).toBeNull();
  });

  it('clamps free-form minutes and snooze settings', () => {
    const a = normalizeAlarm({id: 1, prayer: 'Asr', offsetMin: 99999, snoozeMin: -4, maxSnooze: 500});
    expect(a.offsetMin).toBe(720);
    expect(a.snoozeMin).toBe(0);
    expect(a.maxSnooze).toBe(20);
    expect(normalizeAlarm({id: 1, prayer: 'Asr', offsetMin: 'abc'}).offsetMin).toBe(DEFAULT_ALARM.offsetMin);
  });

  it('adhan alarms always have offset 0; invalid kind/style fall back', () => {
    expect(normalizeAlarm({id: 1, prayer: 'Isha', kind: 'adhan', offsetMin: 30}).offsetMin).toBe(0);
    const a = normalizeAlarm({id: 1, prayer: 'Isha', kind: 'weird', style: 'weird'});
    expect(a.kind).toBe('before');
    expect(a.style).toBe('alarm');
  });

  it('dedupes, sorts and validates weekdays', () => {
    expect(normalizeAlarm({id: 1, prayer: 'Fajr', days: [5, 1, 5, 9, -1, 'x']}).days).toEqual([1, 5]);
  });

  it('enabled defaults to true and respects false', () => {
    expect(normalizeAlarm({id: 1, prayer: 'Fajr'}).enabled).toBe(true);
    expect(normalizeAlarm({id: 1, prayer: 'Fajr', enabled: false}).enabled).toBe(false);
  });
});

describe('fromLegacyUserTime', () => {
  it('turns "1h30 before Fajr+Isha" into two alarms', () => {
    const alarms = fromLegacyUserTime({id: 7, hour: 1, minute: 30, prayers: ['Fajr', 'Isha']});
    expect(alarms.map(a => [a.id, a.prayer, a.kind, a.offsetMin])).toEqual([
      ['legacy-7-Fajr', 'Fajr', 'before', 90],
      ['legacy-7-Isha', 'Isha', 'before', 90],
    ]);
  });

  it('keeps the old behaviour: 5-minute snooze, no limit', () => {
    const [a] = fromLegacyUserTime({id: 7, hour: 0, minute: 10, prayers: ['Fajr']});
    expect([a.snoozeMin, a.maxSnooze]).toEqual([5, 0]);
  });

  it('copes with empty prayers', () => {
    expect(fromLegacyUserTime({id: 1, hour: 0, minute: 5, prayers: []})).toEqual([]);
    expect(fromLegacyUserTime({id: 1, hour: 0, minute: 5})).toEqual([]);
  });
});

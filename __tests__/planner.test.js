/* eslint-env jest */
import {
  applyAdjustment,
  buildLabel,
  fingerprintOf,
  occurrenceId,
  planOccurrences,
} from '../src/core/alarms/planner';
import {normalizeAlarm} from '../src/core/alarms/model';

const MIN = 60 * 1000;
const TZ = 'Asia/Riyadh'; // UTC+3, no DST

/** Riyadh wall-clock → instant. */
const at = (dateKey, hh, mm) => Date.parse(`${dateKey}T${hh}:${mm}:00+03:00`);

const day = (dateKey, fajr = [4, 40]) => ({
  Fajr: at(dateKey, String(fajr[0]).padStart(2, '0'), String(fajr[1]).padStart(2, '0')),
  Dhuhr: at(dateKey, '11', '50'),
  Asr: at(dateKey, '15', '10'),
  Maghrib: at(dateKey, '17', '40'),
  Isha: at(dateKey, '19', '10'),
});

const timetable = (...keys) => ({tz: TZ, days: Object.fromEntries(keys.map(k => [k, day(k)]))});

const alarm = (over = {}) =>
  normalizeAlarm({id: 'a1', prayer: 'Fajr', kind: 'before', offsetMin: 30, ...over});

const NOW = at('2026-11-03', '00', '00');

describe('planOccurrences – before / after / adhan', () => {
  const tt = timetable('2026-11-04');

  it('before = prayer − offset', () => {
    const [o] = planOccurrences({alarms: [alarm()], timetable: tt, now: NOW});
    expect(o.fireAt).toBe(at('2026-11-04', '04', '10'));
    expect(o.label).toBe('قبل الفجر بـ 00:30');
  });

  it('after = prayer + offset', () => {
    const [o] = planOccurrences({
      alarms: [alarm({kind: 'after', offsetMin: 45, prayer: 'Isha'})],
      timetable: tt,
      now: NOW,
    });
    expect(o.fireAt).toBe(at('2026-11-04', '19', '55'));
    expect(o.label).toBe('بعد العشاء بـ 00:45');
  });

  it('adhan rings exactly at the prayer time and ignores any offset', () => {
    const [o] = planOccurrences({
      alarms: [alarm({kind: 'adhan', offsetMin: 99, prayer: 'Maghrib'})],
      timetable: tt,
      now: NOW,
    });
    expect(o.fireAt).toBe(at('2026-11-04', '17', '40'));
    expect(o.label).toBe('حان وقت أذان المغرب');
  });

  it('several alarms for one prayer coexist (before and after)', () => {
    const plan = planOccurrences({
      alarms: [alarm({id: 'x', offsetMin: 60}), alarm({id: 'y', kind: 'after', offsetMin: 10})],
      timetable: tt,
      now: NOW,
    });
    expect(plan.map(p => p.alarmId)).toEqual(['x', 'y']);
  });

  it('applies manual per-prayer adjustments in minutes', () => {
    const [o] = planOccurrences({
      alarms: [alarm()],
      timetable: tt,
      adjustments: {Fajr: 3},
      now: NOW,
    });
    expect(o.fireAt).toBe(at('2026-11-04', '04', '13'));
    expect(applyAdjustment(1000, {Asr: -2}, 'Asr')).toBe(1000 - 2 * MIN);
    expect(applyAdjustment(1000, {}, 'Asr')).toBe(1000);
  });

  it('skips disabled alarms and times that already passed', () => {
    expect(planOccurrences({alarms: [alarm({enabled: false})], timetable: tt, now: NOW})).toEqual([]);
    const justBefore = at('2026-11-04', '04', '10') - 3000; // < 5 s lead
    expect(planOccurrences({alarms: [alarm()], timetable: tt, now: justBefore})).toEqual([]);
    const earlier = at('2026-11-04', '04', '10') - 10000;
    expect(planOccurrences({alarms: [alarm()], timetable: tt, now: earlier})).toHaveLength(1);
  });

  it('returns nothing without a timetable', () => {
    expect(planOccurrences({alarms: [alarm()], timetable: null, now: NOW})).toEqual([]);
  });
});

describe('planOccurrences – crossing days, months and years', () => {
  it('5 h before Fajr rings on the previous calendar day', () => {
    const [o] = planOccurrences({
      alarms: [alarm({offsetMin: 300})],
      timetable: timetable('2026-11-04'),
      now: NOW,
    });
    expect(o.fireAt).toBe(at('2026-11-03', '23', '40'));
    expect(o.dateKey).toBe('2026-11-04'); // still belongs to the 4th's Fajr
  });

  it('crosses month ends (30 Nov → 1 Dec)', () => {
    const plan = planOccurrences({
      alarms: [alarm({offsetMin: 300})],
      timetable: timetable('2026-12-01'),
      now: at('2026-11-30', '00', '00'),
    });
    expect(plan[0].fireAt).toBe(at('2026-11-30', '23', '40'));
  });

  it('crosses year ends (31 Dec → 1 Jan) for before and after alarms', () => {
    const tt = timetable('2026-12-31', '2027-01-01');
    const plan = planOccurrences({
      alarms: [
        alarm({id: 'b', offsetMin: 300}),
        alarm({id: 'c', kind: 'after', prayer: 'Isha', offsetMin: 300}),
      ],
      timetable: tt,
      now: at('2026-12-30', '00', '00'),
    });
    const byId = Object.fromEntries(plan.map(p => [p.id, p]));
    expect(byId['b|2027-01-01|Fajr'].fireAt).toBe(at('2026-12-31', '23', '40'));
    expect(byId['c|2026-12-31|Isha'].fireAt).toBe(at('2027-01-01', '00', '10'));
  });

  it('handles 29 Feb in leap years', () => {
    const tt = timetable('2028-02-29');
    const [o] = planOccurrences({alarms: [alarm({offsetMin: 300})], timetable: tt, now: at('2028-02-27', '00', '00')});
    expect(o.fireAt).toBe(at('2028-02-28', '23', '40'));
  });

  it('output is sorted by time across alarms', () => {
    const plan = planOccurrences({
      alarms: [alarm({id: 'z', prayer: 'Isha'}), alarm({id: 'a', prayer: 'Fajr'})],
      timetable: timetable('2026-11-04', '2026-11-05'),
      now: NOW,
    });
    const times = plan.map(p => p.fireAt);
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });
});

describe('planOccurrences – weekday filter', () => {
  // 2026-11-06 is a Friday (5), 2026-11-07 Saturday (6)
  const tt = timetable('2026-11-05', '2026-11-06', '2026-11-07');

  it('keeps only the selected days, judged by the prayer’s own day', () => {
    const plan = planOccurrences({alarms: [alarm({days: [5]})], timetable: tt, now: NOW});
    expect(plan.map(p => p.dateKey)).toEqual(['2026-11-06']);
  });

  it('a Friday alarm 5 h before Fajr rings late Thursday night', () => {
    const [o] = planOccurrences({alarms: [alarm({days: [5], offsetMin: 300})], timetable: tt, now: NOW});
    expect(o.fireAt).toBe(at('2026-11-05', '23', '40'));
  });

  it('empty selection means every day', () => {
    expect(planOccurrences({alarms: [alarm({days: []})], timetable: tt, now: NOW})).toHaveLength(3);
  });
});

describe('ids and fingerprints', () => {
  const tt = timetable('2026-11-04', '2026-11-05');

  it('ids are deterministic and independent of offset / sound', () => {
    const a = planOccurrences({alarms: [alarm({offsetMin: 30})], timetable: tt, now: NOW});
    const b = planOccurrences({alarms: [alarm({offsetMin: 45, soundId: 'x'})], timetable: tt, now: NOW});
    expect(a.map(p => p.id)).toEqual(b.map(p => p.id));
    expect(a[0].id).toBe(occurrenceId('a1', '2026-11-04', 'Fajr'));
    expect(a.map(p => p.nid)).toEqual(planOccurrences({alarms: [alarm()], timetable: tt, now: NOW}).map(p => p.nid));
  });

  it('same id but different fingerprint when offset, sound, style or snooze change', () => {
    const base = planOccurrences({alarms: [alarm()], timetable: tt, now: NOW})[0];
    const variants = [
      alarm({offsetMin: 45}),
      alarm({soundId: 'adhan1'}),
      alarm({style: 'notification'}),
      alarm({snoozeMin: 10}),
      alarm({maxSnooze: 1}),
    ];
    for (const v of variants) {
      const o = planOccurrences({alarms: [v], timetable: tt, now: NOW})[0];
      expect(o.id).toBe(base.id);
      expect(o.fingerprint).not.toBe(base.fingerprint);
    }
  });

  it('identical inputs give an identical fingerprint', () => {
    const a = planOccurrences({alarms: [alarm()], timetable: tt, now: NOW})[0];
    const b = planOccurrences({alarms: [alarm()], timetable: tt, now: NOW})[0];
    expect(a.fingerprint).toBe(b.fingerprint);
    expect(fingerprintOf({fireAt: 1, soundId: 's', style: 'alarm', snoozeMin: 5, maxSnooze: 3})).toMatch(/^[0-9a-f]{8}$/);
  });

  it('numeric ids are unique positive 31-bit ints', () => {
    const alarms = Array.from({length: 40}, (_, i) => alarm({id: `alarm-${i}`}));
    const days = Array.from({length: 10}, (_, i) => `2026-11-${String(4 + i).padStart(2, '0')}`);
    const plan = planOccurrences({alarms, timetable: timetable(...days), now: NOW});
    const nids = plan.map(p => p.nid);
    expect(new Set(nids).size).toBe(nids.length);
    expect(nids.every(n => Number.isInteger(n) && n > 0 && n <= 0x7fffffff)).toBe(true);
  });
});

describe('buildLabel', () => {
  it('formats hours and minutes', () => {
    expect(buildLabel({kind: 'before', prayer: 'Asr', offsetMin: 90})).toBe('قبل العصر بـ 01:30');
  });
});

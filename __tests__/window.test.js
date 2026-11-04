/* eslint-env jest */
import {
  ANDROID_ALARM_CAP,
  IOS_BUDGET,
  alarmCap,
  buildDesired,
  buildReminders,
  coverageOf,
} from '../src/core/alarms/window';
import {normalizeAlarm} from '../src/core/alarms/model';
import {addDays} from '../src/core/time/zone';

const TZ = 'Asia/Riyadh';
const HOUR = 3600 * 1000;
const MIN = 60 * 1000;
const PRAYERS = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
const FIRST_DAY = '2026-11-04';
const at = (dateKey, hh) => Date.parse(`${dateKey}T${hh}:00:00+03:00`);
const NOW = at('2026-11-03', '00');

const timetable = nDays => ({
  tz: TZ,
  days: Object.fromEntries(
    Array.from({length: nDays}, (_, i) => {
      const key = addDays(FIRST_DAY, i, TZ);
      return [
        key,
        {Fajr: at(key, '04'), Dhuhr: at(key, '11'), Asr: at(key, '15'), Maghrib: at(key, '17'), Isha: at(key, '19')},
      ];
    }),
  ),
});

const everyPrayer = (over = {}) =>
  PRAYERS.map(prayer =>
    normalizeAlarm({id: `a-${prayer}`, prayer, kind: 'before', offsetMin: 10, ...over}),
  );

const build = (over = {}) =>
  buildDesired({
    alarms: everyPrayer(),
    timetable: timetable(20), // 5 prayers × 20 days = 100 occurrences
    platform: 'ios',
    now: NOW,
    ...over,
  });

const alarmsOf = result => result.desired.filter(d => d.type === 'alarm');
const remindersOf = result => result.desired.filter(d => d.type === 'reminder');

describe('iOS window: 57 alarms + 2 reminders + 5 snooze slots ≤ 64', () => {
  it('caps the alarms at 57 and adds the 2 reminders', () => {
    const result = build();
    expect(result.planned).toBe(100);
    expect(alarmsOf(result)).toHaveLength(57);
    expect(remindersOf(result)).toHaveLength(2);
    expect(result.truncated).toBe(true);
    // leaves room for the 5 snoozes that may be pending at the same time
    expect(result.desired.length + 5).toBeLessThanOrEqual(IOS_BUDGET);
  });

  it('keeps the earliest alarms (the plan is sorted by time)', () => {
    const alarms = alarmsOf(build());
    const times = alarms.map(a => a.fireAt);
    expect([...times].sort((a, b) => a - b)).toEqual(times);
    expect(alarms[0].dateKey).toBe(FIRST_DAY);
  });

  it('does not truncate when everything fits', () => {
    const result = build({timetable: timetable(5)}); // 25 occurrences
    expect(alarmsOf(result)).toHaveLength(25);
    expect(result.truncated).toBe(false);
  });
});

describe('snooze reserve filling up (iOS)', () => {
  it('up to 5 pending snoozes cost nothing', () => {
    expect(alarmCap({platform: 'ios', pendingSnoozes: 0})).toBe(57);
    expect(alarmCap({platform: 'ios', pendingSnoozes: 5})).toBe(57);
  });

  it('every snooze beyond the reserve takes one alarm slot', () => {
    expect(alarmCap({platform: 'ios', pendingSnoozes: 6})).toBe(56);
    expect(alarmCap({platform: 'ios', pendingSnoozes: 7})).toBe(55);
    const result = build({pendingSnoozes: 7});
    expect(alarmsOf(result)).toHaveLength(55);
    expect(result.desired.length + 7).toBeLessThanOrEqual(IOS_BUDGET);
  });

  it('with the whole budget taken by snoozes nothing is scheduled, without throwing', () => {
    expect(alarmCap({platform: 'ios', pendingSnoozes: 64})).toBe(0);
    const result = build({pendingSnoozes: 64});
    expect(result.desired).toEqual([]);
    expect(result.coverageUntil).toBeNull();
    expect(result.blocked).toBe(true);
  });

  it('is not "blocked" when there simply are no alarms', () => {
    const result = build({alarms: []});
    expect(result.blocked).toBe(false);
    expect(result.desired).toEqual([]);
  });
});

describe('Android window', () => {
  it('allows up to 450 alarms and ignores the snooze reserve', () => {
    expect(alarmCap({platform: 'android', pendingSnoozes: 30})).toBe(ANDROID_ALARM_CAP);
    const result = build({platform: 'android', timetable: timetable(100)}); // 500 occurrences
    expect(alarmsOf(result)).toHaveLength(450);
    expect(remindersOf(result)).toHaveLength(2);
  });
});

describe('coverageUntil and the renew reminders', () => {
  it('coverageUntil is the fireAt of the last scheduled alarm', () => {
    const result = build();
    const alarms = alarmsOf(result);
    expect(result.coverageUntil).toBe(alarms[alarms.length - 1].fireAt);
    expect(coverageOf([])).toBeNull();
  });

  it('reminder 1 rings 24 h before coverageUntil, reminder 2 one minute after it', () => {
    const result = build();
    const [r1, r2] = remindersOf(result);
    expect([r1.id, r2.id]).toEqual(['renew-1', 'renew-2']);
    expect(r1.fireAt).toBe(result.coverageUntil - 24 * HOUR);
    expect(r2.fireAt).toBe(result.coverageUntil + MIN);
    expect([r1.nid, r2.nid]).toEqual([1, 2]);
  });

  it('drops a reminder whose time already passed', () => {
    const coverageUntil = NOW + 10 * HOUR; // reminder 1 would be 14 h ago
    const reminders = buildReminders({coverageUntil, now: NOW});
    expect(reminders.map(r => r.id)).toEqual(['renew-2']);
  });

  it('has no reminders when nothing is scheduled', () => {
    expect(buildReminders({coverageUntil: null, now: NOW})).toEqual([]);
  });

  it('moves the reminders when the coverage changes (different fingerprint, same id)', () => {
    const a = remindersOf(build({timetable: timetable(10)}));
    const b = remindersOf(build({timetable: timetable(12)}));
    expect(a.map(r => r.id)).toEqual(b.map(r => r.id));
    expect(a[0].fingerprint).not.toBe(b[0].fingerprint);
  });
});

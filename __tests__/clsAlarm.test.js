/* eslint-env jest */
import {NativeModules, Platform} from 'react-native';
import {storage} from '../src/core/storage/mmkv';
import {scheduleStore} from '../src/core/alarms/scheduleStore';
import {addDays, dateKeyOf} from '../src/core/time/zone';

const TZ = 'Asia/Riyadh';
const HOUR = 3600 * 1000;
const PRAYERS = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

const mockDb = {userTimes: []};

jest.mock('../database/userTimeService', () => ({
  getUserTimes: jest.fn(async () => mockDb.userTimes),
  deleteUserTime: jest.fn(async id => {
    mockDb.userTimes = mockDb.userTimes.filter(u => u.id !== id);
  }),
  deleteAllUserTimes: jest.fn(async () => {
    mockDb.userTimes = [];
  }),
}));

jest.mock('../database/settingsService', () => ({
  getLocation: jest.fn(async () => ({city: 'Jeddah', country: 'SA'})),
}));

let mockTimetable = null;
jest.mock('../src/core/prayer/timetableRepo', () => ({
  getTimetable: jest.fn(async () =>
    mockTimetable ? {timetable: mockTimetable, status: 'api'} : null,
  ),
}));

/** n days starting tomorrow (in the prayer zone), prayers spaced through the day. */
const makeTimetable = n => {
  const tomorrow = addDays(dateKeyOf(Date.now(), TZ), 1, TZ);
  return {
    tz: TZ,
    days: Object.fromEntries(
      Array.from({length: n}, (_, i) => {
        const key = addDays(tomorrow, i, TZ);
        const dayStart = Date.parse(`${key}T00:00:00+03:00`);
        return [
          key,
          Object.fromEntries(PRAYERS.map((p, k) => [p, dayStart + (4 + k * 3) * HOUR])),
        ];
      }),
    ),
  };
};

const {default: clsAlarm} = require('../src/librarys/clsAlaram');
const {getTimetable} = require('../src/core/prayer/timetableRepo');

const native = NativeModules.PrayerAlarmModule;
const androidModule = NativeModules.AlarmModule;

/** A stateful stand-in for UNUserNotificationCenter. */
let pending;
const installFakeIos = (extraPending = []) => {
  pending = new Set(extraPending);
  native.schedule.mockImplementation(async item => {
    pending.add(item.id);
    return true;
  });
  native.cancel.mockImplementation(async ids => {
    ids.forEach(id => pending.delete(id));
    return true;
  });
  native.cancelAll.mockImplementation(async () => {
    [...pending].filter(id => !id.startsWith('snooze-')).forEach(id => pending.delete(id));
    return 0;
  });
  native.cancelLegacy.mockImplementation(async () => 0);
  native.getPendingIds.mockImplementation(async () => [...pending]);
};

const scheduledIds = () => native.schedule.mock.calls.map(([item]) => item.id);
const scheduledAlarms = () =>
  native.schedule.mock.calls.map(([item]) => item).filter(item => !item.plain);

beforeEach(() => {
  storage.clearAll();
  mockDb.userTimes = [];
  mockTimetable = makeTimetable(20);
  jest.clearAllMocks();
  installFakeIos();
});

describe('clsAlarm on iOS', () => {
  beforeEach(() => {
    Platform.OS = 'ios';
  });

  it('registers at most 57 alarms plus the 2 renew reminders (64 minus the snooze reserve)', async () => {
    mockDb.userTimes = [{id: 7, hour: 0, minute: 10, prayers: PRAYERS}]; // 5 × 20 days = 100

    const result = await clsAlarm.rescheduleAll();

    expect(result.ok).toBe(true);
    expect(result.scheduled).toBe(57);
    expect(scheduledAlarms()).toHaveLength(57);
    const reminders = native.schedule.mock.calls.map(([i]) => i).filter(i => i.plain);
    expect(reminders.map(r => r.id)).toEqual(['renew-1', 'renew-2']);
    expect(pending.size + 5).toBeLessThanOrEqual(64);
  });

  it('gives every occurrence its own deterministic id', async () => {
    mockDb.userTimes = [{id: 7, hour: 0, minute: 10, prayers: PRAYERS}];
    await clsAlarm.rescheduleAll();
    const ids = scheduledAlarms().map(a => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every(id => id.startsWith('legacy-7-'))).toBe(true);
  });

  it('keeps the 5-minute unlimited snooze the old alarms had', async () => {
    mockDb.userTimes = [{id: 7, hour: 0, minute: 10, prayers: ['Fajr']}];
    await clsAlarm.rescheduleAll();
    const alarm = scheduledAlarms()[0];
    expect(alarm.snoozeMinutes).toBe(5);
    expect(alarm.maxSnooze).toBe(0);
    expect(alarm.title).toBe('⏰ قبل الفجر بـ 00:10');
  });

  it('removes what earlier versions registered, once', async () => {
    mockDb.userTimes = [{id: 7, hour: 0, minute: 10, prayers: ['Fajr']}];

    await clsAlarm.rescheduleAll();
    expect(native.cancelLegacy).toHaveBeenCalledTimes(1);
    expect(native.cancelAll).toHaveBeenCalledWith(false);

    native.cancelLegacy.mockClear();
    native.cancelAll.mockClear();
    await clsAlarm.rescheduleAll();
    expect(native.cancelLegacy).not.toHaveBeenCalled();
    expect(native.cancelAll).not.toHaveBeenCalled();
  });

  it('does nothing at all when called again and nothing changed', async () => {
    mockDb.userTimes = [{id: 7, hour: 0, minute: 10, prayers: ['Fajr', 'Isha']}];
    await clsAlarm.rescheduleAll();
    native.schedule.mockClear();
    native.cancel.mockClear();

    const result = await clsAlarm.rescheduleAll();

    expect(result.ok).toBe(true);
    expect(native.schedule).not.toHaveBeenCalled();
    expect(native.cancel).not.toHaveBeenCalled();
  });

  it('adding an alarm registers only the new occurrences', async () => {
    mockTimetable = makeTimetable(2);
    mockDb.userTimes = [{id: 1, hour: 0, minute: 10, prayers: ['Isha']}];
    await clsAlarm.rescheduleAll();
    native.schedule.mockClear();
    native.cancel.mockClear();

    // Earlier in the day than the existing alarm, so the coverage (and the reminders) stay put.
    mockDb.userTimes = [...mockDb.userTimes, {id: 2, hour: 0, minute: 10, prayers: ['Fajr']}];
    await clsAlarm.rescheduleAll();

    expect(scheduledIds().every(id => id.startsWith('legacy-2-Fajr|'))).toBe(true);
    expect(scheduledIds()).toHaveLength(2);
    expect(native.cancel).not.toHaveBeenCalled();
  });

  it('registers a changed alarm again under the same ids', async () => {
    mockTimetable = makeTimetable(2);
    mockDb.userTimes = [{id: 1, hour: 0, minute: 10, prayers: ['Fajr']}];
    await clsAlarm.rescheduleAll();
    const before = scheduledAlarms().map(a => a.id).sort();
    native.schedule.mockClear();

    mockDb.userTimes = [{id: 1, hour: 0, minute: 40, prayers: ['Fajr']}]; // offset 10 → 40
    await clsAlarm.rescheduleAll();

    expect(scheduledAlarms().map(a => a.id).sort()).toEqual(before);
    expect(scheduledAlarms()[0].title).toBe('⏰ قبل الفجر بـ 00:40');
  });

  it('counts pending snoozes against the window', async () => {
    installFakeIos(Array.from({length: 10}, (_, i) => `snooze-${i}`));
    mockDb.userTimes = [{id: 7, hour: 0, minute: 10, prayers: PRAYERS}];

    const result = await clsAlarm.rescheduleAll();

    expect(result.scheduled).toBe(52); // 62 − 10 snoozes
    expect(pending.size).toBe(10 + 52 + 2);
  });

  it('saves the coverage for the banner', async () => {
    mockDb.userTimes = [{id: 7, hour: 0, minute: 10, prayers: ['Fajr']}];
    mockTimetable = makeTimetable(3);

    await clsAlarm.rescheduleAll();

    const status = scheduleStore.loadStatus();
    const last = scheduledAlarms().map(a => a.fireAt).sort((a, b) => a - b).pop();
    expect(status).toMatchObject({coverageUntil: last, tz: TZ, scheduled: 3, source: 'api'});
  });

  it('cancels only the occurrences of the deleted alarm and removes its row', async () => {
    mockTimetable = makeTimetable(2);
    mockDb.userTimes = [
      {id: 7, hour: 0, minute: 10, prayers: ['Isha']},
      {id: 8, hour: 0, minute: 10, prayers: ['Fajr']},
    ];
    await clsAlarm.rescheduleAll();

    await clsAlarm.cancelAlarm(7);

    const cancelled = native.cancel.mock.calls.flatMap(([ids]) => ids);
    expect(cancelled.filter(id => id.startsWith('legacy-7-'))).toHaveLength(2);
    expect(cancelled.some(id => id.startsWith('legacy-8-'))).toBe(false);
    expect(mockDb.userTimes.map(u => u.id)).toEqual([8]);
    expect([...pending].some(id => id.startsWith('legacy-7-'))).toBe(false);
  });

  it('keeps the row when cancelling fails (bug: orphaned alarms kept ringing)', async () => {
    mockDb.userTimes = [{id: 7, hour: 0, minute: 10, prayers: ['Fajr']}];
    await clsAlarm.rescheduleAll();
    native.cancel.mockRejectedValueOnce(new Error('boom'));

    await expect(clsAlarm.cancelAlarm(7)).rejects.toThrow('boom');
    expect(mockDb.userTimes).toHaveLength(1);
  });

  it('touches nothing when the prayer times cannot be loaded', async () => {
    mockDb.userTimes = [{id: 7, hour: 0, minute: 10, prayers: ['Fajr']}];
    mockTimetable = null;

    const result = await clsAlarm.rescheduleAll();

    expect(result).toEqual({ok: false});
    expect(native.schedule).not.toHaveBeenCalled();
    expect(native.cancel).not.toHaveBeenCalled();
    expect(native.cancelAll).not.toHaveBeenCalled();
    expect(native.cancelLegacy).not.toHaveBeenCalled(); // migration waits until it can rebuild
  });

  it('uses the calculation method of the selected country', async () => {
    await clsAlarm.rescheduleAll();
    expect(getTimetable.mock.calls[0][0]).toMatchObject({method: 'UmmAlQura'});
  });

  it('cancelAll clears everything, the notification centre, the rows and the banner', async () => {
    mockDb.userTimes = [{id: 7, hour: 0, minute: 10, prayers: ['Fajr']}];
    await clsAlarm.rescheduleAll();

    await clsAlarm.cancelAll();

    expect(native.clearDelivered).toHaveBeenCalledTimes(1);
    expect(mockDb.userTimes).toHaveLength(0);
    expect(pending.size).toBe(0);
    expect(scheduleStore.loadMap()).toEqual({});
    expect(scheduleStore.loadStatus()).toBeNull();
  });

  it('clearLegacyScheduled removes everything, snoozes included', async () => {
    await clsAlarm.clearLegacyScheduled();
    expect(native.cancelLegacy).toHaveBeenCalledTimes(1);
    expect(native.cancelAll).toHaveBeenCalledWith(true);
  });
});

describe('clsAlarm on Android', () => {
  beforeEach(() => {
    Platform.OS = 'android';
  });

  it('passes the exact timestamp and an integer id to the native module', async () => {
    mockTimetable = makeTimetable(1);
    mockDb.userTimes = [{id: 3, hour: 1, minute: 0, prayers: ['Dhuhr']}];

    await clsAlarm.rescheduleAll();

    expect(androidModule.setAlarm).toHaveBeenCalledTimes(1);
    const [nid, timestamp, label] = androidModule.setAlarm.mock.calls[0];
    expect(Number.isInteger(nid)).toBe(true);
    expect(timestamp).toBe(Object.values(mockTimetable.days)[0].Dhuhr - HOUR);
    expect(label).toBe('قبل الظهر بـ 01:00');
  });

  it('schedules the two renew reminders natively, one minute after the last alarm for the second', async () => {
    mockTimetable = makeTimetable(3);
    mockDb.userTimes = [{id: 3, hour: 1, minute: 0, prayers: ['Dhuhr']}];

    await clsAlarm.rescheduleAll();

    const lastAlarm = androidModule.setAlarm.mock.calls.at(-1)[1];
    const reminders = Object.fromEntries(
      androidModule.scheduleReminder.mock.calls.map(([id, at]) => [id, at]),
    );
    expect(reminders[1]).toBe(lastAlarm - 24 * HOUR);
    expect(reminders[2]).toBe(lastAlarm + 60 * 1000);
    expect(native.schedule).not.toHaveBeenCalled();
  });

  it('removes what 1·3b registered once, including the old reminder', async () => {
    mockDb.userTimes = [{id: 3, hour: 1, minute: 0, prayers: ['Dhuhr']}];

    await clsAlarm.rescheduleAll();
    expect(androidModule.cancelAll).toHaveBeenCalledTimes(1);
    expect(androidModule.cancelReminder.mock.calls.map(([id]) => id)).toEqual([1, 2]);

    androidModule.cancelAll.mockClear();
    await clsAlarm.rescheduleAll();
    expect(androidModule.cancelAll).not.toHaveBeenCalled();
  });

  it('does not re-register unchanged alarms', async () => {
    mockDb.userTimes = [{id: 3, hour: 1, minute: 0, prayers: ['Dhuhr']}];
    await clsAlarm.rescheduleAll();
    androidModule.setAlarm.mockClear();
    androidModule.scheduleReminder.mockClear();

    await clsAlarm.rescheduleAll();

    expect(androidModule.setAlarm).not.toHaveBeenCalled();
    expect(androidModule.scheduleReminder).not.toHaveBeenCalled();
  });

  it('cancelAlarm cancels by the integer id it registered', async () => {
    mockTimetable = makeTimetable(2);
    mockDb.userTimes = [{id: 3, hour: 1, minute: 0, prayers: ['Dhuhr']}];
    await clsAlarm.rescheduleAll();
    const registered = androidModule.setAlarm.mock.calls.map(([nid]) => nid);

    await clsAlarm.cancelAlarm(3);

    expect(androidModule.cancelAlarm.mock.calls.map(([nid]) => nid)).toEqual(
      expect.arrayContaining(registered),
    );
    expect(mockDb.userTimes).toHaveLength(0);
  });
});

/* eslint-env jest */
import {NativeModules, Platform} from 'react-native';

const native = NativeModules.PrayerAlarmModule;

const mockDb = {alarms: [], nextId: 1, userTimes: []};

jest.mock('../database/alarmService', () => ({
  addAlarm: jest.fn(async (userTimeId, prayer, timestamp) => {
    const id = mockDb.nextId++;
    mockDb.alarms.push({id, user_time_id: userTimeId, prayer, timestamp});
    return id;
  }),
  deleteAllAlarms: jest.fn(async () => {
    mockDb.alarms = [];
  }),
  getAlarmsByUserTimeId: jest.fn(async id =>
    mockDb.alarms.filter(a => a.user_time_id === id),
  ),
}));

jest.mock('../database/userTimeService', () => ({
  getUserTimes: jest.fn(async () => mockDb.userTimes),
  deleteUserTime: jest.fn(async id => {
    mockDb.userTimes = mockDb.userTimes.filter(u => u.id !== id);
    mockDb.alarms = mockDb.alarms.filter(a => a.user_time_id !== id);
  }),
  deleteAllUserTimes: jest.fn(async () => {
    mockDb.userTimes = [];
    mockDb.alarms = [];
  }),
}));

jest.mock('../database/settingsService', () => ({
  getLocation: jest.fn(async () => ({city: 'Jeddah', country: 'SA'})),
}));

const HOUR = 3600 * 1000;
const PRAYERS = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

/** n days starting tomorrow, prayers spaced through the day. */
const makeDays = n => {
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  return Array.from({length: n}, (_, i) => {
    const dayStart = base.getTime() + (i + 1) * 24 * HOUR;
    const timestamps = {};
    PRAYERS.forEach((p, k) => {
      timestamps[p] = dayStart + (5 + k * 3) * HOUR;
    });
    return {date: `day-${i}`, timings: {}, timestamps};
  });
};

let mockDays = makeDays(20);
jest.mock('../src/librarys/prayerData', () => ({
  loadPrayerTimes: jest.fn(async () => (mockDays ? {days: mockDays, fromCache: false} : null)),
}));

const {default: clsAlarm, buildAlarmPlan} = require('../src/librarys/clsAlaram');

beforeEach(() => {
  mockDb.alarms = [];
  mockDb.nextId = 1;
  mockDb.userTimes = [];
  mockDays = makeDays(20);
  jest.clearAllMocks();
});

describe('buildAlarmPlan', () => {
  it('creates one entry per prayer per day, sorted, skipping the past', () => {
    Platform.OS = 'android';
    const days = makeDays(2);
    const past = {...days[0], timestamps: {Fajr: Date.now() - HOUR}};
    const plan = buildAlarmPlan(
      [{id: 1, hour: 0, minute: 10, prayers: PRAYERS}],
      [past, ...days],
    );
    expect(plan).toHaveLength(10);
    const ts = plan.map(p => p.timestamp);
    expect([...ts].sort((a, b) => a - b)).toEqual(ts);
    expect(new Set(ts).size).toBe(10);
    expect(plan[0].label).toBe('قبل الفجر بـ 00:10');
  });

  it('caps iOS at 60 pending notifications (iOS limit is 64)', () => {
    Platform.OS = 'ios';
    const plan = buildAlarmPlan(
      [
        {id: 1, hour: 0, minute: 5, prayers: PRAYERS},
        {id: 2, hour: 0, minute: 30, prayers: PRAYERS},
      ],
      makeDays(20),
    );
    expect(plan).toHaveLength(60);
  });
});

describe('clsAlarm on iOS', () => {
  beforeEach(() => {
    Platform.OS = 'ios';
  });

  const scheduled = () => native.schedule.mock.calls.map(([item]) => item);

  it('gives every prayer its own notification id (bug: same-day prayers overwrote each other)', async () => {
    mockDb.userTimes = [{id: 7, hour: 0, minute: 10, prayers: PRAYERS}];
    mockDays = makeDays(1);

    const result = await clsAlarm.rescheduleAll();

    expect(result).toEqual({ok: true, scheduled: 5, fromCache: false});
    const ids = scheduled()
      .map(n => n.id)
      .filter(id => id.startsWith('alarm-'));
    expect(ids).toHaveLength(5);
    expect(new Set(ids).size).toBe(5);
  });

  it('schedules alarms natively with the 5-minute unlimited snooze the old build had', async () => {
    mockDb.userTimes = [{id: 7, hour: 0, minute: 10, prayers: ['Fajr']}];
    mockDays = makeDays(1);

    await clsAlarm.rescheduleAll();

    const alarm = scheduled().find(n => n.id.startsWith('alarm-'));
    expect(alarm.fireAt).toBe(mockDays[0].timestamps.Fajr - 10 * 60 * 1000);
    expect(alarm.title).toBe('⏰ قبل الفجر بـ 00:10');
    expect(alarm.snoozeMinutes).toBe(5);
    expect(alarm.maxSnooze).toBe(0);
  });

  it('drops alarms left by the Notifee versions before scheduling, keeping user snoozes', async () => {
    mockDb.userTimes = [{id: 7, hour: 0, minute: 10, prayers: ['Fajr']}];

    await clsAlarm.rescheduleAll();

    expect(native.cancelLegacy).toHaveBeenCalledTimes(1);
    expect(native.cancelAll).toHaveBeenCalledWith(false);
    expect(native.cancelLegacy.mock.invocationCallOrder[0]).toBeLessThan(
      native.schedule.mock.invocationCallOrder[0],
    );
  });

  it('schedules the renew reminder as a plain notification one minute after the last alarm', async () => {
    mockDb.userTimes = [{id: 7, hour: 0, minute: 10, prayers: ['Fajr']}];
    mockDays = makeDays(2);

    await clsAlarm.rescheduleAll();

    const items = scheduled();
    const lastAlarm = Math.max(
      ...items.filter(n => n.id.startsWith('alarm-')).map(n => n.fireAt),
    );
    const reminder = items.find(n => n.id === 'renew-reminder');
    expect(reminder.plain).toBe(true);
    expect(reminder.fireAt).toBe(lastAlarm + 60 * 1000);
  });

  it('cancels with the same id it scheduled with, then deletes from DB', async () => {
    mockDb.userTimes = [{id: 7, hour: 0, minute: 10, prayers: ['Fajr']}];
    mockDays = makeDays(2);
    await clsAlarm.rescheduleAll();
    const scheduledIds = mockDb.alarms.map(a => `alarm-${a.id}`);

    await clsAlarm.cancelAlarm(7);

    const cancelled = native.cancel.mock.calls.flatMap(([ids]) => ids);
    expect(cancelled).toEqual(expect.arrayContaining(scheduledIds));
    expect(mockDb.userTimes).toHaveLength(0);
  });

  it('keeps the DB row when cancelling fails (bug: orphaned alarms kept ringing)', async () => {
    mockDb.userTimes = [{id: 7, hour: 0, minute: 10, prayers: ['Fajr']}];
    await clsAlarm.rescheduleAll();
    native.cancel.mockRejectedValueOnce(new Error('boom'));

    await expect(clsAlarm.cancelAlarm(7)).rejects.toThrow('boom');
    expect(mockDb.userTimes).toHaveLength(1);
  });

  it('keeps existing alarms when prayer times cannot be loaded', async () => {
    mockDb.userTimes = [{id: 7, hour: 0, minute: 10, prayers: ['Fajr']}];
    mockDays = null;

    const result = await clsAlarm.rescheduleAll();

    expect(result.ok).toBe(false);
    expect(native.cancelAll).not.toHaveBeenCalled();
    expect(native.cancelLegacy).not.toHaveBeenCalled();
  });

  it('cancelAll also clears the delivered notifications', async () => {
    mockDb.userTimes = [{id: 7, hour: 0, minute: 10, prayers: ['Fajr']}];

    await clsAlarm.cancelAll();

    expect(native.cancelAll).toHaveBeenCalledWith(false);
    expect(native.clearDelivered).toHaveBeenCalledTimes(1);
    expect(mockDb.userTimes).toHaveLength(0);
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

  it('passes the exact timestamp (not a date string) to the native module', async () => {
    mockDb.userTimes = [{id: 3, hour: 1, minute: 0, prayers: ['Dhuhr']}];
    mockDays = makeDays(1);

    await clsAlarm.rescheduleAll();

    expect(NativeModules.AlarmModule.cancelAll).toHaveBeenCalled();
    expect(NativeModules.AlarmModule.setAlarm).toHaveBeenCalledTimes(1);
    const [id, timestamp, label] = NativeModules.AlarmModule.setAlarm.mock.calls[0];
    expect(id).toBe(1);
    expect(timestamp).toBe(mockDays[0].timestamps.Dhuhr - HOUR);
    expect(label).toBe('قبل الظهر بـ 01:00');
  });

  it('schedules the renew reminder natively one minute after the last alarm, without Notifee', async () => {
    mockDb.userTimes = [{id: 3, hour: 1, minute: 0, prayers: ['Dhuhr']}];
    mockDays = makeDays(2);

    await clsAlarm.rescheduleAll();

    const lastAlarm = NativeModules.AlarmModule.setAlarm.mock.calls.at(-1)[1];
    expect(NativeModules.AlarmModule.scheduleReminder).toHaveBeenCalledTimes(1);
    const [id, timestamp, title] = NativeModules.AlarmModule.scheduleReminder.mock.calls[0];
    expect(id).toBe(1);
    expect(timestamp).toBe(lastAlarm + 60 * 1000);
    expect(title).toBe('افتح التطبيق لتجديد المنبهات');
    expect(native.schedule).not.toHaveBeenCalled();
  });

  it('cancels the old renew reminder before rescheduling', async () => {
    mockDb.userTimes = [{id: 3, hour: 1, minute: 0, prayers: ['Dhuhr']}];
    await clsAlarm.rescheduleAll();
    expect(NativeModules.AlarmModule.cancelReminder).toHaveBeenCalledWith(1);
    expect(native.cancelAll).not.toHaveBeenCalled();
  });

  it('skips an automatic reschedule when nothing changed', async () => {
    mockDb.userTimes = [{id: 3, hour: 1, minute: 0, prayers: ['Dhuhr']}];
    await clsAlarm.rescheduleAll();
    const result = await clsAlarm.rescheduleAll({force: false});
    expect(result.skipped).toBe(true);
  });
});

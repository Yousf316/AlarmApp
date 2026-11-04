/* eslint-env jest */
import {NativeModules, Platform} from 'react-native';
import notifee from '@notifee/react-native';

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

  it('gives every prayer its own notification id (bug: same-day prayers overwrote each other)', async () => {
    mockDb.userTimes = [{id: 7, hour: 0, minute: 10, prayers: PRAYERS}];
    mockDays = makeDays(1);

    const result = await clsAlarm.rescheduleAll();

    expect(result).toEqual({ok: true, scheduled: 5, fromCache: false});
    const ids = notifee.createTriggerNotification.mock.calls
      .map(([n]) => n.id)
      .filter(id => id.startsWith('alarm-'));
    expect(ids).toHaveLength(5);
    expect(new Set(ids).size).toBe(5);
  });

  it('cancels with the same id it scheduled with, then deletes from DB', async () => {
    mockDb.userTimes = [{id: 7, hour: 0, minute: 10, prayers: ['Fajr']}];
    mockDays = makeDays(2);
    await clsAlarm.rescheduleAll();
    const scheduledIds = mockDb.alarms.map(a => `alarm-${a.id}`);

    await clsAlarm.cancelAlarm(7);

    const cancelled = notifee.cancelTriggerNotification.mock.calls.map(([id]) => id);
    expect(cancelled).toEqual(expect.arrayContaining(scheduledIds));
    expect(mockDb.userTimes).toHaveLength(0);
  });

  it('keeps the DB row when cancelling fails (bug: orphaned alarms kept ringing)', async () => {
    mockDb.userTimes = [{id: 7, hour: 0, minute: 10, prayers: ['Fajr']}];
    await clsAlarm.rescheduleAll();
    notifee.cancelTriggerNotification.mockRejectedValueOnce(new Error('boom'));

    await expect(clsAlarm.cancelAlarm(7)).rejects.toThrow('boom');
    expect(mockDb.userTimes).toHaveLength(1);
  });

  it('keeps existing alarms when prayer times cannot be loaded', async () => {
    mockDb.userTimes = [{id: 7, hour: 0, minute: 10, prayers: ['Fajr']}];
    mockDays = null;

    const result = await clsAlarm.rescheduleAll();

    expect(result.ok).toBe(false);
    expect(notifee.cancelTriggerNotifications).not.toHaveBeenCalled();
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

  it('skips an automatic reschedule when nothing changed', async () => {
    mockDb.userTimes = [{id: 3, hour: 1, minute: 0, prayers: ['Dhuhr']}];
    await clsAlarm.rescheduleAll();
    const result = await clsAlarm.rescheduleAll({force: false});
    expect(result.skipped).toBe(true);
  });
});

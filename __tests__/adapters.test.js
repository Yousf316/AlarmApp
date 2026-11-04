/* eslint-env jest */
import {createAdapter} from '../src/core/alarms/adapters';

const alarm = {
  type: 'alarm',
  id: 'a1|2026-11-04|Fajr',
  nid: 123,
  fireAt: 1000,
  label: 'قبل الفجر بـ 00:10',
  soundId: 'default',
  snoozeMin: 5,
  maxSnooze: 0,
};
const reminder = {type: 'reminder', id: 'renew-1', nid: 1, fireAt: 2000, title: 'T', body: 'B'};

const makeNative = () => ({
  schedule: jest.fn(async () => true),
  cancel: jest.fn(async () => true),
  cancelAll: jest.fn(async () => 0),
  cancelLegacy: jest.fn(async () => 0),
  getPendingIds: jest.fn(async () => ['x', 'snooze-1', 'snooze-2']),
});

const makeModule = () => ({
  setAlarm: jest.fn(async () => true),
  cancelAlarm: jest.fn(async () => true),
  cancelAll: jest.fn(async () => true),
  scheduleReminder: jest.fn(async () => true),
  cancelReminder: jest.fn(async () => true),
});

describe('iOS adapter', () => {
  it('schedules an alarm with its snooze settings, keyed by the occurrence id', async () => {
    const native = makeNative();
    await createAdapter({platform: 'ios', native}).schedule(alarm);
    expect(native.schedule).toHaveBeenCalledWith({
      id: alarm.id,
      fireAt: 1000,
      title: '⏰ قبل الفجر بـ 00:10',
      body: 'المنبه يرن',
      sound: 'radar.caf',
      snoozeMinutes: 5,
      maxSnooze: 0,
    });
  });

  it('schedules a reminder as a plain notification', async () => {
    const native = makeNative();
    await createAdapter({platform: 'ios', native}).schedule(reminder);
    expect(native.schedule).toHaveBeenCalledWith({
      id: 'renew-1',
      fireAt: 2000,
      title: 'T',
      body: 'B',
      plain: true,
    });
  });

  it('cancels by id, and cancelAll keeps snoozes while dropping legacy alarms', async () => {
    const native = makeNative();
    const adapter = createAdapter({platform: 'ios', native});
    await adapter.cancel({id: alarm.id});
    expect(native.cancel).toHaveBeenCalledWith([alarm.id]);
    await adapter.cancelAll();
    expect(native.cancelLegacy).toHaveBeenCalledTimes(1);
    expect(native.cancelAll).toHaveBeenCalledWith(false);
  });

  it('lists pending ids and counts the pending snoozes', async () => {
    const native = makeNative();
    const adapter = createAdapter({platform: 'ios', native});
    expect(await adapter.listPending()).toEqual(['x', 'snooze-1', 'snooze-2']);
    expect(await adapter.pendingSnoozes()).toBe(2);
  });
});

describe('Android adapter', () => {
  it('uses the integer id for alarms and reminders', async () => {
    const alarmModule = makeModule();
    const adapter = createAdapter({platform: 'android', alarmModule});
    await adapter.schedule(alarm);
    expect(alarmModule.setAlarm).toHaveBeenCalledWith(123, 1000, 'قبل الفجر بـ 00:10');
    await adapter.schedule(reminder);
    expect(alarmModule.scheduleReminder).toHaveBeenCalledWith(1, 2000, 'T', 'B');
  });

  it('cancels each kind through its own call', async () => {
    const alarmModule = makeModule();
    const adapter = createAdapter({platform: 'android', alarmModule});
    await adapter.cancel({id: alarm.id, nid: 123, type: 'alarm'});
    await adapter.cancel({id: 'renew-2', nid: 2, type: 'reminder'});
    expect(alarmModule.cancelAlarm).toHaveBeenCalledWith(123);
    expect(alarmModule.cancelReminder).toHaveBeenCalledWith(2);
  });

  it('cancelAll clears alarms and both reminders; there is no pending query', async () => {
    const alarmModule = makeModule();
    const adapter = createAdapter({platform: 'android', alarmModule});
    await adapter.cancelAll();
    expect(alarmModule.cancelAll).toHaveBeenCalledTimes(1);
    expect(alarmModule.cancelReminder.mock.calls.map(([id]) => id)).toEqual([1, 2]);
    expect(adapter.listPending).toBeNull();
    expect(await adapter.pendingSnoozes()).toBe(0);
  });
});

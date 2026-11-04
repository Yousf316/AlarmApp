/* eslint-env jest */
import {NativeModules} from 'react-native';
import notifee from '../src/librarys/notifeeGuard';
import rawNotifee from '@notifee/react-native';
import {
  cancel,
  isAvailable,
  scheduleTestAlarm,
} from '../src/core/alarms/prayerAlarmNative';

const native = NativeModules.PrayerAlarmModule;

beforeEach(() => jest.clearAllMocks());

describe('prayerAlarmNative', () => {
  it('is available on iOS', () => {
    expect(isAvailable()).toBe(true);
  });

  it('schedules a test alarm ~N seconds ahead with a snooze configuration', async () => {
    const before = Date.now();
    await scheduleTestAlarm(10);
    const item = native.schedule.mock.calls[0][0];
    expect(item.fireAt).toBeGreaterThanOrEqual(before + 10000);
    expect(item.fireAt).toBeLessThan(before + 11000);
    expect(item.snoozeMinutes).toBe(1);
    expect(item.maxSnooze).toBe(2);
    expect(item.id).toMatch(/^pa-test-/);
  });

  it('does not call native cancel with an empty list', async () => {
    expect(await cancel([])).toBe(false);
    expect(native.cancel).not.toHaveBeenCalled();
  });
});

describe('notifeeGuard (temporary delegate re-assert)', () => {
  it('forwards calls to notifee and re-asserts the delegate afterwards', async () => {
    rawNotifee.cancelTriggerNotification.mockResolvedValueOnce('done');
    await expect(notifee.cancelTriggerNotification('x')).resolves.toBe('done');
    expect(rawNotifee.cancelTriggerNotification).toHaveBeenCalledWith('x');
    expect(native.reassertDelegate).toHaveBeenCalledTimes(1);
  });

  it('re-asserts and rethrows when the notifee call fails', async () => {
    rawNotifee.cancelTriggerNotification.mockRejectedValueOnce(new Error('nope'));
    await expect(notifee.cancelTriggerNotification('x')).rejects.toThrow('nope');
    expect(native.reassertDelegate).toHaveBeenCalledTimes(1);
  });

  it('re-asserts after synchronous notifee calls (event subscriptions)', () => {
    const unsubscribe = jest.fn();
    rawNotifee.onForegroundEvent.mockReturnValueOnce(unsubscribe);
    expect(notifee.onForegroundEvent(() => {})).toBe(unsubscribe);
    expect(native.reassertDelegate).toHaveBeenCalledTimes(1);
  });

  it('never breaks the notifee call if re-assert rejects', async () => {
    native.reassertDelegate.mockRejectedValueOnce(new Error('native down'));
    rawNotifee.cancelTriggerNotification.mockResolvedValueOnce('ok');
    await expect(notifee.cancelTriggerNotification('y')).resolves.toBe('ok');
  });
});

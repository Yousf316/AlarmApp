/* eslint-env jest */
import {NativeModules} from 'react-native';
import {
  cancel,
  cancelLegacy,
  clearDelivered,
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

describe('legacy cleanup helpers', () => {
  it('cancelLegacy and clearDelivered go to the native module', async () => {
    native.cancelLegacy.mockResolvedValueOnce(3);
    await expect(cancelLegacy()).resolves.toBe(3);
    await expect(clearDelivered()).resolves.toBe(true);
    expect(native.clearDelivered).toHaveBeenCalledTimes(1);
  });
});

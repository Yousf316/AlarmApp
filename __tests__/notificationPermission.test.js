/* eslint-env jest */
import {PermissionsAndroid, Platform} from 'react-native';
import {requestNotificationPermission} from '../src/librarys/NotificationManager';

// Platform.Version is a read-only getter in the Jest environment.
const setAndroidVersion = version =>
  Object.defineProperty(Platform, 'Version', {configurable: true, get: () => version});

describe('requestNotificationPermission on Android', () => {
  let request;

  beforeEach(() => {
    Platform.OS = 'android';
    request = jest.spyOn(PermissionsAndroid, 'request');
  });

  afterEach(() => request.mockRestore());

  it('asks for POST_NOTIFICATIONS on Android 13+ and reports the answer', async () => {
    setAndroidVersion(34);
    request.mockResolvedValueOnce(PermissionsAndroid.RESULTS.GRANTED);
    await expect(requestNotificationPermission()).resolves.toBe(true);
    expect(request).toHaveBeenCalledWith('android.permission.POST_NOTIFICATIONS');

    request.mockResolvedValueOnce(PermissionsAndroid.RESULTS.DENIED);
    await expect(requestNotificationPermission()).resolves.toBe(false);
  });

  it('does not prompt before Android 13', async () => {
    setAndroidVersion(31);
    await expect(requestNotificationPermission()).resolves.toBe(true);
    expect(request).not.toHaveBeenCalled();
  });
});

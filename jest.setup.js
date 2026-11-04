/* eslint-env jest */
import {NativeModules} from 'react-native';

jest.mock('@notifee/react-native', () => require('@notifee/react-native/jest-mock'));

jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default,
);

// In-memory MMKV: the real one needs the native NitroModules runtime.
jest.mock('react-native-mmkv', () => ({
  MMKV: jest.fn(() => {
    const map = new Map();
    return {
      set: (key, value) => map.set(key, value),
      getString: key => (typeof map.get(key) === 'string' ? map.get(key) : undefined),
      getNumber: key => (typeof map.get(key) === 'number' ? map.get(key) : undefined),
      getBoolean: key => (typeof map.get(key) === 'boolean' ? map.get(key) : undefined),
      contains: key => map.has(key),
      delete: key => map.delete(key),
      getAllKeys: () => Array.from(map.keys()),
      clearAll: () => map.clear(),
    };
  }),
}));

jest.mock('react-native-sqlite-storage', () => ({
  openDatabase: jest.fn(() => ({transaction: jest.fn()})),
  deleteDatabase: jest.fn(),
}));

NativeModules.AlarmModule = {
  setAlarm: jest.fn(() => Promise.resolve(true)),
  cancelAlarm: jest.fn(() => Promise.resolve(true)),
  cancelAll: jest.fn(() => Promise.resolve(true)),
  canScheduleExactAlarms: jest.fn(() => Promise.resolve(true)),
  scheduleReminder: jest.fn(() => Promise.resolve(true)),
  cancelReminder: jest.fn(() => Promise.resolve(true)),
};

NativeModules.PrayerAlarmModule = {
  getPermissionStatus: jest.fn(() =>
    Promise.resolve({status: 'authorized', alert: true, sound: true, timeSensitive: true}),
  ),
  requestPermission: jest.fn(() =>
    Promise.resolve({status: 'authorized', alert: true, sound: true, timeSensitive: true}),
  ),
  schedule: jest.fn(() => Promise.resolve(true)),
  cancel: jest.fn(() => Promise.resolve(true)),
  cancelAll: jest.fn(() => Promise.resolve(0)),
  cancelLegacy: jest.fn(() => Promise.resolve(0)),
  clearDelivered: jest.fn(() => Promise.resolve(true)),
  getPendingIds: jest.fn(() => Promise.resolve([])),
  reassertDelegate: jest.fn(() => Promise.resolve(false)),
};

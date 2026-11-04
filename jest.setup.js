/* eslint-env jest */
import {NativeModules} from 'react-native';

jest.mock('@notifee/react-native', () => require('@notifee/react-native/jest-mock'));

jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default,
);

jest.mock('react-native-sqlite-storage', () => ({
  openDatabase: jest.fn(() => ({transaction: jest.fn()})),
  deleteDatabase: jest.fn(),
}));

NativeModules.AlarmModule = {
  setAlarm: jest.fn(() => Promise.resolve(true)),
  cancelAlarm: jest.fn(() => Promise.resolve(true)),
  cancelAll: jest.fn(() => Promise.resolve(true)),
  canScheduleExactAlarms: jest.fn(() => Promise.resolve(true)),
};

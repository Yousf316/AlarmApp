import {NativeModules, Platform} from 'react-native';

/**
 * JS face of the native iOS `PrayerAlarmModule` (UNUserNotificationCenter).
 * Android uses `AlarmModule` instead; every call here is a safe no-op there.
 */
const native = Platform.OS === 'ios' ? NativeModules.PrayerAlarmModule : null;

export const isAvailable = () => !!native;

/** @returns {Promise<{status:string, alert:boolean, sound:boolean, timeSensitive:boolean}|null>} */
export const getPermissionStatus = async () =>
  native ? native.getPermissionStatus() : null;

export const requestPermission = async () =>
  native ? native.requestPermission() : null;

/**
 * @param {{id:string, fireAt:number, title:string, body?:string, sound?:string,
 *          snoozeMinutes?:number, maxSnooze?:number, snoozeCount?:number,
 *          plain?:boolean}} item
 *   maxSnooze 0 = unlimited, snoozeMinutes 0 = no snooze button,
 *   plain = a reminder: no buttons, not time sensitive.
 */
export const schedule = async item => (native ? native.schedule(item) : false);

export const cancel = async ids =>
  native && ids.length ? native.cancel(ids) : false;

export const cancelAll = async (includeSnoozes = false) =>
  native ? native.cancelAll(includeSnoozes) : 0;

/**
 * Cancels pending notifications that are not ours: alarms left behind by the
 * Notifee-based versions of the app. Resolves with how many were removed.
 */
export const cancelLegacy = async () => (native ? native.cancelLegacy() : 0);

/** Clears every notification of the app from the notification centre. */
export const clearDelivered = async () =>
  native ? native.clearDelivered() : false;

export const getPendingIds = async () => (native ? native.getPendingIds() : []);

/** Fires a real alarm notification `seconds` from now (1-minute snooze, max 2). */
export const scheduleTestAlarm = (seconds = 10) =>
  schedule({
    id: `pa-test-${Date.now()}`,
    fireAt: Date.now() + seconds * 1000,
    title: '⏰ منبه تجريبي',
    body: 'اختبار الغفوة والإيقاف',
    sound: 'radar.caf',
    snoozeMinutes: 1,
    maxSnooze: 2,
  });

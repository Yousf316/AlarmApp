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
 *          snoozeMinutes?:number, maxSnooze?:number, snoozeCount?:number}} item
 *   maxSnooze 0 = unlimited, snoozeMinutes 0 = no snooze button.
 */
export const schedule = async item => (native ? native.schedule(item) : false);

export const cancel = async ids =>
  native && ids.length ? native.cancel(ids) : false;

export const cancelAll = async (includeSnoozes = false) =>
  native ? native.cancelAll(includeSnoozes) : 0;

export const getPendingIds = async () => (native ? native.getPendingIds() : []);

/**
 * TEMPORARY (until Notifee is removed): Notifee may take over the notification
 * delegate; this gives it back to us. Resolves true if it had to be re-asserted.
 */
export const reassertDelegate = async () =>
  native ? native.reassertDelegate() : false;

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

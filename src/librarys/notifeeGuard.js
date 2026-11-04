import rawNotifee from '@notifee/react-native';
import {reassertDelegate} from '../core/alarms/prayerAlarmNative';

/**
 * TEMPORARY (removed together with Notifee).
 *
 * Notifee installs itself as the UNUserNotificationCenter delegate on first
 * use. The native `PrayerAlarmCenter` must own it (so Snooze/Stop work while
 * the app is killed), so after every Notifee call we ask native to re-assert.
 * Non-PrayerAlarm notifications are forwarded to Notifee natively.
 */
const reassert = () => {
  reassertDelegate().catch(() => {});
};

const notifee = new Proxy(rawNotifee, {
  get(target, prop) {
    const value = target[prop];
    if (typeof value !== 'function') {
      return value;
    }
    return (...args) => {
      const result = value.apply(target, args);
      if (result && typeof result.then === 'function') {
        return result.then(
          v => {
            reassert();
            return v;
          },
          e => {
            reassert();
            throw e;
          },
        );
      }
      reassert();
      return result;
    };
  },
});

export default notifee;

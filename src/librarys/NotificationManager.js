import {PermissionsAndroid, Platform} from 'react-native';
import {requestPermission} from '../core/alarms/prayerAlarmNative';

// Must be a .caf/.aiff/.wav file (≤ 30 s) added to the Xcode target's
// "Copy Bundle Resources". iOS does NOT play .mp3 notification sounds and
// falls back to the default sound if the file is missing.
export const ALARM_SOUND_IOS = 'radar.caf';

// Snooze length of the alarms created from the (pre-v2) "add alarm" screen.
// 0 maxSnooze = unlimited snoozes.
export const LEGACY_SNOOZE_MINUTES = 5;

const IOS_GRANTED = ['authorized', 'provisional', 'ephemeral'];

/** Notification permission prompt: iOS system dialog, Android 13+ POST_NOTIFICATIONS. */
export async function requestNotificationPermission() {
  if (Platform.OS === 'android') {
    if (Platform.Version < 33) {
      return true; // no runtime permission before Android 13
    }
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    );
    return result === PermissionsAndroid.RESULTS.GRANTED;
  }
  if (Platform.OS !== 'ios') {
    return true;
  }
  const settings = await requestPermission();
  return IOS_GRANTED.includes(settings?.status);
}

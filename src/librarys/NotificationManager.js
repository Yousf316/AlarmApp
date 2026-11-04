import {AuthorizationStatus, EventType, TriggerType} from '@notifee/react-native';
import notifee from './notifeeGuard';
import {Platform} from 'react-native';

export const ALARM_CATEGORY_ID = 'alarm-category';
export const RENEW_CHANNEL_ID = 'renew';
export const SNOOZE_ID_PREFIX = 'snooze-';
// Must be a .caf/.aiff/.wav file (≤ 30 s) added to the Xcode target's
// "Copy Bundle Resources". iOS does NOT play .mp3 notification sounds and
// falls back to the default sound if the file is missing.
export const ALARM_SOUND_IOS = 'radar.caf';

const SNOOZE_MINUTES = 5;
const STOP_ACTION = 'STOP_ALARM';
const SNOOZE_ACTION = 'SNOOZE_ALARM';

/** iOS permission prompt (Android 13+ is requested in MainActivity). */
export async function requestNotificationPermission() {
  if (Platform.OS !== 'ios') {
    return true;
  }
  const settings = await notifee.requestPermission({
    alert: true,
    sound: true,
    badge: false,
  });
  return settings.authorizationStatus >= AuthorizationStatus.AUTHORIZED;
}

export async function setupNotificationCategories() {
  if (Platform.OS !== 'ios') {
    return;
  }
  await notifee.setNotificationCategories([
    {
      id: ALARM_CATEGORY_ID,
      actions: [
        {id: STOP_ACTION, title: '🛑 إيقاف', destructive: true},
        {id: SNOOZE_ACTION, title: `😴 غفوة ${SNOOZE_MINUTES} دقائق`},
      ],
    },
  ]);
}

const snooze = async notification => {
  await notifee.createTriggerNotification(
    {
      id: `${SNOOZE_ID_PREFIX}${Date.now()}`,
      title: notification?.title ?? '⏰ المنبه',
      body: notification?.body ?? 'المنبه يرن',
      ios: notification?.ios,
    },
    {
      type: TriggerType.TIMESTAMP,
      timestamp: Date.now() + SNOOZE_MINUTES * 60 * 1000,
    },
  );
};

/**
 * Handles iOS notification action buttons. Register it with both
 * notifee.onBackgroundEvent (index.js) and notifee.onForegroundEvent (App.tsx).
 */
export async function handleNotificationEvent({type, detail}) {
  if (type !== EventType.ACTION_PRESS) {
    return;
  }
  const {notification, pressAction} = detail;
  if (pressAction?.id === SNOOZE_ACTION) {
    await snooze(notification);
  }
  if (
    (pressAction?.id === SNOOZE_ACTION || pressAction?.id === STOP_ACTION) &&
    notification?.id
  ) {
    await notifee.cancelDisplayedNotification(notification.id);
  }
}

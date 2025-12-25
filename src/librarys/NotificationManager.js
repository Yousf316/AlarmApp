import notifee, { AuthorizationStatus, TriggerType } from '@notifee/react-native';
import { Platform } from 'react-native';


export async function clearAllNotifee() {
  try {
    // 🔹 Cancel all scheduled trigger notifications
    await notifee.cancelAllNotifications();

    // 🔹 Clear all displayed notifications (if any still visible)
    await notifee.cancelDisplayedNotifications();

    console.log('🧹 All Notifee notifications cleared.');
  } catch (err) {
    console.error('❌ Failed to clear Notifee notifications:', err);
  }
}
// 🔹 طلب الإذن بالتنبيهات
export async function requestNotificationPermission() {
  if (Platform.OS !== 'ios') return;

  const settings = await notifee.requestPermission();

  if (settings.authorizationStatus >= AuthorizationStatus.AUTHORIZED) {
    console.log('✅ Notification permission granted');
    return true;
  } else {
    console.log('❌ Notification permission denied');
    return false;
  }
}

// 🔹 عرض إشعار فوري
export async function displayNotification(title, body) {
  if (Platform.OS !== 'ios') return;
  await notifee.displayNotification({
    title,
    body,
    ios: {
      sound: 'default',
      categoryId: 'alarm-category',
      foregroundPresentationOptions: {
        badge: true,
        sound: true,
        banner: true,
        list: true,
      },
    },
  });
}

// 🔹 جدولة إشعار
export async function scheduleNotification(title, body, seconds = 10) {
  if (Platform.OS !== 'ios') return;

  const trigger = {
    type: TriggerType.TIMESTAMP,
    timestamp: Date.now() + seconds * 1000,
  };

  await notifee.createTriggerNotification(
    {
      title,
      body,
      ios: { sound: 'default'    ,   categoryId: 'alarm-category',
 },
    },
    trigger
  );

  console.log(`📅 Notification scheduled in ${seconds} seconds`);
}
export async function setupNotificationCategories() {
  await notifee.setNotificationCategories([
    {
      id: 'alarm-category',
      actions: [
        {
          id: 'STOP_ALARM',
          title: '🛑 Stop',
          destructive: true,
        },
        {
          id: 'SNOOZE_ALARM',
          title: '😴 Snooze 5 min',
        },
      ],
    },
  ]);
}
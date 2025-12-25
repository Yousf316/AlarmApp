import { Platform, NativeModules } from 'react-native';
import notifee, { TriggerType } from '@notifee/react-native';
import { addAlarm, deleteAlarmByUserTime, getAlarmsByUserTimeId } from '../../database/alarmService';
import { deleteUserTime } from '../../database/userTimeService';
import TimeCalculate from './TimeCalculate';
import { setupNotificationCategories } from './NotificationManager';

class clsAlarm {
  // ───────────────────────────────
  // 🔔 SET ALARM
  // ───────────────────────────────
  static async setAlarm(usertimeid, date, prayertime, hour, minute, label) {
    const { AlarmModule } = NativeModules;
    const timeCalculate = new TimeCalculate();

    try {
      const alarmTime = timeCalculate.calculateAlarmTime(date, prayertime, hour, minute);
      console.log('Calculated alarm time:', alarmTime);
      if (!alarmTime) throw new Error('Failed to calculate alarm time.');

      const alarmId = await addAlarm(
        alarmTime.finalDate,
        alarmTime.finalHour,
        alarmTime.finalMinute,
        usertimeid
      );

      console.log('✅ Alarm saved:', alarmId);

      // ─── ANDROID ─────────────────────────────
      if (Platform.OS === 'android') {
        AlarmModule.setAlarm(
          alarmId,
          alarmTime.finalDate,
          alarmTime.finalHour,
          alarmTime.finalMinute,
          label
        );
        console.log(`⏰ Android alarm set for ${label}`);
      }

      // ─── iOS ─────────────────────────────
      else if (Platform.OS === 'ios') {
        await setupNotificationCategories();

        // Parse date string (supports DD-MM-YYYY or YYYY-MM-DD)
        let day, month, year;
        const parts = date.split('-').map(Number);
        if (parts[0] > 1900) [year, month, day] = parts;
        else [day, month, year] = parts;

        const triggerDate = new Date(year, month - 1, day, alarmTime.finalHour, alarmTime.finalMinute);
        const triggerTime = triggerDate.getTime();

        if (triggerTime <= Date.now()) {
          console.warn(`⏩ Skipping ${label} (${date}) — time already passed.`);
          return;
        }

        // ✅ consistent uniqueId used for both schedule & cancel
        const uniqueId = `${usertimeid}_${alarmTime.finalDate}_${hour}_${minute}`;

        const trigger = {
          type: TriggerType.TIMESTAMP,
          timestamp: triggerTime,
        };

        await notifee.createTriggerNotification(
          {
            id: uniqueId, // very important
            title: `⏰ ${label}`,
            body: 'المنبه يرن',
            ios: {
              sound: 'alarm',
              categoryId: 'alarm-category',
              foregroundPresentationOptions: {
                sound: true,
                banner: true,
                list: true,
              },
            },
          },
          trigger
        );

        console.log(`📅 iOS alarm scheduled: ${uniqueId} (${triggerDate})`);
      }
    } catch (error) {
      console.error('❌ Error setting alarm:', error.message);
      throw error;
    }
  }

  // ───────────────────────────────
  // ❌ CANCEL ALARM
  // ───────────────────────────────
  static async cancelAlarm(usertimeid) {
    const { AlarmModule } = NativeModules;

    try {
      const alarms = await getAlarmsByUserTimeId(usertimeid);
      console.log('🔎 Found alarms:', alarms);

      if (!alarms || alarms.length === 0) {
        console.log('No alarms found for this user_time_id.');
        return;
      }

      for (const alarm of alarms) {
        // ─── ANDROID ─────────────────────
        if (Platform.OS === 'android') {
          try {
            await AlarmModule.cancelAlarm(alarm.id);
            console.log(`✅ Android alarm ${alarm.id} cancelled`);
          } catch (e) {
            console.warn(`❌ Failed to cancel Android alarm ${alarm.id}:`, e);
          }
        }

        // ─── iOS ─────────────────────────
        else if (Platform.OS === 'ios') {
          const uniqueId = `${usertimeid}_${alarm.finalDate || alarm.date}_${alarm.userHour || hour}_${alarm.userMinute || minute}`;

          try {
            const triggers = await notifee.getTriggerNotifications();
            const exists = triggers.some(t => t.notification.id === uniqueId);

            if (exists) {
              await notifee.cancelNotification(uniqueId);
              await notifee.cancelTriggerNotifications([uniqueId]);
              console.log(`🛑 Canceled iOS notification: ${uniqueId}`);
            } else {
              console.log(`⚠️ No matching iOS trigger found for ${uniqueId}`);
            }
          } catch (err) {
            console.warn(`⚠️ Failed to cancel iOS notification ${uniqueId}:`, err);
          }
        }
      }

      // 🗑️ Clean up database
      await deleteAlarmByUserTime(usertimeid);
      console.log('✅ Alarms deleted from DB');
    } catch (error) {
      console.error('❌ Error canceling alarm:', error);
      throw error;
    } finally {
      try {
        await deleteUserTime(usertimeid);
        console.log('🧹 User Time deleted');
      } catch (err) {
        console.warn('⚠️ Failed to delete user time:', err);
      }
    }
  }
}

export default clsAlarm;

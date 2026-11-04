import {Platform, NativeModules} from 'react-native';
import {TriggerType} from '@notifee/react-native';
import notifee from './notifeeGuard';
import {
  addAlarm,
  deleteAllAlarms,
  getAlarmsByUserTimeId,
} from '../../database/alarmService';
import {
  deleteAllUserTimes,
  deleteUserTime,
  getUserTimes,
} from '../../database/userTimeService';
import {getLocation} from '../../database/settingsService';
import {calculateAlarmTimestamp, formatDuration} from './TimeCalculate';
import clsUtility from './clsUtilty';
import {loadPrayerTimes} from './prayerData';
import {
  ALARM_CATEGORY_ID,
  ALARM_SOUND_IOS,
  RENEW_CHANNEL_ID,
  SNOOZE_ID_PREFIX,
} from './NotificationManager';

const {AlarmModule} = NativeModules;

// iOS keeps at most 64 pending local notifications per app – the rest are
// silently dropped. Keep a margin for the renewal reminder and snoozes.
const IOS_MAX_SCHEDULED = 60;
// Android allows 500 pending alarms per app (Android 12+).
const ANDROID_MAX_SCHEDULED = 450;
// Ignore alarms that would fire within this window (avoid racing "now").
const MIN_LEAD_MS = 5 * 1000;
// Skip automatic (non-forced) reschedules if done recently with same inputs.
const AUTO_RESCHEDULE_TTL_MS = 6 * 60 * 60 * 1000;

const RENEW_NOTIFICATION_ID = 'renew-reminder';

const alarmNotificationId = id => `alarm-${id}`;

// ───────────────────────────────
// Serialization: every mutation runs one after another so add / delete /
// reschedule can never interleave and corrupt the OS ↔ DB mapping.
// ───────────────────────────────
let queue = Promise.resolve();
const serialize = fn => {
  const result = queue.then(fn);
  queue = result.catch(() => {});
  return result;
};

let lastReschedule = null; // { at, signature }

// ───────────────────────────────
// Platform primitives
// ───────────────────────────────

const scheduleNative = async (alarmId, timestamp, label) => {
  if (Platform.OS === 'android') {
    await AlarmModule.setAlarm(alarmId, timestamp, label);
    return;
  }
  await notifee.createTriggerNotification(
    {
      id: alarmNotificationId(alarmId),
      title: `⏰ ${label}`,
      body: 'المنبه يرن',
      ios: {
        sound: ALARM_SOUND_IOS,
        categoryId: ALARM_CATEGORY_ID,
        foregroundPresentationOptions: {sound: true, banner: true, list: true},
      },
    },
    {type: TriggerType.TIMESTAMP, timestamp},
  );
};

const cancelNative = async alarmId => {
  if (Platform.OS === 'android') {
    await AlarmModule.cancelAlarm(alarmId);
    return;
  }
  const id = alarmNotificationId(alarmId);
  await notifee.cancelTriggerNotification(id);
  await notifee.cancelDisplayedNotification(id);
};

/** Cancel every alarm this app scheduled (keeps user-initiated snoozes). */
const cancelAllNative = async () => {
  if (Platform.OS === 'android') {
    await AlarmModule.cancelAll();
  } else {
    const ids = await notifee.getTriggerNotificationIds();
    const toCancel = ids.filter(id => !id.startsWith(SNOOZE_ID_PREFIX));
    if (toCancel.length) {
      await notifee.cancelTriggerNotifications(toCancel);
    }
  }
  await notifee.cancelTriggerNotification(RENEW_NOTIFICATION_ID);
};

/** Reminds the user to open the app before the scheduled window runs out. */
const scheduleRenewReminder = async timestamp => {
  if (Platform.OS === 'android') {
    await notifee.createChannel({id: RENEW_CHANNEL_ID, name: 'تجديد المنبهات'});
  }
  await notifee.createTriggerNotification(
    {
      id: RENEW_NOTIFICATION_ID,
      title: 'افتح التطبيق لتجديد المنبهات',
      body: 'انتهت المنبهات المجدولة، افتح التطبيق ليتم جدولة الأيام القادمة.',
      android: {channelId: RENEW_CHANNEL_ID, pressAction: {id: 'default'}},
      ios: {sound: 'default'},
    },
    {type: TriggerType.TIMESTAMP, timestamp},
  );
};

// ───────────────────────────────
// Planning (pure)
// ───────────────────────────────

/**
 * Build the sorted list of future alarms for all user alarms × days × prayers.
 * Exported for unit tests.
 */
export const buildAlarmPlan = (userTimes, days, now = Date.now()) => {
  const plan = [];
  for (const ut of userTimes) {
    for (const day of days) {
      for (const prayer of ut.prayers) {
        const timestamp = calculateAlarmTimestamp({
          prayerTimestamp: day.timestamps?.[prayer],
          date: day.date,
          prayerTime: day.timings?.[prayer],
          hoursBefore: ut.hour,
          minutesBefore: ut.minute,
        });
        if (timestamp == null || timestamp <= now + MIN_LEAD_MS) {
          continue;
        }
        plan.push({
          userTimeId: ut.id,
          prayer,
          timestamp,
          label: `قبل ${clsUtility.GetNamePrayerAr(prayer)} بـ ${formatDuration(
            ut.hour,
            ut.minute,
          )}`,
        });
      }
    }
  }
  plan.sort((a, b) => a.timestamp - b.timestamp);
  const max = Platform.OS === 'ios' ? IOS_MAX_SCHEDULED : ANDROID_MAX_SCHEDULED;
  return plan.slice(0, max);
};

// ───────────────────────────────
// Public API
// ───────────────────────────────

class clsAlarm {
  /**
   * Rebuild every scheduled alarm from user_times + prayer times.
   * Run on app start, when the app returns to the foreground, after adding an
   * alarm and after changing the city.
   *
   * @param {{force?: boolean}} options force=false skips the work when it was
   *        done recently with the same inputs.
   * @returns {Promise<{ok: boolean, scheduled?: number, fromCache?: boolean, skipped?: boolean}>}
   */
  static rescheduleAll({force = true} = {}) {
    return serialize(async () => {
      const location = await getLocation();
      const userTimes = await getUserTimes();
      const signature = JSON.stringify({location, userTimes});

      if (
        !force &&
        lastReschedule &&
        lastReschedule.signature === signature &&
        Date.now() - lastReschedule.at < AUTO_RESCHEDULE_TTL_MS
      ) {
        return {ok: true, skipped: true};
      }

      const data = await loadPrayerTimes(location);
      if (!data) {
        // No network and no cache: keep whatever is already scheduled.
        return {ok: false};
      }

      const plan = buildAlarmPlan(userTimes, data.days);

      await cancelAllNative();
      await deleteAllAlarms();

      let scheduled = 0;
      for (const item of plan) {
        const alarmId = await addAlarm(item.userTimeId, item.prayer, item.timestamp);
        try {
          await scheduleNative(alarmId, item.timestamp, item.label);
          scheduled++;
        } catch (e) {
          console.warn(`Failed to schedule alarm ${alarmId}:`, e?.message ?? e);
        }
      }

      if (plan.length) {
        await scheduleRenewReminder(plan[plan.length - 1].timestamp + 60 * 1000);
      }

      lastReschedule = {at: Date.now(), signature};
      console.log(`📅 Scheduled ${scheduled}/${plan.length} alarms`);
      return {ok: true, scheduled, fromCache: data.fromCache};
    });
  }

  /** Cancel and delete one user alarm (all its scheduled occurrences). */
  static cancelAlarm(userTimeId) {
    return serialize(async () => {
      const alarms = await getAlarmsByUserTimeId(userTimeId);
      for (const alarm of alarms) {
        // Throws on failure → DB rows are kept so the user can retry.
        await cancelNative(alarm.id);
      }
      await deleteUserTime(userTimeId);
      lastReschedule = null;
    });
  }

  /** Cancel and delete every alarm. */
  static cancelAll() {
    return serialize(async () => {
      await cancelAllNative();
      if (Platform.OS === 'ios') {
        await notifee.cancelDisplayedNotifications();
      }
      await deleteAllUserTimes();
      lastReschedule = null;
    });
  }

  /** Remove notifications scheduled by the pre-v2 id scheme. */
  static clearLegacyScheduled() {
    return serialize(async () => {
      if (Platform.OS === 'ios') {
        await notifee.cancelTriggerNotifications();
      } else {
        await AlarmModule.cancelAll();
      }
    });
  }
}

export default clsAlarm;

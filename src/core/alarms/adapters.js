import {NativeModules} from 'react-native';
import * as prayerAlarm from './prayerAlarmNative';
import {ALARM_SOUND_IOS} from '../../librarys/NotificationManager';

const REMINDER_IDS = [1, 2];

// 'default' keeps the sound the app always used; other ids map to a bundled file.
const soundFileFor = soundId =>
  !soundId || soundId === 'default' ? ALARM_SOUND_IOS : `${soundId}.caf`;

const iosAdapter = native => ({
  listPending: () => native.getPendingIds(),
  schedule: item =>
    item.type === 'reminder'
      ? native.schedule({
          id: item.id,
          fireAt: item.fireAt,
          title: item.title,
          body: item.body,
          plain: true,
        })
      : native.schedule({
          id: item.id,
          fireAt: item.fireAt,
          title: `⏰ ${item.label}`,
          body: 'المنبه يرن',
          sound: soundFileFor(item.soundId),
          snoozeMinutes: item.snoozeMin,
          maxSnooze: item.maxSnooze,
        }),
  cancel: entry => native.cancel([entry.id]),
  // Alarms of earlier versions have other ids: drop them too. Snoozes the user
  // asked for are kept.
  cancelAll: async () => {
    await native.cancelLegacy();
    await native.cancelAll(false);
  },
  /** Snoozes waiting to ring (they take slots from the 64 budget). */
  pendingSnoozes: async () =>
    (await native.getPendingIds()).filter(id => id.startsWith('snooze-')).length,
});

const androidAdapter = module => ({
  listPending: null, // AlarmManager cannot be queried
  schedule: item =>
    item.type === 'reminder'
      ? module.scheduleReminder(item.nid, item.fireAt, item.title, item.body)
      : module.setAlarm(item.nid, item.fireAt, item.label),
  cancel: entry =>
    entry.type === 'reminder' ? module.cancelReminder(entry.nid) : module.cancelAlarm(entry.nid),
  cancelAll: async () => {
    await module.cancelAll();
    for (const id of REMINDER_IDS) {
      await module.cancelReminder(id);
    }
  },
  pendingSnoozes: async () => 0,
});

export const createAdapter = ({
  platform,
  native = prayerAlarm,
  alarmModule = NativeModules.AlarmModule,
}) => (platform === 'android' ? androidAdapter(alarmModule) : iosAdapter(native));

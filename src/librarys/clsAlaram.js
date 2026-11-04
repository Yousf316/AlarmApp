import {Platform, NativeModules} from 'react-native';
import {getLocation} from '../../database/settingsService';
import {
  deleteAllUserTimes,
  deleteUserTime,
  getUserTimes,
} from '../../database/userTimeService';
import {fromLegacyUserTime} from '../core/alarms/model';
import {buildDesired} from '../core/alarms/window';
import {reconcile, resetSchedule} from '../core/alarms/reconciler';
import {createAdapter} from '../core/alarms/adapters';
import {scheduleStore} from '../core/alarms/scheduleStore';
import * as prayerAlarm from '../core/alarms/prayerAlarmNative';
import {methodForCountry} from '../core/prayer/methods';
import {getTimetable} from '../core/prayer/timetableRepo';
import {timetableStore} from '../core/storage/timetableStore';

const {AlarmModule} = NativeModules;

// ───────────────────────────────
// Serialization: every mutation runs one after another so add / delete /
// reschedule can never interleave and corrupt the OS ↔ record mapping.
// ───────────────────────────────
let queue = Promise.resolve();
const serialize = fn => {
  const result = queue.then(fn);
  queue = result.catch(() => {});
  return result;
};

const adapterForPlatform = () => createAdapter({platform: Platform.OS});

/** Alarm ids look like `legacy-<userTimeId>-<Prayer>`; occurrence ids start with them. */
const occurrencePrefix = userTimeId => `legacy-${userTimeId}-`;

/**
 * Registrations made before 3a (sequential ids, 20-day window, one reminder) are
 * removed once, the first time the new scheduler is able to rebuild them.
 */
const ensureMigrated = async adapter => {
  if (scheduleStore.isMigrated()) {
    return;
  }
  await resetSchedule({adapter, store: scheduleStore});
  scheduleStore.markMigrated();
};

const loadAlarms = async () => (await getUserTimes()).flatMap(fromLegacyUserTime);

/**
 * Register what should be registered and nothing else. Needs the prayer
 * timetable (cached, API or computed offline); without one nothing is touched.
 */
const syncSchedule = async () => {
  const location = await getLocation();
  const loaded = await getTimetable({
    location,
    method: methodForCountry(location.country),
    store: timetableStore,
  });
  if (!loaded) {
    return {ok: false};
  }

  const adapter = adapterForPlatform();
  await ensureMigrated(adapter);

  const built = buildDesired({
    alarms: await loadAlarms(),
    timetable: loaded.timetable,
    platform: Platform.OS,
    pendingSnoozes: await adapter.pendingSnoozes(),
  });
  const result = await reconcile({desired: built.desired, adapter, store: scheduleStore});

  const alarmsInWindow = built.desired.filter(item => item.type === 'alarm').length;
  scheduleStore.saveStatus({
    coverageUntil: built.coverageUntil,
    tz: loaded.timetable.tz,
    scheduled: alarmsInWindow,
    source: loaded.status,
    truncated: built.truncated,
    blocked: built.blocked,
    failures: result.cancelErrors.length + result.scheduleErrors.length,
    updatedAt: Date.now(),
  });
  if (result.scheduleErrors.length) {
    console.warn(`Failed to schedule ${result.scheduleErrors.length} alarm(s):`, result.scheduleErrors[0].error);
  }
  console.log(`📅 ${alarmsInWindow} alarms in the window (+${result.scheduled} registered, -${result.cancelled} cancelled)`);
  return {
    ok: true,
    scheduled: alarmsInWindow,
    coverageUntil: built.coverageUntil,
    source: loaded.status,
  };
};

class clsAlarm {
  /**
   * Bring the OS registrations in line with the user's alarms and the prayer
   * timetable. Cheap when nothing changed (no native calls except one query),
   * so it runs on app start, on returning to the foreground, after adding an
   * alarm and after changing the city.
   *
   * @returns {Promise<{ok:boolean, scheduled?:number, coverageUntil?:number|null, source?:string}>}
   */
  static rescheduleAll() {
    return serialize(syncSchedule);
  }

  /** Cancel and delete one user alarm (all its registered occurrences). */
  static cancelAlarm(userTimeId) {
    return serialize(async () => {
      const adapter = adapterForPlatform();
      const map = scheduleStore.loadMap();
      const prefix = occurrencePrefix(userTimeId);
      const ids = Object.keys(map).filter(id => id.startsWith(prefix));

      let failure = null;
      for (const id of ids) {
        try {
          await adapter.cancel({id, ...map[id]});
          delete map[id];
        } catch (error) {
          failure = failure ?? error;
        }
      }
      scheduleStore.saveMap(map);
      if (failure) {
        // Throws → the row is kept so the user can retry.
        throw failure;
      }

      await deleteUserTime(userTimeId);
      // The freed slots can take later occurrences of the other alarms.
      try {
        await syncSchedule();
      } catch (error) {
        console.warn('Refill after delete failed:', error?.message ?? error);
      }
    });
  }

  /** Cancel and delete every alarm. */
  static cancelAll() {
    return serialize(async () => {
      const adapter = adapterForPlatform();
      await resetSchedule({adapter, store: scheduleStore});
      if (Platform.OS === 'ios') {
        await prayerAlarm.clearDelivered();
      }
      await deleteAllUserTimes();
      scheduleStore.saveStatus(null);
    });
  }

  /** Remove everything registered with the OS by any earlier scheme (SQLite migration path). */
  static clearLegacyScheduled() {
    return serialize(async () => {
      if (Platform.OS === 'ios') {
        await prayerAlarm.cancelLegacy();
        await prayerAlarm.cancelAll(true);
      } else {
        await AlarmModule.cancelAll();
      }
      scheduleStore.saveMap({});
    });
  }
}

export default clsAlarm;

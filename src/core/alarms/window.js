import {fingerprintOfParts, MIN_LEAD_MS, planOccurrences} from './planner';

/**
 * iOS keeps at most 64 pending local notifications per app and silently drops
 * the rest. Budget: alarms + 2 renew reminders + room for snoozes (a snooze is
 * a pending notification too, scheduled natively while the app is closed).
 */
export const IOS_BUDGET = 64;
export const SNOOZE_RESERVE = 5;
export const REMINDER_COUNT = 2;
/** Alarms that fit when no more than SNOOZE_RESERVE snoozes are pending. */
export const IOS_ALARM_CAP = IOS_BUDGET - REMINDER_COUNT - SNOOZE_RESERVE; // 57
/** Android allows 500 pending alarms (12+); keep a margin. */
export const ANDROID_ALARM_CAP = 450;

const DAY_MS = 24 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

/**
 * How many alarms may be scheduled. On iOS more than SNOOZE_RESERVE pending
 * snoozes take slots from the alarms (never the other way round: a snooze must
 * always be accepted).
 */
export const alarmCap = ({platform, pendingSnoozes = 0}) => {
  if (platform === 'android') {
    return ANDROID_ALARM_CAP;
  }
  return Math.max(0, IOS_BUDGET - REMINDER_COUNT - Math.max(pendingSnoozes, SNOOZE_RESERVE));
};

/** The earliest `cap` occurrences (the plan is already sorted by time). */
export const selectWindow = ({plan, platform, pendingSnoozes = 0}) => {
  const cap = alarmCap({platform, pendingSnoozes});
  return {alarms: plan.slice(0, cap), cap, truncated: plan.length > cap};
};

/** `fireAt` of the last scheduled alarm, or null when nothing is scheduled. */
export const coverageOf = alarms => (alarms.length ? alarms[alarms.length - 1].fireAt : null);

/**
 * Two reminders to open the app before the window runs dry: one a day before
 * the last scheduled alarm and one right after it. Reminders already in the
 * past are dropped. Ids are fixed so the reconciler updates them in place.
 */
export const buildReminders = ({coverageUntil, now = Date.now()}) => {
  if (coverageUntil == null) {
    return [];
  }
  const items = [
    {
      id: 'renew-1',
      nid: 1,
      fireAt: coverageUntil - DAY_MS,
      title: 'تنتهي المنبهات المجدولة غداً',
      body: 'افتح التطبيق لتجديد المنبهات.',
    },
    {
      id: 'renew-2',
      nid: 2,
      fireAt: coverageUntil + MINUTE_MS,
      title: 'افتح التطبيق لتجديد المنبهات',
      body: 'انتهت المنبهات المجدولة، افتح التطبيق ليتم جدولة الأيام القادمة.',
    },
  ];
  return items
    .filter(item => item.fireAt > now + MIN_LEAD_MS)
    .map(item => ({
      ...item,
      type: 'reminder',
      fingerprint: fingerprintOfParts(['reminder', item.fireAt, item.title, item.body]),
    }));
};

/**
 * Everything that should be registered with the OS right now.
 *
 * @returns {{desired:Array, coverageUntil:number|null, truncated:boolean,
 *   cap:number, planned:number, blocked:boolean}}
 *   `blocked`: alarms exist but pending snoozes leave no room for any of them.
 */
export const buildDesired = ({
  alarms,
  timetable,
  adjustments,
  platform,
  pendingSnoozes = 0,
  now = Date.now(),
}) => {
  const plan = planOccurrences({alarms, timetable, adjustments, now});
  const {alarms: window, cap, truncated} = selectWindow({plan, platform, pendingSnoozes});
  const coverageUntil = coverageOf(window);
  const reminders = buildReminders({coverageUntil, now});
  return {
    desired: [...window.map(item => ({...item, type: 'alarm'})), ...reminders],
    coverageUntil,
    truncated,
    cap,
    planned: plan.length,
    blocked: plan.length > 0 && window.length === 0,
  };
};

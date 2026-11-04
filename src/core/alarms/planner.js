import {weekdayOf} from '../time/zone';
import clsUtility from '../../librarys/clsUtilty';
import {formatDuration} from '../../librarys/TimeCalculate';

/** Ignore alarms that would fire within this window (avoids racing "now"). */
export const MIN_LEAD_MS = 5 * 1000;

const MIN_MS = 60 * 1000;

// FNV-1a, 32 bit – stable across runs and platforms.
export const hash32 = text => {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
};

const hex = n => n.toString(16).padStart(8, '0');

/** Deterministic id: the same alarm/day/prayer always gets the same id. */
export const occurrenceId = (alarmId, dateKey, prayer) => `${alarmId}|${dateKey}|${prayer}`;

/** Short stable hash of any list of values (used as a change detector). */
export const fingerprintOfParts = parts => hex(hash32(parts.join('|')));

/**
 * Changes whenever anything that the OS-registered alarm depends on changes.
 * Same id + different fingerprint ⇒ cancel and schedule again.
 */
export const fingerprintOf = ({fireAt, soundId, style, snoozeMin, maxSnooze}) =>
  fingerprintOfParts([fireAt, soundId, style, snoozeMin, maxSnooze]);

/** Per-prayer manual adjustment, in minutes (positive = later). */
export const applyAdjustment = (prayerMs, adjustments, prayer) =>
  prayerMs + (Number(adjustments?.[prayer]) || 0) * MIN_MS;

export const buildLabel = ({kind, prayer, offsetMin}) => {
  const name = clsUtility.GetNamePrayerAr(prayer);
  if (kind === 'adhan') {
    return `حان وقت أذان ${name}`;
  }
  const duration = formatDuration(Math.floor(offsetMin / 60), offsetMin % 60);
  return `${kind === 'before' ? 'قبل' : 'بعد'} ${name} بـ ${duration}`;
};

/**
 * Every future occurrence of every enabled alarm over the timetable, sorted by
 * time. Pure: no I/O, no clock besides `now`.
 *
 * - The weekday filter applies to the day of the *prayer* (so "1h before Fajr"
 *   on Friday means Friday's Fajr, even though it rings after midnight).
 * - Times are exact instants, so crossing midnight / month / year needs no
 *   special handling; day keys are in the timetable's zone, never the device's.
 *
 * @param {object} args
 * @param {Array} args.alarms normalised alarms (see model.js)
 * @param {{tz:string, days:Record<string,Record<string,number>>}} args.timetable
 * @param {Record<string,number>} [args.adjustments]
 * @returns {Array<{id:string,nid:number,alarmId:string,prayer:string,kind:string,
 *   dateKey:string,fireAt:number,fingerprint:string,label:string,soundId:string,
 *   style:string,snoozeMin:number,maxSnooze:number}>}
 */
export const planOccurrences = ({alarms, timetable, adjustments = {}, now = Date.now()}) => {
  if (!timetable?.days || !timetable.tz) {
    return [];
  }
  const dateKeys = Object.keys(timetable.days).sort();
  const plan = [];

  for (const alarm of alarms) {
    if (!alarm.enabled) {
      continue;
    }
    for (const dateKey of dateKeys) {
      const baseMs = timetable.days[dateKey]?.[alarm.prayer];
      if (!Number.isFinite(baseMs)) {
        continue;
      }
      if (alarm.days.length && !alarm.days.includes(weekdayOf(dateKey, timetable.tz))) {
        continue;
      }
      const prayerMs = applyAdjustment(baseMs, adjustments, alarm.prayer);
      const sign = alarm.kind === 'before' ? -1 : alarm.kind === 'after' ? 1 : 0;
      const fireAt = prayerMs + sign * alarm.offsetMin * MIN_MS;
      if (fireAt <= now + MIN_LEAD_MS) {
        continue;
      }
      plan.push({
        id: occurrenceId(alarm.id, dateKey, alarm.prayer),
        alarmId: alarm.id,
        prayer: alarm.prayer,
        kind: alarm.kind,
        dateKey,
        fireAt,
        fingerprint: fingerprintOf({fireAt, ...alarm}),
        label: buildLabel(alarm),
        soundId: alarm.soundId,
        style: alarm.style,
        snoozeMin: alarm.snoozeMin,
        maxSnooze: alarm.maxSnooze,
      });
    }
  }

  plan.sort((a, b) => a.fireAt - b.fireAt || (a.id < b.id ? -1 : 1));

  // Android needs an int per alarm (PendingIntent request code): hash, and
  // probe forward on the (rare) collision so ids stay unique within the plan.
  const used = new Set();
  for (const item of plan) {
    let nid = (hash32(item.id) & 0x7fffffff) || 1;
    while (used.has(nid)) {
      nid = ((nid + 1) & 0x7fffffff) || 1;
    }
    used.add(nid);
    item.nid = nid;
  }
  return plan;
};

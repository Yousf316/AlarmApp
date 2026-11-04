import {PRAYERS} from '../prayer/localCalc';

export const KINDS = ['before', 'after', 'adhan'];
export const STYLES = ['alarm', 'notification'];

export const DEFAULT_ALARM = {
  kind: 'before',
  offsetMin: 15,
  enabled: true,
  days: [], // empty = every day; otherwise 0 (Sunday) … 6 (Saturday)
  soundId: 'default',
  style: 'alarm',
  snoozeMin: 5, // 0 = no snooze button
  maxSnooze: 3, // 0 = unlimited
};

const clampInt = (value, min, max, fallback) => {
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

/** Validate/complete a user-edited alarm. Returns null if it can't be salvaged. */
export const normalizeAlarm = raw => {
  if (!raw || !PRAYERS.includes(raw.prayer) || raw.id == null) {
    return null;
  }
  const kind = KINDS.includes(raw.kind) ? raw.kind : DEFAULT_ALARM.kind;
  return {
    id: String(raw.id),
    prayer: raw.prayer,
    kind,
    offsetMin: kind === 'adhan' ? 0 : clampInt(raw.offsetMin, 0, 12 * 60, DEFAULT_ALARM.offsetMin),
    enabled: raw.enabled !== false,
    days: [...new Set((raw.days ?? []).map(Number).filter(d => Number.isInteger(d) && d >= 0 && d <= 6))].sort(),
    soundId: typeof raw.soundId === 'string' && raw.soundId ? raw.soundId : DEFAULT_ALARM.soundId,
    style: STYLES.includes(raw.style) ? raw.style : DEFAULT_ALARM.style,
    snoozeMin: clampInt(raw.snoozeMin, 0, 60, DEFAULT_ALARM.snoozeMin),
    maxSnooze: clampInt(raw.maxSnooze, 0, 20, DEFAULT_ALARM.maxSnooze),
  };
};

/**
 * Old "H:M before each of these prayers" row → one alarm per prayer.
 * Keeps what those alarms always did: a 5-minute snooze, repeatable forever.
 */
export const fromLegacyUserTime = ut =>
  (ut.prayers ?? [])
    .map(prayer =>
      normalizeAlarm({
        id: `legacy-${ut.id}-${prayer}`,
        prayer,
        kind: 'before',
        offsetMin: Number(ut.hour) * 60 + Number(ut.minute),
        snoozeMin: 5,
        maxSnooze: 0,
      }),
    )
    .filter(Boolean);

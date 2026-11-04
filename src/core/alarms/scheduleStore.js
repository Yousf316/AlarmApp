import {getJSON, setJSON} from '../storage/mmkv';

const MAP = 'schedule.map';
const STATUS = 'schedule.status';
const MIGRATED = 'schedule.v3';

/** Persistence for reconciler.js and the coverage banner. */
export const scheduleStore = {
  /** What the app registered with the OS: {id: {fingerprint, fireAt, nid, type}} */
  loadMap: () => getJSON(MAP, {}),
  saveMap: map => setJSON(MAP, map),

  /** Last reconcile summary: {coverageUntil, tz, scheduled, source, truncated, blocked, updatedAt} */
  loadStatus: () => getJSON(STATUS, null),
  saveStatus: status => setJSON(STATUS, status),

  /** True once the pre-3a registrations were cleaned up. */
  isMigrated: () => getJSON(MIGRATED, false) === true,
  markMigrated: () => setJSON(MIGRATED, true),
};

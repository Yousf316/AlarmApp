import {storage} from '../src/core/storage/mmkv';
import {migrateFromSqlite} from '../src/core/storage/migrateFromSqlite';

let initPromise = null;

/**
 * Prepares storage. Safe to call many times – the work runs once.
 * The first launch after the SQLite → MMKV switch imports the old data and
 * reports `migratedFromLegacy` so the caller can drop OS alarms that were
 * registered under the old ids and rebuild them.
 */
export const initDB = () => {
  if (!initPromise) {
    initPromise = migrateFromSqlite()
      .then(migratedFromLegacy => ({migratedFromLegacy}))
      .catch(error => {
        initPromise = null; // allow a retry
        throw error;
      });
  }
  return initPromise;
};

// Debug helper
export const deleteDB = async () => {
  storage.clearAll();
  initPromise = null;
};

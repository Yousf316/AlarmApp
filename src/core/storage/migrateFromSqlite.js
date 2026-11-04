import SQLite from 'react-native-sqlite-storage';
import {ensureSeqAtLeast, setJSON, storage} from './mmkv';

const DB_NAME = 'alarms.db';
const MIGRATED_KEY = 'migrated_from_sqlite_v1';
const ALL_PRAYERS = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

const select = (db, sql) =>
  new Promise((resolve, reject) => {
    db.transaction(
      tx => {
        tx.executeSql(
          sql,
          [],
          (_, result) => resolve(result.rows.raw()),
          (_, error) => {
            reject(error);
            return true;
          },
        );
      },
      error => reject(error),
    );
  });

const tableExists = async (db, name) =>
  (
    await select(
      db,
      `SELECT name FROM sqlite_master WHERE type='table' AND name='${name}'`,
    )
  ).length > 0;

const parsePrayers = value => {
  const list =
    typeof value === 'string' && value.length > 0
      ? value.split(',').filter(p => ALL_PRAYERS.includes(p))
      : [];
  // Pre-v2 rows had no prayers column: they applied to every prayer.
  return list.length ? list : ALL_PRAYERS;
};

/**
 * One-time copy of user alarms + settings from the legacy SQLite database
 * into MMKV. Scheduled OS alarm rows are not copied: they are rebuilt by the
 * scheduler. The sequence counter is advanced past the old ids so a new alarm
 * can never reuse the id of an alarm that is still registered with the OS.
 *
 * @returns {Promise<boolean>} true if legacy data was imported
 */
export const migrateFromSqlite = async () => {
  if (storage.getBoolean(MIGRATED_KEY)) {
    return false;
  }

  let db;
  try {
    db = SQLite.openDatabase({name: DB_NAME, location: 'default'});
    let imported = false;

    if (await tableExists(db, 'user_times')) {
      const rows = await select(db, 'SELECT * FROM user_times ORDER BY id');
      if (rows.length) {
        setJSON(
          'user_times',
          rows.map(r => ({
            id: r.id,
            hour: r.hour,
            minute: r.minute,
            prayers: parsePrayers(r.prayers),
          })),
        );
        ensureSeqAtLeast('user_times_seq', Math.max(...rows.map(r => r.id)));
        imported = true;
      }
    }

    if (await tableExists(db, 'alarms')) {
      const rows = await select(db, 'SELECT MAX(id) AS max_id FROM alarms');
      ensureSeqAtLeast('alarms_seq', rows[0]?.max_id ?? 0);
    }

    if (await tableExists(db, 'settings')) {
      const rows = await select(db, 'SELECT key, value FROM settings');
      for (const {key, value} of rows) {
        if (typeof value === 'string') {
          storage.set(`setting:${key}`, value);
          imported = true;
        }
      }
    }

    storage.set(MIGRATED_KEY, true);
    return imported;
  } catch (e) {
    // Leave the flag unset so the next launch retries; never block startup.
    console.warn('SQLite → MMKV migration failed:', e?.message ?? e);
    return false;
  } finally {
    try {
      db?.close?.();
    } catch {}
  }
};

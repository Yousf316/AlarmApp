import SQLite from 'react-native-sqlite-storage';

const DB_NAME = 'alarms.db';
const SCHEMA_VERSION = 2;

const db = SQLite.openDatabase({name: DB_NAME, location: 'default'});

// ───────────────────────────────
// Promise helpers
// ───────────────────────────────

/** Run a single statement and resolve with the raw result set. */
export const run = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.transaction(
      tx => {
        tx.executeSql(
          sql,
          params,
          (_, result) => resolve(result),
          (_, error) => {
            reject(error);
            return true; // rollback
          },
        );
      },
      error => reject(error),
    );
  });

/** Run a SELECT and resolve with an array of rows. */
export const query = async (sql, params = []) => {
  const result = await run(sql, params);
  return result.rows.raw();
};

/** Run several statements atomically in one transaction. */
export const runBatch = statements =>
  new Promise((resolve, reject) => {
    db.transaction(
      tx => {
        for (const [sql, params = []] of statements) {
          tx.executeSql(sql, params);
        }
      },
      error => reject(error),
      () => resolve(),
    );
  });

// ───────────────────────────────
// Schema / migrations
// ───────────────────────────────

const getUserVersion = async () => {
  const rows = await query('PRAGMA user_version');
  return rows[0]?.user_version ?? 0;
};

const columnExists = async (table, column) => {
  const rows = await query(`PRAGMA table_info(${table})`);
  return rows.some(r => r.name === column);
};

let initPromise = null;

/**
 * Creates / migrates the schema. Safe to call many times – the work runs once.
 *
 * Schema v2:
 *   user_times(id, hour, minute, prayers)      – one row per alarm the user created
 *   alarms(id, user_time_id, prayer, timestamp) – one row per scheduled OS alarm
 *   settings(key, value)                        – city, country, prayer-times cache
 *
 * Returns { migratedFromLegacy } so the caller can clear notifications that were
 * scheduled by the old (broken) id scheme.
 */
export const initDB = () => {
  if (!initPromise) {
    initPromise = (async () => {
      await run(
        `CREATE TABLE IF NOT EXISTS user_times (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          hour INTEGER,
          minute INTEGER
        )`,
      );
      await run(
        `CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT
        )`,
      );

      const version = await getUserVersion();
      let migratedFromLegacy = false;

      if (version < 2) {
        if (!(await columnExists('user_times', 'prayers'))) {
          await run('ALTER TABLE user_times ADD COLUMN prayers TEXT');
        }
        // The old alarms table stored dates in mixed/UTC formats and cannot be
        // trusted. It is rebuilt from user_times by clsAlarm.rescheduleAll().
        await run('DROP TABLE IF EXISTS alarms');
        migratedFromLegacy = version === 0;
      }

      await run(
        `CREATE TABLE IF NOT EXISTS alarms (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_time_id INTEGER NOT NULL,
          prayer TEXT NOT NULL,
          timestamp INTEGER NOT NULL,
          FOREIGN KEY (user_time_id) REFERENCES user_times(id) ON DELETE CASCADE
        )`,
      );
      await run(
        'CREATE INDEX IF NOT EXISTS idx_alarms_user_time ON alarms(user_time_id)',
      );
      await run(`PRAGMA user_version = ${SCHEMA_VERSION}`);

      return {migratedFromLegacy};
    })().catch(error => {
      initPromise = null; // allow a retry
      throw error;
    });
  }
  return initPromise;
};

// ───────────────────────────────
// Debug helpers
// ───────────────────────────────

export const deleteDB = () =>
  new Promise((resolve, reject) => {
    SQLite.deleteDatabase({name: DB_NAME, location: 'default'}, resolve, reject);
  });

export const showTables = async () => {
  const rows = await query("SELECT name FROM sqlite_master WHERE type='table'");
  console.log('📂 Tables in database:', rows);
  return rows;
};

export default db;

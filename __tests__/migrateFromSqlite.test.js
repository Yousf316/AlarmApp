/* eslint-env jest */
import SQLite from 'react-native-sqlite-storage';
import {storage} from '../src/core/storage/mmkv';
import {migrateFromSqlite} from '../src/core/storage/migrateFromSqlite';
import {getUserTimes, addUserTime} from '../database/userTimeService';
import {addAlarm} from '../database/alarmService';
import {getLocation} from '../database/settingsService';

/** Fake legacy DB: tables = { name: rows[] }; null = no such table. */
const mockLegacyDb = tables => {
  const db = {
    close: jest.fn(),
    transaction: (cb, onError) => {
      const tx = {
        executeSql: (sql, _params, onSuccess) => {
          const exists = /FROM sqlite_master.*name='(\w+)'/.exec(sql);
          let rows = [];
          if (exists) {
            rows = tables[exists[1]] ? [{name: exists[1]}] : [];
          } else if (/MAX\(id\)/.test(sql)) {
            const ids = (tables.alarms ?? []).map(r => r.id);
            rows = [{max_id: ids.length ? Math.max(...ids) : null}];
          } else {
            const table = /FROM (\w+)/.exec(sql)[1];
            rows = tables[table] ?? [];
          }
          onSuccess({}, {rows: {raw: () => rows}});
        },
      };
      try {
        cb(tx);
      } catch (e) {
        onError(e);
      }
    },
  };
  SQLite.openDatabase.mockReturnValue(db);
  return db;
};

beforeEach(() => {
  storage.clearAll();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

describe('migrateFromSqlite', () => {
  it('imports alarms and settings and moves id sequences past old ids', async () => {
    mockLegacyDb({
      user_times: [
        {id: 3, hour: 0, minute: 30, prayers: 'Fajr,Isha'},
        {id: 7, hour: 1, minute: 0, prayers: null}, // pre-v2 row: all prayers
      ],
      alarms: [{id: 120}, {id: 95}],
      settings: [
        {key: 'location', value: JSON.stringify({city: 'Riyadh', country: 'SA'})},
      ],
    });

    expect(await migrateFromSqlite()).toBe(true);

    const times = await getUserTimes();
    expect(times[0]).toEqual({id: 3, hour: 0, minute: 30, prayers: ['Fajr', 'Isha']});
    expect(times[1].prayers).toEqual(['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']);
    expect(await getLocation()).toEqual({city: 'Riyadh', country: 'SA'});

    expect(await addUserTime(0, 5, ['Asr'])).toBe(8);
    expect(await addAlarm(8, 'Asr', 1)).toBe(121);
  });

  it('runs only once', async () => {
    const db = mockLegacyDb({user_times: [{id: 1, hour: 0, minute: 5, prayers: 'Fajr'}]});
    expect(await migrateFromSqlite()).toBe(true);
    SQLite.openDatabase.mockClear();
    expect(await migrateFromSqlite()).toBe(false);
    expect(SQLite.openDatabase).not.toHaveBeenCalled();
    expect(db.close).toHaveBeenCalled();
  });

  it('reports nothing imported on a fresh install and still marks done', async () => {
    mockLegacyDb({});
    expect(await migrateFromSqlite()).toBe(false);
    expect(storage.getBoolean('migrated_from_sqlite_v1')).toBe(true);
  });

  it('does not throw and retries next launch when the legacy DB fails', async () => {
    SQLite.openDatabase.mockImplementation(() => {
      throw new Error('boom');
    });
    expect(await migrateFromSqlite()).toBe(false);
    expect(storage.getBoolean('migrated_from_sqlite_v1')).toBeFalsy();
  });
});

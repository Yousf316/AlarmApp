/* eslint-env jest */
import {storage} from '../src/core/storage/mmkv';
import {
  addUserTime,
  deleteAllUserTimes,
  deleteUserTime,
  getUserTimes,
} from '../database/userTimeService';
import {
  addAlarm,
  deleteAllAlarms,
  getAlarms,
  getAlarmsByUserTimeId,
} from '../database/alarmService';
import {
  DEFAULT_LOCATION,
  getLocation,
  getPrayerCache,
  setLocation,
  setPrayerCache,
} from '../database/settingsService';

beforeEach(() => {
  storage.clearAll();
});

describe('userTimeService', () => {
  it('stores alarms with increasing ids and filters invalid prayers', async () => {
    const a = await addUserTime(0, 30, ['Fajr', 'Bogus', 'Isha']);
    const b = await addUserTime(1, 0, ['Asr']);
    expect(b).toBeGreaterThan(a);
    const all = await getUserTimes();
    expect(all).toEqual([
      {id: a, hour: 0, minute: 30, prayers: ['Fajr', 'Isha']},
      {id: b, hour: 1, minute: 0, prayers: ['Asr']},
    ]);
  });

  it('never reuses an id after deletion', async () => {
    const a = await addUserTime(0, 10, ['Fajr']);
    await deleteUserTime(a);
    const b = await addUserTime(0, 10, ['Fajr']);
    expect(b).toBeGreaterThan(a);
  });

  it('deleting a user time also removes its scheduled alarms', async () => {
    const u1 = await addUserTime(0, 10, ['Fajr']);
    const u2 = await addUserTime(0, 20, ['Fajr']);
    await addAlarm(u1, 'Fajr', 2000);
    await addAlarm(u2, 'Fajr', 1000);
    await deleteUserTime(u1);
    expect(await getAlarmsByUserTimeId(u1)).toEqual([]);
    expect((await getAlarms()).map(x => x.user_time_id)).toEqual([u2]);
  });

  it('deleteAll clears both lists', async () => {
    const u = await addUserTime(0, 10, ['Fajr']);
    await addAlarm(u, 'Fajr', 1000);
    await deleteAllUserTimes();
    expect(await getUserTimes()).toEqual([]);
    expect(await getAlarms()).toEqual([]);
  });
});

describe('alarmService', () => {
  it('returns alarms sorted by time and keeps ids unique after deleteAll', async () => {
    const x = await addAlarm(1, 'Fajr', 3000);
    await addAlarm(1, 'Dhuhr', 1000);
    expect((await getAlarms()).map(a => a.timestamp)).toEqual([1000, 3000]);
    await deleteAllAlarms();
    const y = await addAlarm(1, 'Asr', 500);
    expect(y).toBeGreaterThan(x);
  });
});

describe('settingsService', () => {
  it('defaults the location and round-trips a new one', async () => {
    expect(await getLocation()).toEqual(DEFAULT_LOCATION);
    await setLocation('Cairo', 'EG');
    expect(await getLocation()).toEqual({city: 'Cairo', country: 'EG'});
  });

  it('survives corrupt location JSON', async () => {
    storage.set('setting:location', '{not json');
    expect(await getLocation()).toEqual(DEFAULT_LOCATION);
  });

  it('round-trips the prayer cache', async () => {
    expect(await getPrayerCache()).toBeNull();
    await setPrayerCache('Jeddah', 'SA', [{date: '01-01-2027'}]);
    expect(await getPrayerCache()).toEqual({
      city: 'Jeddah',
      country: 'SA',
      days: [{date: '01-01-2027'}],
    });
  });
});

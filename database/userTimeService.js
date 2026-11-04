import {query, run, runBatch} from './db';

export const PRAYER_NAMES = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

const parsePrayers = value =>
  typeof value === 'string' && value.length > 0
    ? value.split(',').filter(p => PRAYER_NAMES.includes(p))
    : [];

/**
 * Save a user alarm: "ring <hour>h <minute>m before each of <prayers>".
 * @param {number} hour
 * @param {number} minute
 * @param {string[]} prayers e.g. ['Fajr', 'Isha']
 */
export const addUserTime = async (hour, minute, prayers) => {
  const valid = prayers.filter(p => PRAYER_NAMES.includes(p));
  const result = await run(
    'INSERT INTO user_times (hour, minute, prayers) VALUES (?, ?, ?)',
    [hour, minute, valid.join(',')],
  );
  return result.insertId;
};

/** @returns {Promise<Array<{id:number,hour:number,minute:number,prayers:string[]}>>} */
export const getUserTimes = async () => {
  const rows = await query('SELECT * FROM user_times ORDER BY id');
  return rows.map(r => ({...r, prayers: parsePrayers(r.prayers)}));
};

/** Delete a user alarm and its scheduled rows. */
export const deleteUserTime = id =>
  runBatch([
    ['DELETE FROM alarms WHERE user_time_id = ?', [id]],
    ['DELETE FROM user_times WHERE id = ?', [id]],
  ]);

export const deleteAllUserTimes = () =>
  runBatch([['DELETE FROM alarms'], ['DELETE FROM user_times']]);

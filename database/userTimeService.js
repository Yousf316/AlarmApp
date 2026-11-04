import {getJSON, nextId, setJSON} from '../src/core/storage/mmkv';

export const PRAYER_NAMES = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

const KEY = 'user_times';
const SEQ = 'user_times_seq';

const load = () => getJSON(KEY, []);

/**
 * Save a user alarm: "ring <hour>h <minute>m before each of <prayers>".
 * @param {number} hour
 * @param {number} minute
 * @param {string[]} prayers e.g. ['Fajr', 'Isha']
 * @returns {Promise<number>} new id
 */
export const addUserTime = async (hour, minute, prayers) => {
  const valid = prayers.filter(p => PRAYER_NAMES.includes(p));
  const id = nextId(SEQ);
  setJSON(KEY, [...load(), {id, hour, minute, prayers: valid}]);
  return id;
};

/** @returns {Promise<Array<{id:number,hour:number,minute:number,prayers:string[]}>>} */
export const getUserTimes = async () => load();

/** Delete a user alarm and its scheduled rows. */
export const deleteUserTime = async id => {
  setJSON(
    KEY,
    load().filter(u => u.id !== id),
  );
  const alarms = getJSON('alarms', []);
  setJSON(
    'alarms',
    alarms.filter(a => a.user_time_id !== id),
  );
};

export const deleteAllUserTimes = async () => {
  setJSON(KEY, []);
  setJSON('alarms', []);
};

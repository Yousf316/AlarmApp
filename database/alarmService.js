import {getJSON, nextId, setJSON} from '../src/core/storage/mmkv';

const KEY = 'alarms';
const SEQ = 'alarms_seq';

const load = () => getJSON(KEY, []);
const byTime = (a, b) => a.timestamp - b.timestamp;

/**
 * Store one scheduled OS alarm. The returned id is used as the Android
 * PendingIntent request code and the iOS notification id (`alarm-<id>`),
 * so scheduling and cancelling always use the same key.
 */
export const addAlarm = async (userTimeId, prayer, timestamp) => {
  const id = nextId(SEQ);
  setJSON(KEY, [...load(), {id, user_time_id: userTimeId, prayer, timestamp}]);
  return id;
};

export const getAlarms = async () => load().sort(byTime);

export const getAlarmsByUserTimeId = async id =>
  load()
    .filter(a => a.user_time_id === id)
    .sort(byTime);

export const deleteAlarm = async id => {
  setJSON(
    KEY,
    load().filter(a => a.id !== id),
  );
};

export const deleteAlarmByUserTime = async id => {
  setJSON(
    KEY,
    load().filter(a => a.user_time_id !== id),
  );
};

export const deleteAllAlarms = async () => {
  setJSON(KEY, []);
};

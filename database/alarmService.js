import {query, run} from './db';

/**
 * Store one scheduled OS alarm. The returned id is used as the Android
 * PendingIntent request code and the iOS notification id (`alarm-<id>`),
 * so scheduling and cancelling always use the same key.
 */
export const addAlarm = async (userTimeId, prayer, timestamp) => {
  const result = await run(
    'INSERT INTO alarms (user_time_id, prayer, timestamp) VALUES (?, ?, ?)',
    [userTimeId, prayer, timestamp],
  );
  return result.insertId;
};

export const getAlarms = () =>
  query('SELECT * FROM alarms ORDER BY timestamp');

export const getAlarmsByUserTimeId = id =>
  query('SELECT * FROM alarms WHERE user_time_id = ? ORDER BY timestamp', [id]);

export const deleteAlarm = id => run('DELETE FROM alarms WHERE id = ?', [id]);

export const deleteAlarmByUserTime = id =>
  run('DELETE FROM alarms WHERE user_time_id = ?', [id]);

export const deleteAllAlarms = () => run('DELETE FROM alarms');

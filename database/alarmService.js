import db from "./db";

// Add Alarm
export const addAlarm = (date, hour, minute, userTimeId) => {
    return new Promise((resolve, reject) => {
      db.transaction((tx) => {
        tx.executeSql(
          "INSERT INTO alarms (date, hour, minute, user_time_id) VALUES (?, ?, ?, ?)",
          [date, hour, minute, userTimeId],
          (_, result) => resolve(result.insertId),
          (_, error) => reject(error)
        );
      });
    });
  };
  
// Get All Alarms
export const getAlarms = () => {
    return new Promise((resolve, reject) => {
      db.transaction((tx) => {
        tx.executeSql(
          `SELECT alarms.*, user_times.hour AS userHour, user_times.minute AS userMinute 
           FROM alarms 
           LEFT JOIN user_times ON alarms.user_time_id = user_times.id`,
          [],
          (_, result) => resolve(result.rows.raw()),
          (_, error) => reject(error)
        );
      });
    });
  };
  
  export const getAlarmsByUserTimeId = (id) => {
    return new Promise((resolve, reject) => {
      db.transaction((tx) => {
        tx.executeSql(
          `SELECT alarms.*, user_times.hour AS userHour, user_times.minute AS userMinute 
           FROM alarms
           LEFT JOIN user_times ON alarms.user_time_id = user_times.id
           WHERE alarms.user_time_id = ?`,
          [id],
          (_, result) => resolve(result.rows.raw()),
          (_, error) => reject(error)
        );
      });
    });
  };
// Delete Alarm by ID
export const deleteAlarm = (id) => {
  return new Promise((resolve, reject) => {
    db.transaction((tx) => {
      tx.executeSql(
        "DELETE FROM alarms WHERE id = ?",
        [id],
        () => resolve(),
        (_, error) => reject(error)
      );
    });
  });
};

export const deleteAlarmByUserTime = (id) => {
    return new Promise((resolve, reject) => {
      db.transaction((tx) => {
        tx.executeSql(
          "DELETE FROM alarms WHERE user_time_id = ?",
          [id],
          () => resolve(),
          (_, error) => reject(error)
        );
      });
    });
  };
import SQLite from "react-native-sqlite-storage";

const db = SQLite.openDatabase({ name: "alarms.db", location: "default" });

export const initDB = () => {
  db.transaction((tx) => {
    tx.executeSql(
      "CREATE TABLE IF NOT EXISTS alarms (id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT, hour INTEGER, minute INTEGER)",
      []
    );
  });
};

export const addAlarm = (date, hour, minute, callback) => {
  db.transaction((tx) => {
    tx.executeSql(
      "INSERT INTO alarms (date, hour, minute) VALUES (?, ?, ?)",
      [date, hour, minute],
      (_, result) => callback(result.insertId)
    );
  });
};

export const getAlarms = (callback) => {
  db.transaction((tx) => {
    tx.executeSql(
      "SELECT * FROM alarms",
      [],
      (_, result) => callback(result.rows.raw())
    );
  });
};

export const deleteAlarm = (id, callback) => {
  db.transaction((tx) => {
    tx.executeSql("DELETE FROM alarms WHERE id = ?", [id], () => callback());
  });
};

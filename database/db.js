import SQLite from "react-native-sqlite-storage";

const db = SQLite.openDatabase({ name: "alarms.db", location: "default" });
export const deleteDB = () => {
  return new Promise((resolve, reject) => {
    SQLite.deleteDatabase(
      { name: "alarms.db", location: "default" },
      () => {
        console.log("✅ Database deleted successfully");
        resolve();
      },
      (error) => {
        console.error("❌ Error deleting database:", error);
        reject(error);
      }
    );
  });
};

export const showTables = () => {
  db.transaction((tx) => {
    tx.executeSql(
      "SELECT name FROM sqlite_master WHERE type='table'",
      [],
      (_, result) => {
        console.log("📂 Tables in database:", result.rows.raw());
      },
      (_, error) => {
        console.error("❌ Error fetching tables:", error);
      }
    );
  });
};


export const rebuildDB = async () => {
  try {
    await deleteDB();
    console.log("Database deleted successfully.");
    initDB();
    console.log("Database recreated successfully.");
  } catch (error) {
    console.error("Error rebuilding database:", error);
  }
};

export const initDB = () => {
  db.transaction((tx) => {
    // Create User Times Table (Primary Table)
    tx.executeSql(
      `CREATE TABLE IF NOT EXISTS user_times (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        hour INTEGER, 
        minute INTEGER
      )`,
      []
    );

    // Create Alarms Table with Foreign Key
    tx.executeSql(
      `CREATE TABLE IF NOT EXISTS alarms (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        date TEXT, 
        hour INTEGER, 
        minute INTEGER,
        user_time_id INTEGER,
        FOREIGN KEY (user_time_id) REFERENCES user_times(id) ON DELETE CASCADE
      )`,
      []
    );
  });
};

export default db;

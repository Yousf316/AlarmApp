import db from "./db";

// Add User Chosen Time
export const addUserTime = (hour, minute) => {
  return new Promise((resolve, reject) => {
    db.transaction((tx) => {
      tx.executeSql(
        "INSERT INTO user_times (hour, minute) VALUES (?, ?)",
        [hour, minute],
        (_, result) => resolve(result.insertId),
        (_, error) => reject(error)
      );
    });
  });
};

// Get All User Chosen Times
export const getUserTimes = () => {
  return new Promise((resolve, reject) => {
    db.transaction((tx) => {
      tx.executeSql(
        "SELECT * FROM user_times",
        [],
        (_, result) => {
          const rows = result.rows.raw(); // Convert result into an array
          console.log("📊 User Times:", rows);
          resolve(rows); // Resolve the promise with the fetched data
        },
        (_, error) => {
          console.error("❌ Error fetching user_times:", error);
          reject(error); // Reject the promise with the error
        }
      );
    });
  });
};

// Delete User Chosen Time by ID
export const deleteUserTime = (id) => {
  return new Promise((resolve, reject) => {
    db.transaction((tx) => {
      tx.executeSql(
        "DELETE FROM user_times WHERE id = ?",
        [id],
        () => resolve(),
        (_, error) => reject(error)
      );
    });
  });
};

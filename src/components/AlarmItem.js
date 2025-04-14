import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import TimeCalculate from "../librarys/TimeCalculate";

const AlarmItem = ({ item, onDelete }) => {
  console.log("AlarmItem:", item);
  const timeCalculate = new TimeCalculate();
  return (
    <View style={styles.alarmItem}>
      <Text style={styles.alarmText}>
        قبل الصلاة ب {item.hour}:{item.minute}
      </Text>
      <TouchableOpacity style={styles.deleteButton} onPress={() => onDelete(item.id)}>
        <Text style={styles.deleteButtonText}>حذف</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  alarmItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 15,
    backgroundColor: "#fff",
    borderRadius: 5,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  alarmText: {
    fontSize: 16,
    color: "#333",
  },
  deleteButton: {
    backgroundColor: "#dc3545",
    padding: 10,
    borderRadius: 5,
  },
  deleteButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "bold",
  },
});

export default AlarmItem;
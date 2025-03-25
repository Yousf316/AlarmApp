import React, { use, useEffect, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import { Checkbox } from "react-native-paper";

const AddAlarmModal = ({ isVisible, onClose, onAddAlarm }) => {
  const [hour, setHour] = useState("0");
  const [minute, setMinute] = useState("5");
  const [allDays, setallDays] = useState(false);
  const [selectedDays, setSelectedDays] = useState({
    "الفجر": false,
    "الظهر": false,
    "العصر": false,
    "المغرب": false,
    "العشاء": false,
  });

  useEffect(() => {
    Alldays(allDays);
  }, [allDays]);
  const handleAdd = () => {
    const parsedHour = parseInt(hour, 10);
    const parsedMinute = parseInt(minute, 10);

    if (
      isNaN(parsedHour) ||
      isNaN(parsedMinute) ||
      parsedHour < 0 ||
      parsedHour > 23 ||
      parsedMinute < 0 ||
      parsedMinute > 59
    ) {
      alert("يرجى إدخال وقت صحيح (0-23 ساعة و 0-59 دقيقة).");
      return;
    }

    onAddAlarm(
       parsedHour,
       parsedMinute,
    );

    onClose();
  };
  const Alldays = (value) => {
    setSelectedDays((prev) => {
      const newState = {};
      for (const day in prev) {
        newState[day] = value; 
      }
      return newState;
    });
  };

  const toggleDay = (day) => {
    setSelectedDays((prev) => ({
      ...prev,
      [day]: !prev[day],
    }));
  };

  if (!isVisible) return null;

  return (
    <View style={styles.modalContainer}>
      <View style={styles.modalContent}>
        <Text style={styles.modalTitle}>إضافة منبه جديد</Text>

        <Text style={styles.checkboxLabel}>الساعة</Text>
        <TextInput
          keyboardType="numeric"
          value={hour}
          onChangeText={setHour}
          placeholder="الساعة (0-23)"
          maxLength={2}
          style={styles.modalInput}
        />

        <Text style={styles.checkboxLabel}>الدقائق</Text>
        <TextInput
          keyboardType="numeric"
          value={minute}
          onChangeText={setMinute}
          placeholder="الدقيقة (0-59)"
          maxLength={2}
          style={styles.modalInput}
        />

        {/* خيار التكرار اليومي */}
        <View style={styles.checkboxContainer}>
          <Checkbox
            status={allDays ? "checked" : "unchecked"}
            onPress={() => setallDays(!allDays)}
            color="#007bff"
          />
          <Text style={styles.checkboxLabel}>جميع الصلوات</Text>
        </View>

        {/* أيام الأسبوع */}
        <Text style={styles.daysTitle}>اختيار الصلاة</Text>
        {Object.keys(selectedDays).map((day) => (
          <View key={day} style={styles.checkboxContainer}>
            <Checkbox
              status={selectedDays[day] ? "checked" : "unchecked"}
              onPress={() => toggleDay(day)}
              color="#007bff"
            />
            <Text style={styles.checkboxLabel}>{day}</Text>
          </View>
        ))}

        {/* أزرار الإضافة والإلغاء */}
        <View style={styles.modalButtons}>
          <TouchableOpacity
            style={[styles.modalButton, styles.cancelButton]}
            onPress={onClose}
          >
            <Text style={styles.modalButtonText}>إلغاء</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modalButton, styles.addButton]}
            onPress={handleAdd}
          >
            <Text style={styles.modalButtonText}>إضافة</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  },
  modalContent: {
    width: "80%",
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
  },
  modalInput: {
    borderBottomWidth: 1,
    borderColor: "#ccc",
    padding: 10,
    marginBottom: 20,
    fontSize: 16,
    textAlign: "center",
  },
  checkboxContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  checkboxLabel: {
    marginLeft: 8,
    fontSize: 16,
  },
  daysTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginTop: 10,
    marginBottom: 10,
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
  },
  modalButton: {
    flex: 1,
    padding: 10,
    borderRadius: 5,
    alignItems: "center",
    marginHorizontal: 5,
  },
  cancelButton: {
    backgroundColor: "#dc3545",
  },
  addButton: {
    backgroundColor: "#007bff",
  },
  modalButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
});

export default AddAlarmModal;

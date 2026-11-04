import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, TouchableWithoutFeedback, Keyboard, Platform, Alert } from "react-native";
import { Checkbox } from "react-native-paper";
import clsUtility from "../librarys/clsUtilty";

const AddAlarmModal = ({ isVisible, onClose, onAddAlarm }) => {
  const [hour, setHour] = useState("0");
  const [minute, setMinute] = useState("5");
  const [selectedPrayers, setSelectedPrayers] = useState({
    "Fajr": false,
    "Dhuhr": false,
    "Asr": false,
    "Maghrib": false,
    "Isha": false,
  });

  // "All prayers" is derived, so un-ticking one prayer also un-ticks "all"
  // instead of wiping every individual choice.
  const allDays = Object.values(selectedPrayers).every(Boolean);

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
      Alert.alert("خطأ", "يرجى إدخال وقت صحيح (0-23 ساعة و 0-59 دقيقة).");
      return;
    }
    if (parsedHour === 0 && parsedMinute === 0) {
      Alert.alert("خطأ", "يرجى إدخال مدة أكبر من صفر.");
      return;
    }

    const prayers = Object.keys(selectedPrayers).filter((p) => selectedPrayers[p]);
    if (prayers.length === 0) {
      Alert.alert("خطأ", "يرجى اختيار صلاة واحدة على الأقل.");
      return;
    }

    onAddAlarm(parsedHour, parsedMinute, prayers);

    onClose();
  };

  const setAll = (value) => {
    setSelectedPrayers((prev) => {
      const newState = {};
      for (const day in prev) {
        newState[day] = value;
      }
      return newState;
    });
  };

  const toggleDay = (day) => {
    setSelectedPrayers((prev) => ({
      ...prev,
      [day]: !prev[day],
    }));
  };

  if (!isVisible) return null;

  return (
    <View style={styles.modalContainer}>
      <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.modalContent}
    >
      <TouchableWithoutFeedback  onPress={Keyboard.dismiss}>
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
          <View style={styles.checkbox}>
          <Checkbox
          
            status={allDays ? "checked" : "unchecked"}
            onPress={() => setAll(!allDays)}
            color="#007bff"
            uncheckedColor="#000000ff" // border color
       
          />
          </View>
          <Text style={styles.checkboxLabel}>جميع الصلوات</Text>
        </View>

        {/* أيام الأسبوع */}
        <Text style={styles.daysTitle}>اختيار الصلاة</Text>
        {Object.keys(selectedPrayers).map((day) => (
          <View key={day} style={styles.checkboxContainer}>
            <View style={styles.checkbox}>
            <Checkbox
              status={selectedPrayers[day] ? "checked" : "unchecked"}
              onPress={() => toggleDay(day)}
              color="#007bff"

            />
            </View>
            <Text style={styles.checkboxLabel}>{clsUtility.GetNamePrayerAr(day)}</Text>
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
      </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
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
  checkbox:{
    borderRadius: 4,
    borderWidth: 2,
    borderColor: "#007AFF", // iOS blue
    backgroundColor: "transparent",
  }
});

export default AddAlarmModal;

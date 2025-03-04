import React, { useEffect, useState } from "react";
import { View, Text, FlatList, Button, Alert } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { initDB, getAlarms, addAlarm, deleteAlarm } from "../database/db";
import { NativeModules } from "react-native";
import PrayerScreen from "./PrayerScreen";

const { AlarmModule } = NativeModules;

export default function AlarmList() {
  const [alarms, setAlarms] = useState([]);
  const [showPicker, setShowPicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());

  useEffect(() => {
    initDB();
    fetchAlarms();
  }, []);

  const fetchAlarms = () => {
    getAlarms(setAlarms);
  };

  const handleAddAlarm = () => {
    setShowPicker(true);
  };

  const onDateChange = (event, date) => {
    setShowPicker(false);
    if (date) {
      const alarmDate = date.toISOString().split("T")[0]; // Extract YYYY-MM-DD
      const hour = date.getHours();
      const minute = date.getMinutes();

      addAlarm(alarmDate, hour, minute, (id) => {
        AlarmModule.setAlarm( id,hour, minute);
        fetchAlarms();
      });
    }
  };

  const handleDeleteAlarm = (id) => {
    Alert.alert("Delete Alarm", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        onPress: () => {
          AlarmModule.cancelAlarm(id);
          deleteAlarm(id, fetchAlarms);
        },
      },
    ]);
  };

  return (
    <View>
      <Button title="Add Alarm" onPress={handleAddAlarm} />
      {showPicker && (
        <DateTimePicker
          value={selectedDate}
          mode="time"
          is24Hour={true}
          display="default"
          onChange={onDateChange}
        />
      )}
      <FlatList
        data={alarms}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <View style={{ padding: 10, borderBottomWidth: 1 }}>
            <Text>Alarm on {item.date} at {item.hour}:{item.minute}</Text>
            <Button title="Delete" onPress={() => handleDeleteAlarm(item.id)} />
          </View>
        )}
      />

<PrayerScreen/>
    </View>
  );
}

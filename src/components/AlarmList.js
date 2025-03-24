import React, { useContext, useEffect, useState } from "react";
import { View, FlatList, TouchableOpacity, Text, StyleSheet, Alert } from "react-native";
import {  initDB,   } from "../../database/db";
import { PrayerContext } from "../context/PrayerContext";
import AddAlarmModal from "./AddAlarmModal";
import AlarmItem from "./AlarmItem";
import { addUserTime, getUserTimes } from "../../database/userTimeService";
import clsAlarm from "../librarys/clsAlaram";


export default function AlarmList() {
  const [alarms, setAlarms] = useState([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const { prayer } = useContext(PrayerContext);

  useEffect(() => {
    const initialize = async () => {
      await initDB();
      await fetchAlarms();
    };
    initialize();
  }, []);

  useEffect(() => {
    console.log("Alarms state updated:", alarms);

  }, [alarms]);

  const fetchAlarms = async () => {
    try {
      const alarms = await getUserTimes(); // Fetch latest data
      setAlarms(alarms); // Update state
      console.log("Alarms fetched:", alarms); // Debugging
    } catch (error) {
      console.error("❌ Error fetching alarms:", error);
      Alert.alert("Error", "Failed to fetch alarms. Please try again.");
    }
  };

  const handleAddAlarm = async (hour, minute) => {
    try {
      
      // Add user time to the database
      const id = await addUserTime(hour, minute);
      console.log("✅ User time saved successfully. ID:", id);
      await fetchAlarms();
      // Check if Fajr prayer time is defined
      if (!prayer?.Fajr) {
        console.warn("⚠️ Prayer time for Fajr is not defined.");
        Alert.alert("Error", "Fajr prayer time is not available.");
        return;
      }
  
      // Set the alarm
      await clsAlarm.setAlarm(id, prayer.Fajr, hour, minute, "Fajr");
      console.log(`⏰ Alarm set for Fajr at ${hour}:${minute} (Prayer Time: ${prayer.Fajr})`);
  
      // Refresh the list of alarms
     
    } catch (error) {
      console.error("❌ Error in handleAddAlarm:", error);
      Alert.alert("Error", "Failed to add alarm. Please check your input and try again.");
    }
  };
  const handleDeleteAlarm = async (id) => {
    Alert.alert("حذف المنبه", "هل أنت متأكد؟", [
      { text: "إلغاء", style: "cancel" },
      {
        text: "حذف",
        onPress: async () => {
          try {
            await clsAlarm.cancelAlarm(id);
            setAlarms((prevAlarms) => prevAlarms.filter((alarm) => alarm.id !== id));
          } catch (error) {
            console.error("❌ Error deleting alarm:", error);
            Alert.alert("Error", "Failed to delete alarm. Please try again.");
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => setIsModalVisible(true)}
      >
        <Text style={styles.addButtonText}>إضافة منبه</Text>
      </TouchableOpacity>

      <FlatList
      key={alarms.length}
        data={alarms}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <AlarmItem item={item} onDelete={handleDeleteAlarm} />
        )}
      />

      <AddAlarmModal
        isVisible={isModalVisible}
        onClose={() => setIsModalVisible(false)}
        onAddAlarm={handleAddAlarm}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#f5f5f5",
  },
  addButton: {
    backgroundColor: "#007bff",
    padding: 15,
    borderRadius: 5,
    alignItems: "center",
    marginBottom: 20,
  },
  addButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
});
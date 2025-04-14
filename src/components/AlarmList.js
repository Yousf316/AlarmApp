import React, { useContext, useEffect, useState } from "react";
import { View, FlatList, TouchableOpacity, Text, StyleSheet, Alert } from "react-native";
import {  initDB,   } from "../../database/db";
import { PrayerContext } from "../context/PrayerContext";
import AddAlarmModal from "./AddAlarmModal";
import AlarmItem from "./AlarmItem";
import { addUserTime, getUserTimes } from "../../database/userTimeService";
import clsAlarm from "../librarys/clsAlaram";
import clsUtility from "../librarys/clsUtilty";


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

  const handleAddAlarm = async (hour, minute, selectedPrayers) => {
    try {
      // 1. Validate prayer data
      if (!prayer || !Array.isArray(prayer)) {
        console.warn("Invalid prayer data");
        Alert.alert("Error", "Prayer times data is not available");
        return;
      }
      console.log("selectedPrayers prayers:", selectedPrayers);

      // 2. Validate and protect selectedPrayers
      if (!selectedPrayers || typeof selectedPrayers !== 'object') {
        console.warn("Invalid selectedPrayers - using empty fallback");
        selectedPrayers = {};
      }
  
      // 3. Create safe copy WITHOUT overriding user selections
      const prayersToProcess = {
        Fajr: !!selectedPrayers.Fajr,    // Convert to boolean
        Dhuhr: !!selectedPrayers.Dhuhr,
        Asr: !!selectedPrayers.Asr,
        Maghrib: !!selectedPrayers.Maghrib,
        Isha: !!selectedPrayers.Isha
      };
  
      console.log("Processing prayers:", prayersToProcess);
  
      // 4. Save user time
      const id = await addUserTime(hour, minute);
      console.log("✅ User time saved successfully. ID:", id);
  
      // 5. Process each prayer day
      for (const day of prayer) {
        try {
          if (!day?.timings || typeof day.timings !== 'object') {
            console.warn(`Skipping invalid day: ${day?.date}`);
            continue;
          }
  
          const { date, timings } = day;
  
          // 6. Process each prayer type
          for (const prayerName in prayersToProcess) {
            try {
              // Only process if selected
              if (!prayersToProcess[prayerName]) {
                console.log(`Skipping ${prayerName} - not selected`);
                continue;
              }
  
              const timeString = timings[prayerName];
              if (!timeString) {
                console.warn(`No time found for ${prayerName} on ${date}`);
                continue;
              }
  
              // Parse time
              const [time] = timeString.split(' ');
  
              const prayerAr = clsUtility.GetNamePrayerAr(prayerName)
  
              await clsAlarm.setAlarm(
               id,
                date,
                time,
                hour,
                minute,
                prayerAr
              );
  
              console.log(`✅ Set ${prayerName} alarm successfully`);
            } catch (prayerError) {
              console.warn(`Failed ${prayerName} alarm:`, prayerError.message);
             
            }
          }
        } catch (dayError) {
          console.warn(`Failed day ${day?.date}:`, dayError.message);
        }
      }
  
      // 7. Refresh and notify
      await fetchAlarms();
      Alert.alert("تمت العملية بنجاح", "تم ضبط المنبه");
  
    } catch (mainError) {
      console.warn("Main error:", mainError.message);
      Alert.alert("خطاء", "فشل في ضبط المنبه");
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
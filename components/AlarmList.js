import React, { useEffect, useState } from "react";
import { View, Text, FlatList, Button, Alert, TextInput } from "react-native";
import { initDB, getAlarms, addAlarm, deleteAlarm } from "../database/db";
import { NativeModules } from "react-native";
import PrayerScreen from "./PrayerScreen";

const { AlarmModule } = NativeModules;

export default function AlarmList() {
  const [alarms, setAlarms] = useState([]);
  const [hour, setHour] = useState("0"); 
  const [minute, setMinute] = useState("5"); 
  const [prayer, setprayer] = useState({}); 
  useEffect(() => {
    initDB();
    fetchAlarms();
  }, []);

  const fetchAlarms = () => {
    getAlarms(setAlarms);
  };

  const calculateAlarmTime = (prayerTime, hoursBefore, minutesBefore) => {
    // التأكد من أن prayerTime بصيغة "HH:MM" وتحويلها إلى كائن
    if (typeof prayerTime === "string") {
      const [hour, minute] = prayerTime.split(":").map((part) => parseInt(part, 10));
      prayerTime = { hour, minute }; 
    }
  
    if (!prayerTime || isNaN(prayerTime.hour) || isNaN(prayerTime.minute)) {
      Alert.alert("خطأ", "وقت الصلاة غير صحيح.");
      console.log("❌ خطأ: وقت الصلاة غير صالح:", prayerTime);
      return null;
    }
  
    let { hour, minute } = prayerTime; 
    let reduceHours = parseInt(hoursBefore, 10);
    let reduceMinutes = parseInt(minutesBefore, 10);
  
    if (isNaN(reduceHours) || isNaN(reduceMinutes)) {
      Alert.alert("خطأ", "يرجى إدخال أرقام صحيحة.");
      console.log("❌ خطأ: القيم المدخلة غير صحيحة", reduceHours, reduceMinutes);
      return null;
    }
  
    console.log("✅ وقت الصلاة:", hour, minute);
    
    let totalMinutes = hour * 60 + minute; // تحويل وقت الصلاة إلى دقائق
    let alarmMinutes = totalMinutes - (reduceHours * 60 + reduceMinutes); // طرح الوقت المسبق
  
    if (alarmMinutes < 0) {
      Alert.alert("خطأ", "لا يمكن ضبط المنبه قبل منتصف الليل.");
      console.log("❌ خطأ: وقت التنبيه سلبي:", alarmMinutes);
      return null;
    }
  
    let finalHour = Math.floor(alarmMinutes / 60);
    let finalMinute = alarmMinutes % 60;
  
    console.log("✅ وقت التنبيه النهائي:", finalHour, finalMinute);
  
    return { finalHour, finalMinute };
  };
  
  
  


  const handleAddAlarm = () => {
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
  
    console.log("🕒 المستخدم أدخل:", parsedHour, parsedMinute);
    console.log("🕋 وقت الصلاة المختار:", prayer?.Fajr);
  
    const alarmTime = calculateAlarmTime(prayer?.Fajr, parsedHour, parsedMinute);
  
    if (!alarmTime) {
      console.log("❌ فشل في حساب وقت المنبه.");
      return;
    }
  
    console.log("⏰ سيتم ضبط المنبه في:", alarmTime.finalHour, alarmTime.finalMinute);
  
    const today = new Date();
    const alarmDate = today.toISOString().split("T")[0];
  
    addAlarm(alarmDate, alarmTime.finalHour, alarmTime.finalMinute, (id) => {
      console.log("✅ حفظ المنبه بنجاح:", id);
      AlarmModule.setAlarm(id, alarmTime.finalHour, alarmTime.finalMinute);
      fetchAlarms();
    });
  
    setHour("");
    setMinute("");
  };
  
  

  const handleDeleteAlarm = (id) => {
    Alert.alert("حذف المنبه", "هل أنت متأكد؟", [
      { text: "إلغاء", style: "cancel" },
      {
        text: "حذف",
        onPress: () => {
          AlarmModule.cancelAlarm(id);
          deleteAlarm(id, fetchAlarms);
        },
      },
    ]);
  };

  return (
    <View style={{ padding: 20 }}>
      {/* إدخال الساعة والدقيقة يدوياً */}
      <Text>حدد وقت المنبه:</Text>
      <TextInput
        keyboardType="numeric"
        value={hour}
        onChangeText={setHour}
        placeholder="الساعة (0-23)"
        maxLength={2}
        style={{ borderBottomWidth: 1, marginBottom: 10, width: 80 }}
      />
      <TextInput
        keyboardType="numeric"
        value={minute}
        onChangeText={setMinute}
        placeholder="الدقيقة (0-59)"
        maxLength={2}
        style={{ borderBottomWidth: 1, marginBottom: 20, width: 80 }}
      />

      {/* زر لإضافة المنبه */}
      <Button title="إضافة منبه" onPress={handleAddAlarm} />

      {/* قائمة المنبهات */}
      <FlatList
        data={alarms}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <View style={{ padding: 10, borderBottomWidth: 1 }}>
            <Text>المنبه في {item.hour}:{item.minute}</Text>
            <Button title="حذف" onPress={() => handleDeleteAlarm(item.id)} />
          </View>
        )}
      />

      <PrayerScreen setprayer={setprayer} />
    </View>
  );
}

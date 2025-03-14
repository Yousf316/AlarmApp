import React, { useContext, useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, I18nManager } from 'react-native';
import { getPrayerTimesByCity } from '../../api/prayerTimes';
import PrayerTimeSelector from './PrayerTimeSelector';
import { PrayerContext } from "../context/PrayerContext"; // Import PrayerContext

I18nManager.forceRTL(true);

// تحويل الوقت إلى صيغة 12 ساعة
const convertTo12HourFormat = (time) => {
  if (!time) return 'Invalid Time';

  let [hours, minutes] = time.split(':').map(Number);
  let period = hours >= 12 ? 'PM' : 'AM';

  hours = hours % 12 || 12;

  return `${hours}:${minutes.toString().padStart(2, '0')} ${period}`;
};


const fetchPrayerTimes = async (city ="Jeddah" ,country="SA",setPrayerTimes,setLoading,setprayer) => {
    try {
     

      const timings = await getPrayerTimesByCity(city, country);
      //console.log("Prayer Times:", timings);

      if (timings) {
        setPrayerTimes(timings);
        setprayer(timings);
      }
    } catch (error) {
      console.error("Error fetching prayer times:", error);
    } finally {
      setLoading(false);
    }
  };

const PrayerScreen = () => {
  const [prayerTimes, setPrayerTimes] = useState(null);
  const [loading, setLoading] = useState(true);
  const [citynamear, setcitynamear] = useState("جدة");
  const { setprayer } = useContext(PrayerContext); // Access prayer from context


  const handleCitySelect = async (city, country,citynamear) => {
    console.log("Selected City:", city, country);
    setcitynamear(citynamear);
    await fetchPrayerTimes(city, country,setPrayerTimes,setLoading,setprayer);
  };
  
  useEffect(() => {
   

    fetchPrayerTimes("Jeddah","SA",setPrayerTimes,setLoading,setprayer);
  }, []);

  if (loading) {
    return <ActivityIndicator size="large" color="#0000ff" />;
  }

  if (!prayerTimes) {
    return <Text>حدث خطأ أثناء تحميل أوقات الصلاة.</Text>;
  }

  return (
    <View>
              <PrayerTimeSelector onSelect={handleCitySelect} />
              <View style={styles.prayerTimesContainer}>
          <Text style={styles.cityName}>أوقات الصلاة لمدينة {citynamear}:</Text>
          <View style={styles.prayerTimeRow}>
            <Text style={styles.prayerName}>الفجر:</Text>
            <Text style={styles.prayerTime}>
              {convertTo12HourFormat(prayerTimes?.Fajr)}
            </Text>
          </View>
          <View style={styles.prayerTimeRow}>
            <Text style={styles.prayerName}>الظهر:</Text>
            <Text style={styles.prayerTime}>
              {convertTo12HourFormat(prayerTimes?.Dhuhr)}
            </Text>
          </View>
          <View style={styles.prayerTimeRow}>
            <Text style={styles.prayerName}>العصر:</Text>
            <Text style={styles.prayerTime}>
              {convertTo12HourFormat(prayerTimes?.Asr)}
            </Text>
          </View>
          <View style={styles.prayerTimeRow}>
            <Text style={styles.prayerName}>المغرب:</Text>
            <Text style={styles.prayerTime}>
              {convertTo12HourFormat(prayerTimes?.Maghrib)}
            </Text>
          </View>
          <View style={styles.prayerTimeRow}>
            <Text style={styles.prayerName}>العشاء:</Text>
            <Text style={styles.prayerTime}>
              {convertTo12HourFormat(prayerTimes?.Isha)}
            </Text>
          </View>
        </View>
    </View>
  );
};


const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#f5f5f5",
  },
  prayerTimesContainer: {
    marginTop: 20,
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cityName: {
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 15,
    color: "#333",
  },
  prayerTimeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  prayerName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#007AFF",
  },
  prayerTime: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
});

export default PrayerScreen;

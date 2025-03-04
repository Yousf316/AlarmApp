import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { getPrayerTimesByCity } from '../api/prayerTimes';

// تحويل الوقت إلى صيغة 12 ساعة
const convertTo12HourFormat = (time) => {
  if (!time) return 'Invalid Time';

  let [hours, minutes] = time.split(':').map(Number);
  let period = hours >= 12 ? 'PM' : 'AM';

  hours = hours % 12 || 12;

  return `${hours}:${minutes.toString().padStart(2, '0')} ${period}`;
};

const PrayerScreen = () => {
  const [prayerTimes, setPrayerTimes] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPrayerTimes = async () => {
      try {
        const city = "Jeddah";
        const country = "SA";

        const timings = await getPrayerTimesByCity(city, country);
        console.log("Prayer Times:", timings);

        if (timings) {
          setPrayerTimes(timings);
        }
      } catch (error) {
        console.error("Error fetching prayer times:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPrayerTimes();
  }, []);

  if (loading) {
    return <ActivityIndicator size="large" color="#0000ff" />;
  }

  if (!prayerTimes) {
    return <Text>حدث خطأ أثناء تحميل أوقات الصلاة.</Text>;
  }

  return (
    <View>
      <Text>الفجر: {convertTo12HourFormat(prayerTimes?.Fajr)}</Text>
      <Text>الظهر: {convertTo12HourFormat(prayerTimes?.Dhuhr)}</Text>
      <Text>العصر: {convertTo12HourFormat(prayerTimes?.Asr)}</Text>
      <Text>المغرب: {convertTo12HourFormat(prayerTimes?.Maghrib)}</Text>
      <Text>العشاء: {convertTo12HourFormat(prayerTimes?.Isha)}</Text>
    </View>
  );
};

export default PrayerScreen;

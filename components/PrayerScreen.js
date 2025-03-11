import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { getPrayerTimesByCity } from '../api/prayerTimes';
import PrayerTimeSelector from './PrayerTimeSelector';

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

const PrayerScreen = ({setprayer}) => {
  const [prayerTimes, setPrayerTimes] = useState(null);
  const [loading, setLoading] = useState(true);


  const handleCitySelect = async (city, country) => {
    console.log("Selected City:", city, country);
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
        <Text>أوقات الصلاة لمدينة جدة:</Text>
      <Text>الفجر: {convertTo12HourFormat(prayerTimes?.Fajr)}</Text>
      <Text>الظهر: {convertTo12HourFormat(prayerTimes?.Dhuhr)}</Text>
      <Text>العصر: {convertTo12HourFormat(prayerTimes?.Asr)}</Text>
      <Text>المغرب: {convertTo12HourFormat(prayerTimes?.Maghrib)}</Text>
      <Text>العشاء: {convertTo12HourFormat(prayerTimes?.Isha)}</Text>
    </View>
  );
};

export default PrayerScreen;

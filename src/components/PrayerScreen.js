import React, { useContext, useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, I18nManager, Button } from 'react-native';
import { getPrayerTimesByCity, getPrayerTimesForNextDays } from '../../api/prayerTimes';
import PrayerTimeSelector from './PrayerTimeSelector';
import { PrayerContext } from "../context/PrayerContext"; // Import PrayerContext
import TimeCalculate from '../librarys/TimeCalculate';
import { SafeAreaView } from 'react-native-safe-area-context';

I18nManager.forceRTL(true);




const fetchPrayerTimes = async (city ="Jeddah" ,country="SA",setPrayerTimes,setLoading,setprayer) => {
    try {
     

      const timingsinfo = await getPrayerTimesForNextDays
      (city, country,15);
      console.log("Prayer Times:", timingsinfo);

      if (timingsinfo) {
        setPrayerTimes(timingsinfo);
        setprayer(timingsinfo);
      }else
      {
        setPrayerTimes(null)
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
  const [selectedCountry, setSelectedCountry] = useState("SA");
  const [selectedCity, setSelectedCity] = useState("Jeddah");
    const [selectedCityar, setSelectedCityar] = useState("جدة");
  
  const { setprayer } = useContext(PrayerContext); // Access prayer from context
  const timeCalculate = new TimeCalculate();

  const handleCitySelect = async (city, country) => {
    fetch('https://jsonplaceholder.typicode.com/todos/1')
  .then(res => res.json())
  .then(console.log)
  .catch(console.error);

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
    return( 
    <View style={styles.container}>
       <Text style={styles.cityName}>حدث خطأ أثناء تحميل أوقات الصلاة. تاكد من الاتصال بالشبكة</Text>
          <Button title="اعادة المحاولة" onPress={()=>{
            setLoading(true);
handleCitySelect(selectedCity,selectedCountry);
          }
          
          } />
     </View>);
  }

  return (
    <SafeAreaView style={{ flex: 1 }}>
    <View  >
              <PrayerTimeSelector onSelect={handleCitySelect} 
              selectedCountry={selectedCountry} 
              setSelectedCountry={setSelectedCountry}
               selectedCity={selectedCity}
               setSelectedCity={setSelectedCity}
               selectedCityar={selectedCityar}
               setSelectedCityar={setSelectedCityar}/>
             <View style={styles.container}> 
 <View style={styles.prayerTimesContainer}>
  <Text style={styles.cityName}>
    {`أوقات الصلاة لمدينة ${selectedCityar || ""}:`}
  </Text>

  <View style={styles.prayerTimeRow}>
    <Text style={styles.prayerName}>الفجر:</Text>
    <Text style={styles.prayerTime}>
      {timeCalculate.convertTo12HourFormat(prayerTimes?.[0]?.timings?.Fajr) || ''}
    </Text>
  </View>
  <View style={styles.prayerTimeRow}>
    <Text style={styles.prayerName}>الظهر:</Text>
    <Text style={styles.prayerTime}>
      {timeCalculate.convertTo12HourFormat(prayerTimes?.[0]?.timings?.Dhuhr) || ''}
    </Text>
  </View>
  <View style={styles.prayerTimeRow}>
    <Text style={styles.prayerName}>العصر:</Text>
    <Text style={styles.prayerTime}>
      {timeCalculate.convertTo12HourFormat(prayerTimes?.[0]?.timings?.Asr) || ''}
    </Text>
  </View>
  <View style={styles.prayerTimeRow}>
    <Text style={styles.prayerName}>المغرب:</Text>
    <Text style={styles.prayerTime}>
      {timeCalculate.convertTo12HourFormat(prayerTimes?.[0]?.timings?.Maghrib) || ''}
    </Text>
  </View>
  <View style={styles.prayerTimeRow}>
    <Text style={styles.prayerName}>العشاء:</Text>
    <Text style={styles.prayerTime}>
      {timeCalculate.convertTo12HourFormat(prayerTimes?.[0]?.timings?.Isha) || ''}
    </Text>
  </View>
</View>

        </View>
    </View>
    </SafeAreaView>
  );
};


const styles = StyleSheet.create({
  container: {
    
    alignItems: "center",
    padding: 20,
    backgroundColor: "#f5f5f5",
  },
  prayerTimesContainer: {
    
    width:"95%",
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

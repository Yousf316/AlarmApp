import React, {useCallback, useContext, useEffect, useState} from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  I18nManager,
  Button,
  Alert,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import PrayerTimeSelector, {getCityLabel} from './PrayerTimeSelector';
import {PrayerContext} from '../context/PrayerContext';
import {convertTo12HourFormat} from '../librarys/TimeCalculate';
import {loadPrayerTimes} from '../librarys/prayerData';
import clsAlarm from '../librarys/clsAlaram';
import clsUtility from '../librarys/clsUtilty';
import {initDB} from '../../database/db';
import {getLocation, setLocation} from '../../database/settingsService';

I18nManager.forceRTL(true);

const PRAYER_ROWS = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

const PrayerScreen = () => {
  const [prayerTimes, setPrayerTimes] = useState(null);
  const [fromCache, setFromCache] = useState(false);
  const [loading, setLoading] = useState(true);
  const [location, setLocationState] = useState(null);
  const {setprayer} = useContext(PrayerContext);

  const load = useCallback(
    async (loc, {force = false} = {}) => {
      setLoading(true);
      try {
        const data = await loadPrayerTimes(loc, {force});
        setPrayerTimes(data?.days ?? null);
        setFromCache(!!data?.fromCache);
        if (data) {
          setprayer(data.days);
        }
      } finally {
        setLoading(false);
      }
    },
    [setprayer],
  );

  // Restore the saved city on startup.
  useEffect(() => {
    (async () => {
      await initDB();
      const saved = await getLocation();
      setLocationState(saved);
      await load(saved);
    })().catch(e => {
      console.warn('Failed to load location:', e);
      setLoading(false);
    });
  }, [load]);

  const handleCitySelect = async (city, country) => {
    const next = {city, country};
    setLocationState(next);
    await setLocation(city, country);
    await load(next, {force: true});
    // Existing alarms must follow the new city's prayer times.
    const result = await clsAlarm.rescheduleAll({force: true});
    if (!result.ok) {
      Alert.alert('تنبيه', 'تعذر تحديث المنبهات للمدينة الجديدة. تأكد من الاتصال بالشبكة.');
    }
  };

  if (!location || (loading && !prayerTimes)) {
    return <ActivityIndicator style={styles.loader} size="large" color="#007AFF" />;
  }

  const today = prayerTimes?.[0]?.timings;

  return (
    <SafeAreaView style={styles.flex}>
      <PrayerTimeSelector
        selectedCountry={location.country}
        selectedCity={location.city}
        onSelect={handleCitySelect}
      />
      <View style={styles.container}>
        {!prayerTimes ? (
          <>
            <Text style={styles.cityName}>
              حدث خطأ أثناء تحميل أوقات الصلاة. تأكد من الاتصال بالشبكة
            </Text>
            <Button title="إعادة المحاولة" onPress={() => load(location, {force: true})} />
          </>
        ) : (
          <View style={styles.prayerTimesContainer}>
            <Text style={styles.cityName}>
              {`أوقات الصلاة لمدينة ${getCityLabel(location.country, location.city)}:`}
            </Text>
            {fromCache && (
              <Text style={styles.cacheNote}>(بيانات محفوظة – لا يوجد اتصال)</Text>
            )}
            {PRAYER_ROWS.map(prayer => (
              <View key={prayer} style={styles.prayerTimeRow}>
                <Text style={styles.prayerName}>{clsUtility.GetNamePrayerAr(prayer)}:</Text>
                <Text style={styles.prayerTime}>{convertTo12HourFormat(today?.[prayer])}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  flex: {flex: 1},
  loader: {flex: 1},
  container: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  prayerTimesContainer: {
    width: '95%',
    marginTop: 20,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cityName: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 15,
    color: '#333',
  },
  cacheNote: {
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
    marginBottom: 10,
  },
  prayerTimeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  prayerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  prayerTime: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
});

export default PrayerScreen;

import React, {useCallback, useState} from 'react';
import {View, FlatList, TouchableOpacity, Text, StyleSheet, Alert, Platform} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useFocusEffect} from '@react-navigation/native';
import {initDB} from '../../database/db';
import {addUserTime, getUserTimes} from '../../database/userTimeService';
import AddAlarmModal from './AddAlarmModal';
import AlarmItem from './AlarmItem';
import CoverageBanner from './CoverageBanner';
import clsAlarm from '../librarys/clsAlaram';
import {scheduleStore} from '../core/alarms/scheduleStore';
import {requestPermission, scheduleTestAlarm} from '../core/alarms/prayerAlarmNative';

export default function AlarmList() {
  const [alarms, setAlarms] = useState([]);
  const [coverage, setCoverage] = useState(() => scheduleStore.loadStatus());
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  const fetchAlarms = useCallback(async () => {
    try {
      await initDB();
      setAlarms(await getUserTimes());
      setCoverage(scheduleStore.loadStatus());
    } catch (error) {
      console.error('❌ Error fetching alarms:', error);
      Alert.alert('خطأ', 'تعذر تحميل المنبهات.');
    }
  }, []);

  // Refresh whenever the tab gets focus.
  useFocusEffect(
    useCallback(() => {
      fetchAlarms();
    }, [fetchAlarms]),
  );

  const handleAddAlarm = async (hour, minute, prayers) => {
    setBusy(true);
    try {
      await initDB();
      await addUserTime(hour, minute, prayers);
      const result = await clsAlarm.rescheduleAll();
      await fetchAlarms();
      if (result.ok) {
        Alert.alert('تمت العملية بنجاح', 'تم ضبط المنبه');
      } else {
        Alert.alert(
          'تم الحفظ',
          'تم حفظ المنبه لكن تعذر تحميل أوقات الصلاة. سيتم ضبطه تلقائياً عند توفر الاتصال.',
        );
      }
    } catch (error) {
      console.warn('Add alarm failed:', error);
      Alert.alert('خطأ', 'فشل في ضبط المنبه');
    } finally {
      setBusy(false);
    }
  };

  // TEMPORARY (moves to the settings screen in the UI phase): lets a real device
  // verify Snooze/Stop with the app closed.
  const handleTestAlarm = async () => {
    try {
      const permission = await requestPermission();
      if (permission && !['authorized', 'provisional'].includes(permission.status)) {
        Alert.alert('الإشعارات معطّلة', 'فعّل الإشعارات للتطبيق من إعدادات iOS.');
        return;
      }
      await scheduleTestAlarm(10);
      Alert.alert('تم', 'سيرن المنبه التجريبي بعد 10 ثوانٍ. أغلق التطبيق تماماً لاختبار الغفوة.');
    } catch (error) {
      Alert.alert('خطأ', String(error?.message ?? error));
    }
  };

  const handleDeleteAlarm = id => {
    Alert.alert('حذف المنبه', 'هل أنت متأكد؟', [
      {text: 'إلغاء', style: 'cancel'},
      {
        text: 'حذف',
        style: 'destructive',
        onPress: async () => {
          try {
            await clsAlarm.cancelAlarm(id);
            setAlarms(prev => prev.filter(alarm => alarm.id !== id));
            setCoverage(scheduleStore.loadStatus());
          } catch (error) {
            console.error('❌ Error deleting alarm:', error);
            Alert.alert('خطأ', 'تعذر حذف المنبه، حاول مرة أخرى.');
          }
        },
      },
    ]);
  };

  const handleDeleteAll = () => {
    Alert.alert('حذف جميع المنبهات', 'سيتم إلغاء وحذف جميع المنبهات. هل أنت متأكد؟', [
      {text: 'إلغاء', style: 'cancel'},
      {
        text: 'حذف الكل',
        style: 'destructive',
        onPress: async () => {
          try {
            await clsAlarm.cancelAll();
            setAlarms([]);
            setCoverage(null);
          } catch (error) {
            console.error('❌ Error deleting all alarms:', error);
            Alert.alert('خطأ', 'تعذر حذف المنبهات.');
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.flex}>
      <View style={styles.container}>
        <TouchableOpacity
          style={[styles.addButton, busy && styles.disabled]}
          disabled={busy}
          onPress={() => setIsModalVisible(true)}>
          <Text style={styles.addButtonText}>{busy ? 'جاري الضبط...' : 'إضافة منبه'}</Text>
        </TouchableOpacity>

        {Platform.OS === 'ios' && (
          <TouchableOpacity style={styles.testButton} onPress={handleTestAlarm}>
            <Text style={styles.testButtonText}>منبه تجريبي بعد 10 ثوانٍ</Text>
          </TouchableOpacity>
        )}

        {alarms.length > 0 && <CoverageBanner status={coverage} />}

        {alarms.length > 0 && (
          <TouchableOpacity style={styles.clearButton} onPress={handleDeleteAll}>
            <Text style={styles.clearButtonText}>إلغاء جميع التنبيهات</Text>
          </TouchableOpacity>
        )}

        <FlatList
          data={alarms}
          keyExtractor={item => item.id.toString()}
          renderItem={({item}) => <AlarmItem item={item} onDelete={handleDeleteAlarm} />}
          ListEmptyComponent={<Text style={styles.empty}>لا توجد منبهات بعد</Text>}
        />

        <AddAlarmModal
          isVisible={isModalVisible}
          onClose={() => setIsModalVisible(false)}
          onAddAlarm={handleAddAlarm}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {flex: 1},
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  addButton: {
    backgroundColor: '#007bff',
    padding: 15,
    borderRadius: 5,
    alignItems: 'center',
    marginBottom: 10,
  },
  disabled: {opacity: 0.6},
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  testButton: {
    padding: 10,
    alignItems: 'center',
    marginBottom: 6,
  },
  testButtonText: {
    color: '#007bff',
    fontSize: 15,
  },
  clearButton: {
    padding: 10,
    alignItems: 'center',
    marginBottom: 10,
  },
  clearButtonText: {
    color: '#dc3545',
    fontSize: 15,
  },
  empty: {
    textAlign: 'center',
    color: '#888',
    marginTop: 40,
  },
});

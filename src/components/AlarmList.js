import React, {useCallback, useState} from 'react';
import {View, FlatList, TouchableOpacity, Text, StyleSheet, Alert} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useFocusEffect} from '@react-navigation/native';
import {initDB} from '../../database/db';
import {addUserTime, getUserTimes} from '../../database/userTimeService';
import AddAlarmModal from './AddAlarmModal';
import AlarmItem from './AlarmItem';
import clsAlarm from '../librarys/clsAlaram';

export default function AlarmList() {
  const [alarms, setAlarms] = useState([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  const fetchAlarms = useCallback(async () => {
    try {
      await initDB();
      setAlarms(await getUserTimes());
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
      const result = await clsAlarm.rescheduleAll({force: true});
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

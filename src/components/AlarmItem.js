import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import {formatDuration} from '../librarys/TimeCalculate';
import clsUtility from '../librarys/clsUtilty';

const AlarmItem = ({item, onDelete}) => {
  const prayers = item.prayers?.length
    ? item.prayers.map(clsUtility.GetNamePrayerAr).join('، ')
    : 'منبه قديم – احذفه وأعد إضافته';

  return (
    <View style={styles.alarmItem}>
      <View style={styles.info}>
        <Text style={styles.alarmText}>
          قبل الصلاة بـ {formatDuration(item.hour, item.minute)}
        </Text>
        <Text style={styles.prayersText}>{prayers}</Text>
      </View>
      <TouchableOpacity style={styles.deleteButton} onPress={() => onDelete(item.id)}>
        <Text style={styles.deleteButtonText}>حذف</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  alarmItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#fff',
    borderRadius: 5,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  info: {flex: 1},
  alarmText: {
    fontSize: 16,
    color: '#333',
  },
  prayersText: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
  },
  deleteButton: {
    backgroundColor: '#dc3545',
    padding: 10,
    borderRadius: 5,
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
});

export default AlarmItem;

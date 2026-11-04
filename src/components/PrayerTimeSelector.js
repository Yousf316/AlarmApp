import React from 'react';
import {View, Text, StyleSheet, Platform} from 'react-native';
import {Picker} from '@react-native-picker/picker';

// Values are ISO 3166 country codes (accepted by the Aladhan API).
export const countries = [
  {label: 'السعودية', value: 'SA'},
  {label: 'مصر', value: 'EG'},
  {label: 'الإمارات', value: 'AE'},
];

export const citiesByCountry = {
  SA: [
    {label: 'جدة', value: 'Jeddah'},
    {label: 'الرياض', value: 'Riyadh'},
    {label: 'مكة', value: 'Mecca'},
  ],
  EG: [
    {label: 'القاهرة', value: 'Cairo'},
    {label: 'الإسكندرية', value: 'Alexandria'},
  ],
  AE: [
    {label: 'دبي', value: 'Dubai'},
    {label: 'أبو ظبي', value: 'Abu Dhabi'},
  ],
};

export const getCityLabel = (country, city) =>
  citiesByCountry[country]?.find(c => c.value === city)?.label ?? city;

/**
 * Controlled country/city picker. Calls onSelect(city, country) only when the
 * user picks a real city (placeholder "null" entries are ignored).
 */
const PrayerTimeSelector = ({selectedCountry, selectedCity, onSelect}) => {
  const pickerHeight = Platform.OS === 'ios' ? 150 : 60;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>اختر الدولة:</Text>
      <View style={[styles.pickerWrapper, {height: pickerHeight}]}>
        <Picker
          selectedValue={selectedCountry}
          onValueChange={country => {
            const firstCity = citiesByCountry[country]?.[0]?.value;
            if (country && firstCity && country !== selectedCountry) {
              onSelect(firstCity, country);
            }
          }}>
          {countries.map(country => (
            <Picker.Item key={country.value} label={country.label} value={country.value} />
          ))}
        </Picker>
      </View>

      <Text style={styles.label}>اختر المدينة:</Text>
      <View style={[styles.pickerWrapper, {height: pickerHeight}]}>
        <Picker
          selectedValue={selectedCity}
          onValueChange={city => {
            if (city && city !== selectedCity) {
              onSelect(city, selectedCountry);
            }
          }}>
          {citiesByCountry[selectedCountry]?.map(city => (
            <Picker.Item key={city.value} label={city.label} value={city.value} />
          ))}
        </Picker>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 5,
    textAlign: 'right',
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: '#007AFF',
    borderRadius: 5,
    marginBottom: 10,
    justifyContent: 'center',
    overflow: 'hidden',
  },
});

export default PrayerTimeSelector;

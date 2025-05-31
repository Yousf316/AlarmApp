import React, { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Picker } from "@react-native-picker/picker";

const countries = [
  { label: "السعودية", value: "SA" },
  { label: "مصر", value: "Egypt" },
  { label: "الإمارات", value: "UAE" },
];

const citiesByCountry = {
  SA: [
    { label: "جدة", value: "Jeddah" },
    { label: "الرياض", value: "Riyadh" },
    { label: "مكة", value: "Mecca" },
  ],
  Egypt: [
    { label: "القاهرة", value: "Cairo" },
    { label: "الإسكندرية", value: "Alexandria" },
  ],
  UAE: [
    { label: "دبي", value: "Dubai" },
    { label: "أبو ظبي", value: "Abu Dhabi" },
  ],
};

const PrayerTimeSelector = ({
  onSelect,
  selectedCountry,
  setSelectedCountry,
  selectedCity,
  setSelectedCity,
  selectedCityar,
  setSelectedCityar,
}) => {
  useEffect(() => {
    if (selectedCountry && selectedCity) {
      onSelect(selectedCity, selectedCountry);
    }
  }, [selectedCity, selectedCountry]);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>اختر الدولة:</Text>
      <Picker
        selectedValue={selectedCountry}
        onValueChange={(value) => {
          setSelectedCountry(value);
          const firstCity = citiesByCountry[value]?.[0]?.value || null;
          setSelectedCity(firstCity);
          if (firstCity) {
            setSelectedCityar(citiesByCountry[value][0].label);
          } else {
            setSelectedCityar(null);
          }
        }}
        style={pickerStyles}
      >
        <Picker.Item label="اختر الدولة..." value={null} />
        {countries.map((country) => (
          <Picker.Item key={country.value} label={country.label} value={country.value} />
        ))}
      </Picker>

      {selectedCountry && (
        <>
          <Text style={styles.label}>اختر المدينة:</Text>
          <Picker
            selectedValue={selectedCity}
            onValueChange={(value) => {
              setSelectedCity(value);
              if (value != null) {
                setSelectedCityar(
                  citiesByCountry[selectedCountry].find((city) => city.value === value).label
                );
              }
            }}
            style={pickerStyles}
          >
            <Picker.Item label="اختر المدينة..." value={null} />
            {citiesByCountry[selectedCountry]?.map((city) => (
              <Picker.Item key={city.value} label={city.label} value={city.value} />
            ))}
          </Picker>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 5,
    textAlign: "right",
  },
});

const pickerStyles = {
  height: 60,
  borderWidth: 1,
  borderColor: "#007AFF",
  borderRadius: 5,
  marginBottom: 10,
  color: "#333",
};

export default PrayerTimeSelector;

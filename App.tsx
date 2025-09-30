// App.js
import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import BottomTabNavigator from "./src/navigation/BottomTabNavigator";
import { PrayerProvider } from "./src/context/PrayerContext"; // Import PrayerProvider
import { Provider as PaperProvider } from "react-native-paper";

const App = () => {
  return (
    <PaperProvider>
    <PrayerProvider>
      <NavigationContainer>
        <BottomTabNavigator />
      </NavigationContainer>
    </PrayerProvider>
    </PaperProvider>
  );
};

export default App;
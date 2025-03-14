// App.js
import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import BottomTabNavigator from "./src/navigation/BottomTabNavigator";
import { PrayerProvider } from "./src/context/PrayerContext"; // Import PrayerProvider

const App = () => {
  return (
    <PrayerProvider>
      <NavigationContainer>
        <BottomTabNavigator />
      </NavigationContainer>
    </PrayerProvider>
  );
};

export default App;
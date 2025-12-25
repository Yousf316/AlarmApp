import React, { useEffect } from "react";
import { NavigationContainer } from "@react-navigation/native";
import BottomTabNavigator from "./src/navigation/BottomTabNavigator";
import { PrayerProvider } from "./src/context/PrayerContext";
import { Provider as PaperProvider } from "react-native-paper";
import { requestNotificationPermission,setupNotificationCategories } from "./src/librarys/NotificationManager";

const App = () => {
  useEffect(() => {
    requestNotificationPermission();
    setupNotificationCategories();
  }, []);

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

import React, {useEffect} from 'react';
import {AppState} from 'react-native';
import {NavigationContainer} from '@react-navigation/native';
import {Provider as PaperProvider} from 'react-native-paper';
import BottomTabNavigator from './src/navigation/BottomTabNavigator';
import {PrayerProvider} from './src/context/PrayerContext';
import {requestNotificationPermission} from './src/librarys/NotificationManager';
import {initDB} from './database/db';
import clsAlarm from './src/librarys/clsAlaram';

const App = () => {
  useEffect(() => {
    const bootstrap = async () => {
      try {
        await requestNotificationPermission();
        const {migratedFromLegacy} = await initDB();
        if (migratedFromLegacy) {
          await clsAlarm.clearLegacyScheduled();
        }
        // Keep the registered alarms in line with the timetable (rolling window,
        // iOS 64-notification limit); only what changed is touched.
        await clsAlarm.rescheduleAll();
      } catch (e) {
        console.warn('Bootstrap failed:', e);
      }
    };
    bootstrap();

    const appStateSub = AppState.addEventListener('change', state => {
      if (state === 'active') {
        initDB()
          .then(() => clsAlarm.rescheduleAll())
          .catch(e => console.warn('Reschedule failed:', e));
      }
    });

    return () => {
      appStateSub.remove();
    };
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

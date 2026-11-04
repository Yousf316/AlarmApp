import React, {useEffect} from 'react';
import {AppState} from 'react-native';
import notifee from './src/librarys/notifeeGuard';
import {NavigationContainer} from '@react-navigation/native';
import {Provider as PaperProvider} from 'react-native-paper';
import BottomTabNavigator from './src/navigation/BottomTabNavigator';
import {PrayerProvider} from './src/context/PrayerContext';
import {
  handleNotificationEvent,
  requestNotificationPermission,
  setupNotificationCategories,
} from './src/librarys/NotificationManager';
import {initDB} from './database/db';
import clsAlarm from './src/librarys/clsAlaram';

const App = () => {
  useEffect(() => {
    const bootstrap = async () => {
      try {
        await requestNotificationPermission();
        await setupNotificationCategories();
        const {migratedFromLegacy} = await initDB();
        if (migratedFromLegacy) {
          await clsAlarm.clearLegacyScheduled();
        }
        // Renew the rolling window of scheduled alarms (iOS 64 limit, 20 days).
        await clsAlarm.rescheduleAll({force: migratedFromLegacy});
      } catch (e) {
        console.warn('Bootstrap failed:', e);
      }
    };
    bootstrap();

    const unsubscribeNotifee = notifee.onForegroundEvent(handleNotificationEvent);
    const appStateSub = AppState.addEventListener('change', state => {
      if (state === 'active') {
        initDB()
          .then(() => clsAlarm.rescheduleAll({force: false}))
          .catch(e => console.warn('Reschedule failed:', e));
      }
    });

    return () => {
      unsubscribeNotifee();
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

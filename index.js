/**
 * @format
 */

import {AppRegistry} from 'react-native';
import notifee from './src/librarys/notifeeGuard';
import App from './App';
import {name as appName} from './app.json';
import {handleNotificationEvent} from './src/librarys/NotificationManager';

// Must be registered at module scope so iOS action buttons (Stop / Snooze)
// work while the app is in the background or killed.
notifee.onBackgroundEvent(handleNotificationEvent);

AppRegistry.registerComponent(appName, () => App);

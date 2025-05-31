/**
 * @format
 */

import {AppRegistry} from 'react-native';
import App from './App';
import {name as appName} from './app.json';
// Patch console.log to always print, even in release mode
if (!__DEV__) {
  const originalConsoleLog = console.log;
  console.log = (...args) => {
    originalConsoleLog(...args);
    // optionally, you could also send logs to a remote server here
  };
}
AppRegistry.registerComponent(appName, () => App);

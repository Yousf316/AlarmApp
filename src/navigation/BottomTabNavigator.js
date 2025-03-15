// src/navigation/BottomTabNavigator.js
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import HomeScreen from '../screens/HomeScreen';
import SettingsScreen from '../screens/SettingsScreen';
import Ionicons from 'react-native-vector-icons/Ionicons'; // Import Ionicons

const Tab = createBottomTabNavigator();

const BottomTabNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          }else if (route.name === 'Settings') {
            iconName = focused ? 'settings' : 'settings-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: 'tomato', // Active tab color
        tabBarInactiveTintColor: 'gray', // Inactive tab color
      })}
    >
      <Tab.Screen name="الوقت" component={SettingsScreen} />
      <Tab.Screen name="المنبه"  component={HomeScreen} />
    </Tab.Navigator>
  );
};

export default BottomTabNavigator;
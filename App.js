import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { Text } from 'react-native';
import SpeedTestScreen from './src/screens/SpeedTestScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import GraphScreen from './src/screens/GraphScreen';

const Tab = createBottomTabNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="light" />
      <Tab.Navigator
        screenOptions={{
          tabBarStyle: {
            backgroundColor: '#667eea',
          },
          tabBarActiveTintColor: '#fff',
          tabBarInactiveTintColor: 'rgba(255, 255, 255, 0.5)',
          headerStyle: {
            backgroundColor: '#667eea',
          },
          headerTintColor: '#fff',
        }}
      >
        <Tab.Screen 
          name="Speed Test" 
          component={SpeedTestScreen}
          options={{
            tabBarLabel: 'Speed Test',
            tabBarIcon: ({ color, size }) => (
              <Text style={{ color, fontSize: size }}>⚡</Text>
            ),
          }}
        />
        <Tab.Screen 
          name="History" 
          component={HistoryScreen}
          options={{
            tabBarLabel: 'History',
            tabBarIcon: ({ color, size }) => (
              <Text style={{ color, fontSize: size }}>📋</Text>
            ),
          }}
        />
        <Tab.Screen 
          name="Graphs" 
          component={GraphScreen}
          options={{
            tabBarLabel: 'Graphs',
            tabBarIcon: ({ color, size }) => (
              <Text style={{ color, fontSize: size }}>📊</Text>
            ),
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

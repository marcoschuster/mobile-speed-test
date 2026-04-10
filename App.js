import React, { useRef, useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { View, Text, Animated, StyleSheet, Platform, TouchableOpacity, SafeAreaView } from 'react-native';
import Svg, { Path, Polygon } from 'react-native-svg';
import SpeedHomeScreen from './src/screens/SpeedHomeScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import GraphScreen from './src/screens/GraphScreen';
import AppSettingsScreen from './src/screens/AppSettingsScreen';
import FlashTitle from './src/components/FlashTitle';
import { COLORS, ThemeProvider, useTheme, RADIUS } from './src/utils/theme';
import SoundEngine from './src/services/SoundEngine';
import { AppSettingsProvider } from './src/context/AppSettingsContext';

// Tab Navigator setup
const Tab = createBottomTabNavigator();

// Tab configuration data
const TABS = [
  { key: 'Speed Test', label: 'Speed', iconType: 'speed', component: SpeedHomeScreen },
  { key: 'History', label: 'History', iconType: 'history', component: HistoryScreen },
  { key: 'Graphs', label: 'Graphs', iconType: 'graph', component: GraphScreen },
  { key: 'Settings', label: 'Settings', iconType: 'settings', component: AppSettingsScreen },
];

// Floating Pill Navigation Component
const FloatingPillNav = ({ state, navigation, t, isDark }) => {
  const [activeIndex, setActiveIndex] = useState(state.index);
  
  useEffect(() => {
    setActiveIndex(state.index);
  }, [state.index]);

  const handleTabPress = (index, routeName) => {
    SoundEngine.playNavTick();
    navigation.navigate(routeName);
  };

  return (
    <View style={[pillStyles.container, { backgroundColor: t.navBar }]}>
      <View style={[pillStyles.pill, { 
        backgroundColor: isDark ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.95)',
        borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
      }]}>
        {TABS.map((tab, index) => (
          <TouchableOpacity
            key={tab.key}
            style={[
              pillStyles.tabItem,
              activeIndex === index && pillStyles.tabItemActive
            ]}
            onPress={() => handleTabPress(index, tab.key)}
            activeOpacity={0.7}
          >
            <TabIcon 
              focused={activeIndex === index} 
              iconType={tab.iconType} 
              color={activeIndex === index ? COLORS.accent : t.navInactive} 
            />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

// ── Lightning Bolt SVG Logo ─────────────────────────────────────────────────
const LightningLogo = ({ size = 22 }) => (
  <Svg width={size} height={size * 1.4} viewBox="0 0 24 34">
    <Polygon
      points="14,0 4,18 12,18 10,34 20,14 12,14"
      fill={COLORS.accent}
    />
  </Svg>
);

// ── Tab Bar Icon with scale animation ───────────────────────────────────────
const TabIcon = ({ focused, iconType, color }) => {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (focused) {
      Animated.sequence([
        Animated.spring(scale, {
          toValue: 1.15,
          tension: 300,
          friction: 10,
          useNativeDriver: false,
        }),
        Animated.spring(scale, {
          toValue: 1.0,
          tension: 200,
          friction: 12,
          useNativeDriver: false,
        }),
      ]).start();
    } else {
      scale.setValue(1.0);
    }
  }, [focused]);

  const getIcon = () => {
    switch (iconType) {
      case 'speed':
        return (
          <Svg width={22} height={22} viewBox="0 0 24 24">
            <Polygon points="13,2 5,14 11,14 9,22 17,10 11,10" fill={color} />
          </Svg>
        );
      case 'history':
        return (
          <Svg width={22} height={22} viewBox="0 0 24 24">
            <Path
              d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z"
              fill={color}
            />
          </Svg>
        );
      case 'graph':
        return (
          <Svg width={22} height={22} viewBox="0 0 24 24">
            <Path
              d="M3.5 18.49l6-6.01 4 4L22 6.92l-1.41-1.41-7.09 7.97-4-4L2 16.99z"
              fill={color}
            />
          </Svg>
        );
      case 'settings':
        return (
          <Svg width={22} height={22} viewBox="0 0 24 24">
            <Path
              d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 00.12-.61l-1.92-3.32a.488.488 0 00-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 00-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58a.49.49 0 00-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"
              fill={color}
            />
          </Svg>
        );
      default:
        return null;
    }
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      {getIcon()}
    </Animated.View>
  );
};

// ── Custom Header ───────────────────────────────────────────────────────────
const CustomHeader = ({ title }) => {
  const { t } = useTheme();
  return (
    <View style={[tabStyles.header, { backgroundColor: t.headerBg }]}>
      <View style={tabStyles.headerLeft}>
        <LightningLogo size={18} />
        <Text style={[tabStyles.headerBrand, { color: t.headerText }]}>ZOLT</Text>
      </View>
      <View style={tabStyles.headerCenter}>
        <FlashTitle text={title.toUpperCase()} size="large" interval={5000} center glow />
      </View>
      <View style={tabStyles.headerRight} />
    </View>
  );
};

// ── Inner app that can read theme ───────────────────────────────────────────
const CustomTabNavigator = () => {
  const { t } = useTheme();
  const isDark = t.mode === 'dark';
  const [activeIndex, setActiveIndex] = useState(0);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      
      {/* Header */}
      <View style={[tabStyles.header, { backgroundColor: t.headerBg }]}>
        <View style={tabStyles.headerLeft}>
          <LightningLogo size={18} />
          <Text style={[tabStyles.headerBrand, { color: t.headerText }]}>ZOLT</Text>
        </View>
        <View style={tabStyles.headerCenter}>
          <FlashTitle text={TABS[activeIndex].label.toUpperCase()} size="large" interval={5000} center glow />
        </View>
        <View style={tabStyles.headerRight} />
      </View>

      {/* Content Area */}
      <View style={{ flex: 1 }}>
        <Tab.Navigator
          screenOptions={{
            tabBarStyle: { display: 'none' }, // Hide default tab bar
            headerShown: false, // Hide default headers
          }}
        >
          {TABS.map((tab, index) => (
            <Tab.Screen
              key={tab.key}
              name={tab.key}
              component={tab.component}
              listeners={{
                tabPress: () => {
                  SoundEngine.playNavTick();
                  setActiveIndex(index);
                },
              }}
              options={{
                tabBarLabel: tab.label,
              }}
            />
          ))}
        </Tab.Navigator>
      </View>

      {/* Floating Pill Navigation */}
      <FloatingPillNav 
        state={{ index: activeIndex, routes: TABS.map(tab => ({ key: tab.key, name: tab.key })) }}
        navigation={{ navigate: (routeName) => {
          const index = TABS.findIndex(tab => tab.key === routeName);
          if (index !== -1) {
            setActiveIndex(index);
          }
        }}}
        t={t}
        isDark={isDark}
      />
    </SafeAreaView>
  );
};

function AppInner() {
  const { t } = useTheme();

  return (
    <NavigationContainer>
      <CustomTabNavigator />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppSettingsProvider>
        <AppInner />
      </AppSettingsProvider>
    </ThemeProvider>
  );
}

const tabStyles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
    paddingTop: 48,
    height: 96,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 80,
  },
  headerBrand: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 3,
    marginLeft: 8,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRight: {
    minWidth: 80,
  },
  activeIndicator: {
    position: 'absolute',
    top: -8,
    width: 24,
    height: 2,
    backgroundColor: COLORS.accent,
    borderRadius: 1,
  },
});

const pillStyles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderRadius: 50, // Very rounded for pill shape
    borderWidth: 1,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    minHeight: 60,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 25,
    minHeight: 36,
  },
  tabItemActive: {
    backgroundColor: COLORS.accent,
  },
});

import React, { useRef, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { View, Text, Animated, StyleSheet, Platform } from 'react-native';
import Svg, { Path, Polygon } from 'react-native-svg';
import SpeedTestScreen from './src/screens/SpeedTestScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import GraphScreen from './src/screens/GraphScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import FlashTitle from './src/components/FlashTitle';
import { COLORS, ThemeProvider, useTheme } from './src/utils/theme';
import { AppSettingsProvider } from './src/context/AppSettingsContext';
import SoundEngine from './src/services/SoundEngine';

const Tab = createBottomTabNavigator();

// ── Lightning Bolt SVG Logo ─────────────────────────────────────────────────
const LightningLogo = ({ size = 22 }) => {
  const { t } = useTheme();
  return (
    <Svg width={size} height={size * 1.4} viewBox="0 0 24 34">
      <Polygon
        points="14,0 4,18 12,18 10,34 20,14 12,14"
        fill={t.accent}
      />
    </Svg>
  );
};

// ── Tab Bar Icon with scale animation ───────────────────────────────────────
const TabIcon = ({ focused, iconType, color }) => {
  const { t } = useTheme();
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
          <Svg width={28} height={28} viewBox="0 0 24 24">
            <Polygon points="13,2 5,14 11,14 9,22 17,10 11,10" fill={color} />
          </Svg>
        );
      case 'history':
        return (
          <Svg width={28} height={28} viewBox="0 0 24 24">
            <Path
              d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z"
              fill={color}
            />
          </Svg>
        );
      case 'graph':
        return (
          <Svg width={28} height={28} viewBox="0 0 24 24">
            <Path
              d="M3.5 18.49l6-6.01 4 4L22 6.92l-1.41-1.41-7.09 7.97-4-4L2 16.99z"
              fill={color}
            />
          </Svg>
        );
      case 'settings':
        return (
          <Svg width={28} height={28} viewBox="0 0 24 24">
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
    <View style={{ alignItems: 'center' }}>
      <Animated.View style={{ transform: [{ scale }] }}>
        {getIcon()}
      </Animated.View>
    </View>
  );
};

// ── Custom Header ───────────────────────────────────────────────────────────
const CustomHeader = ({ title }) => {
  const { t } = useTheme();
  return (
    <View style={[tabStyles.header, { backgroundColor: t.headerBg }]}>
      <View style={tabStyles.headerLeft}>
        <LightningLogo size={18} />
      </View>
      <View style={tabStyles.headerCenter}>
        <FlashTitle text={title.toUpperCase()} size="large" interval={5000} center glow />
      </View>
      <View style={tabStyles.headerRight} />
    </View>
  );
};

// ── Inner app that can read theme ───────────────────────────────────────────
function AppInner() {
  const { t } = useTheme();
  const isDark = t.mode === 'dark';

  return (
    <NavigationContainer>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Tab.Navigator
        screenOptions={{
          tabBarStyle: {
            backgroundColor: t.navBar,
            borderTopWidth: isDark ? 0 : 1,
            borderTopColor: isDark ? 'transparent' : 'rgba(0,0,0,0.06)',
            height: 50,
            paddingBottom: 2,
            paddingTop: 2,
            elevation: isDark ? 0 : 2,
            shadowOpacity: isDark ? 0 : 0.06,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -1 },
            shadowRadius: 4,
          },
          tabBarActiveTintColor: t.navActive,
          tabBarInactiveTintColor: t.navInactive,
          tabBarLabelStyle: {
            fontSize: 0,
            display: 'none',
          },
          headerStyle: {
            backgroundColor: t.headerBg,
            elevation: isDark ? 0 : 2,
            shadowOpacity: isDark ? 0 : 0.06,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowRadius: 4,
            borderBottomWidth: isDark ? 0 : 1,
            borderBottomColor: isDark ? 'transparent' : 'rgba(0,0,0,0.06)',
            height: 96,
          },
          headerTintColor: t.headerText,
          headerTitleStyle: {
            fontWeight: '700',
            fontSize: 17,
            letterSpacing: 0.5,
            fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
          },
        }}
      >
        <Tab.Screen
          name="Speed Test"
          component={SpeedTestScreen}
          listeners={{ tabPress: () => SoundEngine.playNavTick() }}
          options={{
            tabBarLabel: 'Speed',
            header: () => <CustomHeader title="Speed Test" />,
            tabBarIcon: ({ color, focused }) => (
              <TabIcon focused={focused} iconType="speed" color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="History"
          component={HistoryScreen}
          listeners={{ tabPress: () => SoundEngine.playNavTick() }}
          options={{
            tabBarLabel: 'History',
            header: () => <CustomHeader title="History" />,
            tabBarIcon: ({ color, focused }) => (
              <TabIcon focused={focused} iconType="history" color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="Graphs"
          component={GraphScreen}
          listeners={{ tabPress: () => SoundEngine.playNavTick() }}
          options={{
            tabBarLabel: 'Graphs',
            header: () => <CustomHeader title="Graphs" />,
            tabBarIcon: ({ color, focused }) => (
              <TabIcon focused={focused} iconType="graph" color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="Settings"
          component={SettingsScreen}
          listeners={{ tabPress: () => SoundEngine.playNavTick() }}
          options={{
            tabBarLabel: 'Settings',
            header: () => <CustomHeader title="Settings" />,
            tabBarIcon: ({ color, focused }) => (
              <TabIcon focused={focused} iconType="settings" color={color} />
            ),
          }}
        />
      </Tab.Navigator>
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
    borderRadius: 1,
  },
});

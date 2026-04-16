import React, { useRef, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { View, Text, Animated, StyleSheet, Platform, Easing, TouchableOpacity } from 'react-native';
import Svg, { Path, Polygon } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import SpeedTestScreen from './src/screens/SpeedTestScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import GraphScreen from './src/screens/GraphScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import FlashTitle from './src/components/FlashTitle';
import { COLORS, ThemeProvider, useTheme } from './src/utils/theme';
import { AppSettingsProvider } from './src/context/AppSettingsContext';
import { TestProvider, useTestContext } from './src/context/TestContext';
import SoundEngine from './src/services/SoundEngine';

const Tab = createBottomTabNavigator();

// ── Lightning Bolt SVG Logo ─────────────────────────────────────────────────
const LightningLogo = ({ size = 22, isTestRunning = false }) => {
  const { t } = useTheme();
  const wiggleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isTestRunning) {
      const wiggle = Animated.loop(
        Animated.sequence([
          // Quick left jab with easing
          Animated.timing(wiggleAnim, { toValue: -1, duration: 120, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
          // Return to center smoothly
          Animated.timing(wiggleAnim, { toValue: 0, duration: 180, useNativeDriver: true, easing: Easing.inOut(Easing.quad) }),
          // Pause
          Animated.delay(250),
          // Quick right jab with easing
          Animated.timing(wiggleAnim, { toValue: 1, duration: 120, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
          // Return to center smoothly
          Animated.timing(wiggleAnim, { toValue: 0, duration: 180, useNativeDriver: true, easing: Easing.inOut(Easing.quad) }),
          // Longer pause
          Animated.delay(450),
          // Double tap left
          Animated.timing(wiggleAnim, { toValue: -0.6, duration: 70, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
          Animated.timing(wiggleAnim, { toValue: 0, duration: 90, useNativeDriver: true, easing: Easing.inOut(Easing.quad) }),
          Animated.timing(wiggleAnim, { toValue: -0.6, duration: 70, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
          Animated.timing(wiggleAnim, { toValue: 0, duration: 120, useNativeDriver: true, easing: Easing.inOut(Easing.quad) }),
          // Pause
          Animated.delay(350),
          // Double tap right
          Animated.timing(wiggleAnim, { toValue: 0.6, duration: 70, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
          Animated.timing(wiggleAnim, { toValue: 0, duration: 90, useNativeDriver: true, easing: Easing.inOut(Easing.quad) }),
          Animated.timing(wiggleAnim, { toValue: 0.6, duration: 70, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
          Animated.timing(wiggleAnim, { toValue: 0, duration: 120, useNativeDriver: true, easing: Easing.inOut(Easing.quad) }),
          // Longer pause before loop
          Animated.delay(550),
        ])
      );
      wiggle.start();
      return () => wiggle.stop();
    } else {
      Animated.timing(wiggleAnim, { toValue: 0, duration: 300, useNativeDriver: true, easing: Easing.out(Easing.quad) }).start();
    }
  }, [isTestRunning]);

  const rotation = wiggleAnim.interpolate({
    inputRange: [-1, -0.6, 0, 0.6, 1],
    outputRange: ['-10deg', '-6deg', '0deg', '6deg', '10deg'],
  });

  return (
    <Animated.View style={{ transform: [{ rotate: rotation }] }}>
      <Svg width={size} height={size * 1.4} viewBox="0 0 24 34">
        <Polygon
          points="14,0 4,18 12,18 10,34 20,14 12,14"
          fill={t.accent}
        />
      </Svg>
    </Animated.View>
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
  const { isTestRunning } = useTestContext();
  const isDark = t.mode === 'dark';
  return (
    <View style={[tabStyles.header, { backgroundColor: t.headerBg }]}>
      <View style={tabStyles.headerLeft}>
        <LightningLogo size={18} isTestRunning={isTestRunning} />
      </View>
      <View style={tabStyles.headerCenter}>
        <FlashTitle text={title.toUpperCase()} size="large" interval={5000} center glow />
      </View>
      <View style={tabStyles.headerRight} />
      <LinearGradient
        colors={[isDark ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.08)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={tabStyles.headerFade}
      />
    </View>
  );
};

// ── Custom Tab Bar with gradient fade ──────────────────────────────────────
const CustomTabBar = ({ state, descriptors, navigation }) => {
  const { t } = useTheme();
  const isDark = t.mode === 'dark';

  return (
    <View style={{ backgroundColor: t.navBar, position: 'relative' }}>
      <View style={{ flexDirection: 'row', height: 44 }}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              SoundEngine.playNavTick();
              navigation.navigate(route.name);
            }
          };

          const getIcon = () => {
            switch (route.name) {
              case 'Speed Test':
                return (
                  <Svg width={28} height={28} viewBox="0 0 24 24">
                    <Polygon points="13,2 5,14 11,14 9,22 17,10 11,10" fill={isFocused ? t.navActive : t.navInactive} />
                  </Svg>
                );
              case 'History':
                return (
                  <Svg width={28} height={28} viewBox="0 0 24 24">
                    <Path
                      d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z"
                      fill={isFocused ? t.navActive : t.navInactive}
                    />
                  </Svg>
                );
              case 'Graphs':
                return (
                  <Svg width={28} height={28} viewBox="0 0 24 24">
                    <Path
                      d="M3.5 18.49l6-6.01 4 4L22 6.92l-1.41-1.41-7.09 7.97-4-4L2 16.99z"
                      fill={isFocused ? t.navActive : t.navInactive}
                    />
                  </Svg>
                );
              case 'Settings':
                return (
                  <Svg width={28} height={28} viewBox="0 0 24 24">
                    <Path
                      d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 00.12-.61l-1.92-3.32a.488.488 0 00-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 00-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58a.49.49 0 00-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"
                      fill={isFocused ? t.navActive : t.navInactive}
                    />
                  </Svg>
                );
              default:
                return null;
            }
          };

          return (
            <TouchableOpacity
              key={index}
              onPress={onPress}
              style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
              activeOpacity={0.7}
            >
              {getIcon()}
            </TouchableOpacity>
          );
        })}
      </View>
      <LinearGradient
        colors={[isDark ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.08)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 16, pointerEvents: 'none' }}
      />
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
        tabBar={(props) => <CustomTabBar {...props} />}
        screenOptions={{
          tabBarStyle: {
            backgroundColor: t.navBar,
            borderTopWidth: 0,
            height: 44,
            paddingBottom: 0,
            paddingTop: 0,
            elevation: 0,
            shadowOpacity: 0,
          },
          tabBarActiveTintColor: t.navActive,
          tabBarInactiveTintColor: t.navInactive,
          tabBarLabelStyle: {
            fontSize: 0,
            display: 'none',
          },
          headerStyle: {
            backgroundColor: t.headerBg,
            elevation: 0,
            shadowOpacity: 0,
            borderBottomWidth: 0,
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
        <TestProvider>
          <AppInner />
        </TestProvider>
      </AppSettingsProvider>
    </ThemeProvider>
  );
}

const tabStyles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingBottom: 12,
    paddingHorizontal: 16,
    position: 'relative',
  },
  headerLeft: {
    width: 32,
    alignItems: 'flex-start',
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

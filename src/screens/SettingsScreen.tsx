import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  TextInput,
  Alert,
  Animated,
  Linking,
  Platform,
  LayoutAnimation,
  UIManager,
  LayoutChangeEvent,
  PermissionsAndroid,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import SpeedTestService from '../services/SpeedTestService';
import SoundEngine from '../services/SoundEngine';
import FlashTitle from '../components/FlashTitle';
import ColorPickerWheel from '../components/ColorPickerWheel';
import LiquidGlass from '../components/LiquidGlass';
import WiFiAnalyzerScreen from './WiFiAnalyzerScreen';
import { useTabBarMotion } from '../context/TabBarMotionContext';
import { useAppSettings } from '../context/AppSettingsContext';
import BackgroundTestService, { BACKGROUND_INTERVALS } from '../services/BackgroundTestService';
import { COLORS, RADIUS, useTheme, COLOR_THEMES } from '../utils/theme';

// LayoutAnimation is now enabled by default on Android

const FONT_FAMILY = Platform.OS === 'ios' ? 'System' : 'sans-serif';

// ── Type Definitions ─────────────────────────────────────────────────────────
interface SegmentedControlProps {
  options: { label: string; value: string }[];
  selected: string;
  onSelect: (value: string) => void;
}

interface DropdownProps {
  options: { label: string; value: string }[];
  selected: string;
  onSelect: (value: string) => void;
  isOpen: boolean;
  onToggle: () => void;
}

interface SettingsRowProps {
  label: string;
  children: React.ReactNode;
  isLast?: boolean;
}

type PermissionState = 'granted' | 'denied' | 'blocked' | 'unavailable';

type PermissionKey = 'location' | 'nearbyWifi' | 'notifications' | 'phoneState';

type PermissionItem = {
  key: PermissionKey;
  label: string;
  description: string;
  permission?: string;
  minAndroid?: number;
};

const getAndroidPermissionItems = (): PermissionItem[] => {
  const permissions = PermissionsAndroid.PERMISSIONS as any;
  return [
    {
      key: 'location',
      label: 'Location',
      description: 'Required by Android to see nearby WiFi names and BSSIDs.',
      permission: PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    },
    {
      key: 'nearbyWifi',
      label: 'Nearby WiFi',
      description: 'Required on Android 13+ for WiFi diagnostics.',
      permission: permissions.NEARBY_WIFI_DEVICES,
      minAndroid: 33,
    },
    {
      key: 'notifications',
      label: 'Notifications',
      description: 'Shows continuous monitoring status and alerts.',
      permission: PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
      minAndroid: 33,
    },
    {
      key: 'phoneState',
      label: 'Phone State',
      description: 'Allows detailed cellular radio diagnostics.',
      permission: PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE,
    },
  ];
};

// ── Pill Segmented Control with sliding indicator ───────────────────────────
const SegmentedControl = ({ options, selected, onSelect }: SegmentedControlProps) => {
  const { t } = useTheme();
  const isDark = t.mode === 'dark';
  const containerBg = isDark ? '#2A2A2A' : '#E8E8E8';
  const slideAnim = useRef(new Animated.Value(0)).current;
  const [segmentWidth, setSegmentWidth] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);

  const selectedIndex = options.findIndex((o) => o.value === selected);

  useEffect(() => {
    if (segmentWidth > 0) {
      Animated.spring(slideAnim, {
        toValue: selectedIndex * segmentWidth,
        tension: 300,
        friction: 25,
        useNativeDriver: false,
      }).start();
    }
  }, [selectedIndex, segmentWidth]);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    setContainerWidth(w);
    setSegmentWidth(w / options.length);
  };

  return (
    <View
      style={[segS.container, { backgroundColor: containerBg }]}
      onLayout={onLayout}
    >
      {/* Sliding pill indicator */}
      {segmentWidth > 0 && (
        <Animated.View
          style={[
            segS.indicator,
            {
              width: segmentWidth - 4,
              backgroundColor: t.accent,
              transform: [{ translateX: Animated.add(slideAnim, 2) }],
            },
          ]}
        />
      )}
      {options.map((opt) => {
        const isActive = selected === opt.value;
        return (
          <TouchableOpacity
            key={opt.value}
            style={segS.segment}
            onPress={() => onSelect(opt.value)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                segS.segmentText,
                { color: isDark ? '#999' : '#777', fontFamily: FONT_FAMILY },
                isActive && segS.segmentTextActive,
              ]}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const segS = StyleSheet.create({
  container: {
    flexDirection: 'row', borderRadius: 22, overflow: 'hidden',
    padding: 2, position: 'relative',
  },
  indicator: {
    position: 'absolute', top: 2, bottom: 2,
    borderRadius: 20,
    zIndex: 0,
  },
  segment: {
    flex: 1, paddingVertical: 8, alignItems: 'center',
    justifyContent: 'center', zIndex: 1,
  },
  segmentText: { fontSize: 13, fontWeight: '700' },
  segmentTextActive: { color: COLORS.black, fontWeight: '800' },
});

// ── Dropdown ────────────────────────────────────────────────────────────────
const Dropdown = ({ options, selected, onSelect, isOpen, onToggle }: DropdownProps) => {
  const { t } = useTheme();
  return (
    <View>
      <TouchableOpacity
        style={[dropS.trigger, { backgroundColor: t.controlBg, borderColor: t.controlBorder }]}
        onPress={onToggle} activeOpacity={0.7}
      >
        <Text style={[dropS.triggerText, { color: t.textPrimary, fontFamily: FONT_FAMILY }]}>{options.find((o) => o.value === selected)?.label || 'Select'}</Text>
        <Text style={[dropS.arrow, { color: t.textSecondary, textShadowColor: 'rgba(0, 0, 0, 0.2)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 1.5 }]}>{isOpen ? '▲' : '▼'}</Text>
      </TouchableOpacity>
      {isOpen && (
        <View style={[dropS.menu, { backgroundColor: t.controlBg, borderColor: t.controlBorder }]}>
          {options.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[
                dropS.menuItem,
                { borderBottomColor: t.controlSepLight },
                selected === opt.value && [dropS.menuItemActive, { backgroundColor: t.accentTintSelected }],
              ]}
              onPress={() => { onSelect(opt.value); onToggle(); }}
              activeOpacity={0.7}
            >
              <Text style={[
                dropS.menuItemText,
                { color: t.textSecondary, fontFamily: FONT_FAMILY, textShadowColor: 'rgba(0, 0, 0, 0.2)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 1.5 },
                selected === opt.value && [dropS.menuItemTextActive, { color: t.accent }],
              ]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
};

const dropS = StyleSheet.create({
  trigger: { flexDirection: 'row', alignItems: 'center', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1 },
  triggerText: { fontSize: 13, fontWeight: '600', flex: 1 },
  arrow: { fontSize: 10, marginLeft: 8 },
  menu: { marginTop: 4, borderRadius: 10, borderWidth: 1, overflow: 'hidden' },
  menuItem: { paddingVertical: 10, paddingHorizontal: 14, borderBottomWidth: 1 },
  menuItemActive: {},
  menuItemText: { fontSize: 13, fontWeight: '600' },
  menuItemTextActive: {},
});

// ── Settings Row ────────────────────────────────────────────────────────────
const SettingsRow = ({ label, children, isLast }: SettingsRowProps) => {
  const { t } = useTheme();
  return (
    <View style={[rowS.container, !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.separator }]}>
      <Text style={[rowS.label, { color: t.textPrimary, fontFamily: FONT_FAMILY }]}>{label}</Text>
      <View style={rowS.right}>{children}</View>
    </View>
  );
};

const rowS = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 16, minHeight: 48 },
  label: { fontSize: 15, fontWeight: '500', flex: 1 },
  right: { flexShrink: 0, alignItems: 'flex-end' },
});

// ── Main Settings Screen ────────────────────────────────────────────────────
const SettingsScreen = () => {
  const { t, themeChoice, setThemeChoice, colorThemeId, setColorThemeId } = useTheme();
  const { setTabBarMode } = useTabBarMotion();
  const { settings, updateSettings } = useAppSettings();

  const [speedUnit, setSpeedUnit] = useState('mbps');
  const [showPing, setShowPing] = useState(true);
  const [notifyComplete, setNotifyComplete] = useState(false);
  const [alertThreshold, setAlertThreshold] = useState('');
  const [intervalOpen, setIntervalOpen] = useState(false);
  const [colorPickerVisible, setColorPickerVisible] = useState(false);
  const [wifiAnalyzerVisible, setWifiAnalyzerVisible] = useState(false);
  const [permissionStates, setPermissionStates] = useState<Record<PermissionKey, PermissionState>>({
    location: 'unavailable',
    nearbyWifi: 'unavailable',
    notifications: 'unavailable',
    phoneState: 'unavailable',
  });

  // Sound & Haptics state
  const [sfxMuted, setSfxMuted] = useState(SoundEngine.muted);
  const [sfxVolume, setSfxVolume] = useState(SoundEngine.volume);
  const [hapticsOn, setHapticsOn] = useState(SoundEngine.hapticsEnabled);

  const contentFade = useRef(new Animated.Value(0)).current;
  const lastScrollY = useRef(0);
  const permissionItems = useMemo(() => getAndroidPermissionItems(), []);
  const androidVersion = typeof Platform.Version === 'number' ? Platform.Version : Number(Platform.Version);

  const refreshPermissionStates = React.useCallback(async () => {
    if (Platform.OS !== 'android') {
      setPermissionStates({
        location: 'unavailable',
        nearbyWifi: 'unavailable',
        notifications: 'unavailable',
        phoneState: 'unavailable',
      });
      return;
    }

    const nextStates = await permissionItems.reduce(async (statePromise, item) => {
      const state = await statePromise;
      if (!item.permission || (item.minAndroid && androidVersion < item.minAndroid)) {
        return { ...state, [item.key]: 'unavailable' as PermissionState };
      }

      const granted = await PermissionsAndroid.check(item.permission as any).catch(() => false);
      return { ...state, [item.key]: granted ? 'granted' as PermissionState : 'denied' as PermissionState };
    }, Promise.resolve({} as Record<PermissionKey, PermissionState>));

    setPermissionStates((current) => ({ ...current, ...nextStates }));
  }, [androidVersion, permissionItems]);

  useEffect(() => {
    Animated.timing(contentFade, { toValue: 1, duration: 300, useNativeDriver: false }).start();
    void refreshPermissionStates();
  }, [contentFade, refreshPermissionStates]);

  useEffect(() => {
    setTabBarMode('expanded');
    lastScrollY.current = 0;
  }, [setTabBarMode]);

  useFocusEffect(React.useCallback(() => {
    setTabBarMode('expanded');
    lastScrollY.current = 0;
    void refreshPermissionStates();
  }, [refreshPermissionStates, setTabBarMode]));

  const requestPermission = async (item: PermissionItem) => {
    if (Platform.OS !== 'android') return;
    if (!item.permission || (item.minAndroid && androidVersion < item.minAndroid)) return;

    const result = await PermissionsAndroid.request(item.permission as any).catch(() => PermissionsAndroid.RESULTS.DENIED);
    setPermissionStates((current) => ({
      ...current,
      [item.key]: result === PermissionsAndroid.RESULTS.GRANTED
        ? 'granted'
        : result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN
          ? 'blocked'
          : 'denied',
    }));
  };

  const getPermissionStatusLabel = (state: PermissionState) => {
    if (state === 'granted') return 'Enabled';
    if (state === 'blocked') return 'Blocked';
    if (state === 'unavailable') return 'Not needed';
    return 'Off';
  };

  const getPermissionActionLabel = (state: PermissionState) => {
    if (state === 'granted') return 'Enabled';
    if (state === 'blocked') return 'Open Settings';
    if (state === 'unavailable') return 'N/A';
    return 'Allow';
  };

  const handlePermissionAction = async (item: PermissionItem, state: PermissionState) => {
    if (state === 'blocked') {
      await Linking.openSettings();
      return;
    }

    await requestPermission(item);
  };

  const handleScroll = (event: any) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    const delta = offsetY - lastScrollY.current;

    if (offsetY <= 12) {
      setTabBarMode('expanded');
    } else if (delta > 6) {
      setTabBarMode('hidden');
    } else if (delta < -6) {
      setTabBarMode('expanded');
    }

    lastScrollY.current = offsetY;
  };

  // Toggle handler that plays the appropriate sound
  const handleToggle = (currentVal: boolean, setter: React.Dispatch<React.SetStateAction<boolean>>, engineProp?: 'muted' | 'hapticsEnabled') => {
    const newVal = !currentVal;
    setter(newVal);
    if (engineProp) {
      SoundEngine[engineProp] = engineProp === 'muted' ? newVal : newVal;
    }
    if (newVal) SoundEngine.playToggleOn();
    else SoundEngine.playToggleOff();
  };

  const handleVolumeChange = (val: string) => {
    const v = parseFloat(val) || 0;
    const clamped = Math.max(0, Math.min(1, v));
    setSfxVolume(clamped);
    SoundEngine.volume = clamped;
  };

  const handleClearHistory = () => {
    Alert.alert('Clear Test History', 'This will permanently delete all speed test records. Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear All', style: 'destructive', onPress: async () => { await SpeedTestService.clearHistory(); Alert.alert('Done', 'Test history has been cleared.'); } },
    ]);
  };

  const handleExport = () => Alert.alert('Export', 'CSV export functionality coming soon.');

  const selectedBackgroundInterval = String(settings.backgroundTestIntervalSeconds ?? 30 * 60);

  const enableContinuousMonitoring = () => {
    Alert.alert(
      'Enable continuous monitoring?',
      'Background testing runs a short ping and 4-second download probe at the selected interval. It uses data and battery; 30 minutes or longer is recommended for low daily impact.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Enable',
          onPress: async () => {
            const status = await BackgroundTestService.getStatus();
            if (!status.nativeAndroidAvailable && (!status.isAvailable || status.fetchStatus !== 2)) {
              Alert.alert(
                'Background testing unavailable',
                'The system is not allowing background tasks for this app right now. Check OS background app refresh settings and use a development or production build.',
              );
              return;
            }

            if (Platform.OS === 'android' && Platform.Version >= 33) {
              const permission = await PermissionsAndroid.request(
                PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
              );

              if (permission !== PermissionsAndroid.RESULTS.GRANTED) {
                Alert.alert(
                  'Notification permission needed',
                  'Allow notifications so Android can show the continuous monitoring status card and Turn off action.',
                );
                return;
              }
            }

            updateSettings({
              continuousMonitoringEnabled: true,
              backgroundTestingPermissionAccepted: true,
              backgroundTestIntervalSeconds: settings.backgroundTestIntervalSeconds ?? 30 * 60,
            });
          },
        },
      ],
    );
  };

  const handleContinuousMonitoringToggle = (value: boolean) => {
    if (!value) {
      updateSettings({ continuousMonitoringEnabled: false });
      SoundEngine.playToggleOff();
      return;
    }

    SoundEngine.playToggleOn();
    enableContinuousMonitoring();
  };

  if (wifiAnalyzerVisible) {
    return <WiFiAnalyzerScreen onBack={() => setWifiAnalyzerVisible(false)} />;
  }

  return (
    <Animated.ScrollView
      style={[styles.container, { opacity: contentFade }]}
      contentContainerStyle={styles.contentContainer}
      onScroll={handleScroll}
      scrollEventThrottle={16}
      showsVerticalScrollIndicator={false}
    >
      {/* APPEARANCE */}
      <FlashTitle text="APPEARANCE" size="small" interval={5000} center style={styles.sectionHeader} />
      <LiquidGlass style={styles.sectionCard} borderRadius={RADIUS.lg} contentStyle={styles.sectionCardContent}>
        <SettingsRow label="Theme">
          <View style={{ width: 200 }}>
            <SegmentedControl
              options={[
                { label: 'Light', value: 'light' },
                { label: 'Dark', value: 'dark' },
                { label: 'System', value: 'system' },
              ]}
              selected={themeChoice}
              onSelect={setThemeChoice}
            />
          </View>
        </SettingsRow>
        <SettingsRow label="Accent Color" isLast>
          <LiquidGlass
            style={styles.accentSwatch}
            onPress={() => setColorPickerVisible(true)}
            borderRadius={999}
            blurIntensity={24}
            contentStyle={styles.accentSwatchContent}
          >
            <View style={[styles.accentDot, { backgroundColor: t.accent, borderColor: t.accentDark }]} />
            <Text style={[styles.accentLabel, { color: t.textSecondary, fontFamily: FONT_FAMILY, textShadowColor: 'rgba(0, 0, 0, 0.2)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 1.5 }]}>
              {COLOR_THEMES.find(ct => ct.id === colorThemeId)?.name || 'Gold'}
            </Text>
          </LiquidGlass>
        </SettingsRow>
      </LiquidGlass>

      {/* TESTING */}
      <FlashTitle text="TESTING" size="small" interval={5500} center style={styles.sectionHeader} />
      <LiquidGlass style={styles.sectionCard} borderRadius={RADIUS.lg} contentStyle={styles.sectionCardContent}>
        <SettingsRow label="Continuous Monitoring">
          <Switch
            value={settings.continuousMonitoringEnabled}
            onValueChange={handleContinuousMonitoringToggle}
            trackColor={{ false: t.switchTrackOff, true: t.accent }}
            thumbColor={settings.continuousMonitoringEnabled ? COLORS.white : t.switchThumbOff}
            ios_backgroundColor={t.switchTrackOff}
          />
        </SettingsRow>
        <Text style={[styles.backgroundHelperText, { color: t.textMuted, fontFamily: FONT_FAMILY }]}>
          Runs a battery-conscious ping plus 4-second download probe in the background. Android can restart after boot; iOS schedules opportunistically.
        </Text>
        <SettingsRow label="Monitoring Interval">
          <View style={{ width: 160 }}>
            <Dropdown
              options={BACKGROUND_INTERVALS.map((option) => ({
                label: option.label,
                value: String(option.value),
              }))}
              selected={selectedBackgroundInterval}
              onSelect={(value) => {
                updateSettings({
                  backgroundTestIntervalSeconds: Number(value),
                  backgroundTestInterval: Number(value) / 60,
                });
              }}
              isOpen={intervalOpen} onToggle={() => setIntervalOpen(!intervalOpen)}
            />
          </View>
        </SettingsRow>
        <SettingsRow label="Default Server" isLast>
          <View style={styles.serverRow}>
            <Text style={[styles.serverText, { color: t.textSecondary, fontFamily: FONT_FAMILY, textShadowColor: 'rgba(0, 0, 0, 0.2)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 1.5 }]}>Auto (Nearest)</Text>
            <TouchableOpacity activeOpacity={0.7}>
              <Text style={[styles.changeLink, { fontFamily: FONT_FAMILY, color: t.accent }]}>Change</Text>
            </TouchableOpacity>
          </View>
        </SettingsRow>
      </LiquidGlass>

      {/* UNITS & DISPLAY */}
      <FlashTitle text="UNITS & DISPLAY" size="small" interval={6000} center style={styles.sectionHeader} />
      <LiquidGlass style={styles.sectionCard} borderRadius={RADIUS.lg} contentStyle={styles.sectionCardContent}>
        <SettingsRow label="Speed Unit">
          <View style={{ width: 200 }}>
            <SegmentedControl
              options={[
                { label: 'Mbps', value: 'mbps' },
                { label: 'Kbps', value: 'kbps' },
                { label: 'MB/s', value: 'mbs' },
              ]}
              selected={speedUnit} onSelect={setSpeedUnit}
            />
          </View>
        </SettingsRow>
        <SettingsRow label="Show Ping" isLast>
          <Switch
            value={showPing} onValueChange={() => handleToggle(showPing, setShowPing)}
            trackColor={{ false: t.switchTrackOff, true: t.accent }}
            thumbColor={showPing ? COLORS.white : t.switchThumbOff}
            ios_backgroundColor={t.switchTrackOff}
          />
        </SettingsRow>
      </LiquidGlass>

      {/* NOTIFICATIONS */}
      <FlashTitle text="NOTIFICATIONS" size="small" interval={6500} center style={styles.sectionHeader} />
      <LiquidGlass style={styles.sectionCard} borderRadius={RADIUS.lg} contentStyle={styles.sectionCardContent}>
        <SettingsRow label="Notify on test complete">
          <Switch
            value={notifyComplete} onValueChange={() => handleToggle(notifyComplete, setNotifyComplete)}
            trackColor={{ false: t.switchTrackOff, true: t.accent }}
            thumbColor={notifyComplete ? COLORS.white : t.switchThumbOff}
            ios_backgroundColor={t.switchTrackOff}
          />
        </SettingsRow>
        <SettingsRow label="Alert if speed below" isLast>
          <View style={styles.thresholdRow}>
            <TextInput
              style={[styles.thresholdInput, { backgroundColor: t.controlBg, borderColor: t.controlBorder, color: t.textPrimary, fontFamily: FONT_FAMILY }]}
              value={alertThreshold} onChangeText={setAlertThreshold}
              keyboardType="numeric" placeholder="—" maxLength={5}
            />
            <Text style={[styles.thresholdUnit, { color: t.textSecondary, fontFamily: FONT_FAMILY, textShadowColor: 'rgba(0, 0, 0, 0.2)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 1.5 }]}>Mbps</Text>
          </View>
        </SettingsRow>
      </LiquidGlass>

      {/* SOUND & HAPTICS */}
      <FlashTitle text="SOUND & HAPTICS" size="small" interval={6800} center style={styles.sectionHeader} />
      <LiquidGlass style={styles.sectionCard} borderRadius={RADIUS.lg} contentStyle={styles.sectionCardContent}>
        <SettingsRow label="Sound Effects">
          <Switch
            value={!sfxMuted} onValueChange={() => {
              const newMuted = !sfxMuted;
              setSfxMuted(newMuted);
              SoundEngine.muted = newMuted;
              if (!newMuted) SoundEngine.playToggleOn();
            }}
            trackColor={{ false: t.switchTrackOff, true: t.accent }}
            thumbColor={!sfxMuted ? COLORS.white : t.switchThumbOff}
            ios_backgroundColor={t.switchTrackOff}
          />
        </SettingsRow>
        <SettingsRow label="Master Volume">
          <View style={styles.volumeRow}>
            {[0.25, 0.5, 0.75, 1.0].map((v) => (
              <TouchableOpacity
                key={v}
                style={[styles.volumeDot, { borderColor: t.accent }, sfxVolume >= v && [styles.volumeDotActive, { backgroundColor: t.accent }]]}
                onPress={() => { handleVolumeChange(v.toString()); SoundEngine.playNavTick(); }}
                activeOpacity={0.7}
              />
            ))}
            <Text style={[styles.volumeLabel, { color: t.textSecondary, fontFamily: FONT_FAMILY, textShadowColor: 'rgba(0, 0, 0, 0.2)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 1.5 }]}>{Math.round(sfxVolume * 100)}%</Text>
          </View>
        </SettingsRow>
        <SettingsRow label="Haptic Feedback" isLast>
          <Switch
            value={hapticsOn} onValueChange={() => {
              const newVal = !hapticsOn;
              setHapticsOn(newVal);
              SoundEngine.hapticsEnabled = newVal;
              if (newVal) SoundEngine.playToggleOn();
              else SoundEngine.playToggleOff();
            }}
            trackColor={{ false: t.switchTrackOff, true: t.accent }}
            thumbColor={hapticsOn ? COLORS.white : t.switchThumbOff}
            ios_backgroundColor={t.switchTrackOff}
          />
        </SettingsRow>
      </LiquidGlass>

      {/* DATA */}
      <FlashTitle text="DATA" size="small" interval={7000} center style={styles.sectionHeader} />
      <LiquidGlass style={styles.sectionCard} borderRadius={RADIUS.lg} contentStyle={styles.sectionCardContent}>
        <SettingsRow label="WiFi Diagnostics">
          <TouchableOpacity style={styles.diagnosticsButton} onPress={() => setWifiAnalyzerVisible(true)} activeOpacity={0.7}>
            <Text style={[styles.changeLink, { fontFamily: FONT_FAMILY, color: t.accent }]}>Open</Text>
          </TouchableOpacity>
        </SettingsRow>
        <SettingsRow label="Detailed cellular radio">
          <Switch
            value={settings.detailedCellularRadioEnabled}
            onValueChange={(value) => {
              if (!value) {
                updateSettings({ detailedCellularRadioEnabled: false });
                return;
              }

              Alert.alert(
                'Enable detailed cellular stats',
                'This Android-only feature reads serving-cell radio details like RSRP, RSRQ, band, and cell ID during tests. Android may describe this as phone access and also request location because these radio APIs are permission-gated.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Enable', onPress: () => updateSettings({ detailedCellularRadioEnabled: true }) },
                ],
              );
            }}
            trackColor={{ false: t.switchTrackOff, true: t.accent }}
            thumbColor={settings.detailedCellularRadioEnabled ? COLORS.white : t.switchThumbOff}
            ios_backgroundColor={t.switchTrackOff}
          />
        </SettingsRow>
        <Text style={[styles.dataHelperText, { color: t.textMuted, fontFamily: FONT_FAMILY }]}>
          Off by default. When enabled, Android may request phone and location permissions to read serving-cell radio data.
        </Text>
        <View style={styles.dataButtons}>
          <LiquidGlass
            style={[styles.destructiveButton, { backgroundColor: t.glass }]}
            onPress={handleClearHistory}
            borderRadius={RADIUS.pill}
            blurIntensity={24}
            contentStyle={styles.dataButtonContent}
          >
            <Text style={[styles.destructiveButtonText, { fontFamily: FONT_FAMILY }]}>Clear Test History</Text>
          </LiquidGlass>
          <LiquidGlass
            style={[styles.exportButton, { borderColor: t.glassBorderAccent, backgroundColor: t.glass }]}
            onPress={handleExport}
            borderRadius={RADIUS.pill}
            blurIntensity={24}
            contentStyle={styles.dataButtonContent}
          >
            <Text style={[styles.exportButtonText, { fontFamily: FONT_FAMILY, color: t.accent }]}>Export History as CSV</Text>
          </LiquidGlass>
        </View>
      </LiquidGlass>

      {/* PERMISSIONS */}
      <FlashTitle text="PERMISSIONS" size="small" interval={7200} center style={styles.sectionHeader} />
      <LiquidGlass style={styles.sectionCard} borderRadius={RADIUS.lg} contentStyle={styles.sectionCardContent}>
        {Platform.OS === 'android' ? (
          <>
            <Text style={[styles.permissionHelperText, { color: t.textMuted, fontFamily: FONT_FAMILY }]}>
              WiFi diagnostics needs Location, and Android 13+ also needs Nearby WiFi, before Android will return nearby network names and channels.
            </Text>
            {permissionItems.map((item, index) => {
              const state = permissionStates[item.key];
              const isGranted = state === 'granted';
              const isBlocked = state === 'blocked';
              const isUnavailable = state === 'unavailable';
              const statusColor = isGranted
                ? COLORS.success
                : isBlocked
                  ? COLORS.danger
                  : isUnavailable
                    ? t.textMuted
                    : COLORS.warning;

              return (
                <View
                  key={item.key}
                  style={[
                    styles.permissionRow,
                    index < permissionItems.length - 1 && { borderBottomColor: t.separator, borderBottomWidth: StyleSheet.hairlineWidth },
                  ]}
                >
                  <View style={styles.permissionTextColumn}>
                    <View style={styles.permissionTitleRow}>
                      <Text style={[styles.permissionLabel, { color: t.textPrimary, fontFamily: FONT_FAMILY }]}>{item.label}</Text>
                      <View style={[styles.permissionStatusPill, { borderColor: statusColor, backgroundColor: `${statusColor}22` }]}>
                        <Text style={[styles.permissionStatusText, { color: statusColor, fontFamily: FONT_FAMILY }]}>
                          {getPermissionStatusLabel(state)}
                        </Text>
                      </View>
                    </View>
                    <Text style={[styles.permissionDescription, { color: t.textMuted, fontFamily: FONT_FAMILY }]}>
                      {item.description}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.permissionButton,
                      {
                        borderColor: isGranted || isUnavailable ? t.controlBorder : t.accent,
                        backgroundColor: isGranted || isUnavailable ? t.controlBg : t.accentTintSelected,
                        opacity: isUnavailable ? 0.55 : 1,
                      },
                    ]}
                    onPress={() => handlePermissionAction(item, state)}
                    disabled={isGranted || isUnavailable}
                    activeOpacity={0.75}
                  >
                    <Text style={[
                      styles.permissionButtonText,
                      {
                        color: isGranted || isUnavailable ? t.textMuted : t.accent,
                        fontFamily: FONT_FAMILY,
                      },
                    ]}>
                      {getPermissionActionLabel(state)}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </>
        ) : (
          <View style={styles.permissionUnavailableBox}>
            <Text style={[styles.permissionLabel, { color: t.textPrimary, fontFamily: FONT_FAMILY }]}>Android WiFi permissions</Text>
            <Text style={[styles.permissionDescription, { color: t.textMuted, fontFamily: FONT_FAMILY }]}>
              Not available on iOS. Apple does not expose nearby WiFi scans to this app.
            </Text>
          </View>
        )}
      </LiquidGlass>

      <Text style={[styles.versionText, { color: t.textMuted, fontFamily: FONT_FAMILY, textShadowColor: 'rgba(0, 0, 0, 0.2)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 1.5 }]}>Flash v1.1.0</Text>

      <ColorPickerWheel
        visible={colorPickerVisible}
        onClose={() => setColorPickerVisible(false)}
        onColorSelect={setColorThemeId}
        currentColorId={colorThemeId}
      />
    </Animated.ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  contentContainer: { paddingHorizontal: 16, paddingBottom: 40 },

  sectionHeader: { marginTop: 28, marginBottom: 10 },
  sectionCard: { borderRadius: RADIUS.lg, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.14, shadowRadius: 10, elevation: 5 },
  sectionCardContent: { padding: 0 },

  accentSwatch: { minWidth: 144 },
  accentSwatchContent: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 12 },
  accentDot: { width: 20, height: 20, borderRadius: 10, borderWidth: 2 },
  accentLabel: { fontSize: 13, fontWeight: '600' },

  serverRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  diagnosticsButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  serverText: { fontSize: 13, fontWeight: '500' },
  changeLink: {
    fontSize: 13,
    fontWeight: '700',
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1.5,
  },

  thresholdRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  thresholdInput: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, width: 70, fontSize: 14, fontWeight: '700', textAlign: 'center' },
  thresholdUnit: { fontSize: 13, fontWeight: '600' },

  dataButtons: { padding: 16, gap: 12 },
  dataHelperText: {
    fontSize: 12,
    lineHeight: 18,
    paddingHorizontal: 16,
    marginTop: -2,
    marginBottom: 10,
  },
  backgroundHelperText: {
    fontSize: 12,
    lineHeight: 18,
    paddingHorizontal: 16,
    marginTop: -2,
    marginBottom: 4,
  },
  dataButtonContent: { paddingVertical: 13, alignItems: 'center', justifyContent: 'center' },
  destructiveButton: { borderRadius: RADIUS.pill, borderWidth: 1.5, borderColor: COLORS.danger, backgroundColor: 'transparent', alignItems: 'center' },
  destructiveButtonText: { color: COLORS.danger, fontSize: 14, fontWeight: '700' },
  exportButton: { borderRadius: RADIUS.pill, borderWidth: 1.5, backgroundColor: 'transparent', alignItems: 'center' },
  exportButtonText: {
    fontSize: 14,
    fontWeight: '700',
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

  permissionHelperText: {
    fontSize: 12,
    lineHeight: 18,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 4,
  },
  permissionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  permissionTextColumn: {
    flex: 1,
    minWidth: 0,
  },
  permissionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  permissionLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  permissionDescription: {
    fontSize: 12,
    lineHeight: 17,
  },
  permissionStatusPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  permissionStatusText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  permissionButton: {
    minWidth: 92,
    borderWidth: 1.5,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 12,
    paddingVertical: 9,
    alignItems: 'center',
  },
  permissionButtonText: {
    fontSize: 12,
    fontWeight: '800',
  },
  permissionUnavailableBox: {
    padding: 16,
    gap: 6,
  },

  volumeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  volumeDot: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, backgroundColor: 'transparent' },
  volumeDotActive: {},
  volumeLabel: { fontSize: 12, fontWeight: '700', marginLeft: 4, minWidth: 36, textAlign: 'right' },

  versionText: { textAlign: 'center', fontSize: 11, marginTop: 32, letterSpacing: 1, fontWeight: '500' },
});

export default SettingsScreen;

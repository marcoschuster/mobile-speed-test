import React, { useState, useRef, useEffect } from 'react';
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
  Platform,
  LayoutAnimation,
  UIManager,
  LayoutChangeEvent,
} from 'react-native';
import SpeedTestService from '../services/SpeedTestService';
import SoundEngine from '../services/SoundEngine';
import FlashTitle from '../components/FlashTitle';
import ColorPickerWheel from '../components/ColorPickerWheel';
import LiquidGlass from '../components/LiquidGlass';
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
    <View style={[rowS.container, !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.separator }, { position: 'relative', overflow: 'hidden' }]}>
      <View style={[{ position: 'absolute', top: -10, right: -10, width: 80, height: 80, borderRadius: 999, opacity: 0.1, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 40, elevation: 0 }, { backgroundColor: t.accent }]} />
      <View style={[{ position: 'absolute', bottom: -8, left: -8, width: 64, height: 64, borderRadius: 999, opacity: 0.08, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 35, elevation: 0 }, { backgroundColor: t.uploadLine || t.accent }]} />
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

  const [autoBackground, setAutoBackground] = useState(false);
  const [testInterval, setTestInterval] = useState('1h');
  const [speedUnit, setSpeedUnit] = useState('mbps');
  const [showPing, setShowPing] = useState(true);
  const [notifyComplete, setNotifyComplete] = useState(false);
  const [alertThreshold, setAlertThreshold] = useState('');
  const [intervalOpen, setIntervalOpen] = useState(false);
  const [colorPickerVisible, setColorPickerVisible] = useState(false);

  // Sound & Haptics state
  const [sfxMuted, setSfxMuted] = useState(SoundEngine.muted);
  const [sfxVolume, setSfxVolume] = useState(SoundEngine.volume);
  const [hapticsOn, setHapticsOn] = useState(SoundEngine.hapticsEnabled);

  const contentFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(contentFade, { toValue: 1, duration: 300, useNativeDriver: false }).start();
  }, []);

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

  return (
    <Animated.ScrollView
      style={[styles.container, { opacity: contentFade }]}
      contentContainerStyle={styles.contentContainer}
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
        <SettingsRow label="Auto Background Test">
          <Switch
            value={autoBackground} onValueChange={() => handleToggle(autoBackground, setAutoBackground)}
            trackColor={{ false: t.switchTrackOff, true: t.accent }}
            thumbColor={autoBackground ? COLORS.white : t.switchThumbOff}
            ios_backgroundColor={t.switchTrackOff}
          />
        </SettingsRow>
        <SettingsRow label="Test Interval">
          <View style={{ width: 160 }}>
            <Dropdown
              options={[
                { label: 'Every 30 min', value: '30m' },
                { label: 'Every 1 hr', value: '1h' },
                { label: 'Every 3 hrs', value: '3h' },
                { label: 'Every 6 hrs', value: '6h' },
              ]}
              selected={testInterval} onSelect={setTestInterval}
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
              keyboardType="numeric" placeholder="—"
              placeholderTextColor={t.placeholderText} maxLength={5}
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

  volumeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  volumeDot: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, backgroundColor: 'transparent' },
  volumeDotActive: {},
  volumeLabel: { fontSize: 12, fontWeight: '700', marginLeft: 4, minWidth: 36, textAlign: 'right' },

  versionText: { textAlign: 'center', fontSize: 11, marginTop: 32, letterSpacing: 1, fontWeight: '500' },
});

export default SettingsScreen;

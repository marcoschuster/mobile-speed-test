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
} from 'react-native';
import SpeedTestService from '../services/SpeedTestService';
import { COLORS, RADIUS, useTheme } from '../utils/theme';

// ── Segmented Control ───────────────────────────────────────────────────────
const SegmentedControl = ({ options, selected, onSelect }) => {
  const { t } = useTheme();
  return (
    <View style={[segS.container, { backgroundColor: t.controlBg, borderColor: t.controlBorder }]}>
      {options.map((opt, i) => {
        const isActive = selected === opt.value;
        return (
          <TouchableOpacity
            key={opt.value}
            style={[
              segS.segment,
              isActive && segS.segmentActive,
              i === 0 && segS.segmentFirst,
              i === options.length - 1 && segS.segmentLast,
            ]}
            onPress={() => onSelect(opt.value)}
            activeOpacity={0.7}
          >
            <Text style={[segS.segmentText, { color: t.textSecondary }, isActive && segS.segmentTextActive]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const segS = StyleSheet.create({
  container: { flexDirection: 'row', borderRadius: 8, overflow: 'hidden', borderWidth: 1 },
  segment: { paddingVertical: 8, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', minWidth: 64 },
  segmentActive: { backgroundColor: COLORS.accent },
  segmentFirst: { borderTopLeftRadius: 7, borderBottomLeftRadius: 7 },
  segmentLast: { borderTopRightRadius: 7, borderBottomRightRadius: 7 },
  segmentText: { fontSize: 13, fontWeight: '700' },
  segmentTextActive: { color: COLORS.black },
});

// ── Dropdown ────────────────────────────────────────────────────────────────
const Dropdown = ({ options, selected, onSelect, isOpen, onToggle }) => {
  const { t } = useTheme();
  return (
    <View>
      <TouchableOpacity
        style={[dropS.trigger, { backgroundColor: t.controlBg, borderColor: t.controlBorder }]}
        onPress={onToggle} activeOpacity={0.7}
      >
        <Text style={[dropS.triggerText, { color: t.textPrimary }]}>
          {options.find((o) => o.value === selected)?.label || 'Select'}
        </Text>
        <Text style={[dropS.arrow, { color: t.textSecondary }]}>{isOpen ? '▲' : '▼'}</Text>
      </TouchableOpacity>
      {isOpen && (
        <View style={[dropS.menu, { backgroundColor: t.controlBg, borderColor: t.controlBorder }]}>
          {options.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[dropS.menuItem, { borderBottomColor: t.controlSepLight }, selected === opt.value && dropS.menuItemActive]}
              onPress={() => { onSelect(opt.value); onToggle(); }}
              activeOpacity={0.7}
            >
              <Text style={[dropS.menuItemText, { color: t.textSecondary }, selected === opt.value && dropS.menuItemTextActive]}>
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
  trigger: { flexDirection: 'row', alignItems: 'center', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1 },
  triggerText: { fontSize: 13, fontWeight: '600', flex: 1 },
  arrow: { fontSize: 10, marginLeft: 8 },
  menu: { marginTop: 4, borderRadius: 8, borderWidth: 1, overflow: 'hidden' },
  menuItem: { paddingVertical: 10, paddingHorizontal: 14, borderBottomWidth: 1 },
  menuItemActive: { backgroundColor: 'rgba(245,196,0,0.1)' },
  menuItemText: { fontSize: 13, fontWeight: '600' },
  menuItemTextActive: { color: COLORS.accent },
});

// ── Settings Row ────────────────────────────────────────────────────────────
const SettingsRow = ({ label, children, isLast }) => {
  const { t } = useTheme();
  return (
    <View style={[rowS.container, !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.separator }]}>
      <Text style={[rowS.label, { color: t.textPrimary }]}>{label}</Text>
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
  const { t, themeChoice, setThemeChoice } = useTheme();

  const [autoBackground, setAutoBackground] = useState(false);
  const [testInterval, setTestInterval] = useState('1h');
  const [speedUnit, setSpeedUnit] = useState('mbps');
  const [showPing, setShowPing] = useState(true);
  const [notifyComplete, setNotifyComplete] = useState(false);
  const [alertThreshold, setAlertThreshold] = useState('');
  const [intervalOpen, setIntervalOpen] = useState(false);

  const contentFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(contentFade, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }, []);

  const handleClearHistory = () => {
    Alert.alert('Clear Test History', 'This will permanently delete all speed test records. Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear All', style: 'destructive', onPress: async () => { await SpeedTestService.clearHistory(); Alert.alert('Done', 'Test history has been cleared.'); } },
    ]);
  };

  const handleExport = () => Alert.alert('Export', 'CSV export functionality coming soon.');

  return (
    <Animated.ScrollView
      style={[styles.container, { backgroundColor: t.bg, opacity: contentFade }]}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* APPEARANCE */}
      <Text style={styles.sectionHeader}>APPEARANCE</Text>
      <View style={[styles.sectionCard, { backgroundColor: t.surface, borderColor: t.glassBorder, borderTopColor: t.glassBorderTop }]}>
        <SettingsRow label="Theme">
          <SegmentedControl
            options={[
              { label: 'Light', value: 'light' },
              { label: 'Dark', value: 'dark' },
              { label: 'System', value: 'system' },
            ]}
            selected={themeChoice}
            onSelect={setThemeChoice}
          />
        </SettingsRow>
        <SettingsRow label="Accent Color" isLast>
          <View style={styles.accentSwatch}>
            <View style={styles.accentDot} />
            <Text style={[styles.accentLabel, { color: t.textSecondary }]}>Speed Yellow</Text>
          </View>
        </SettingsRow>
      </View>

      {/* TESTING */}
      <Text style={styles.sectionHeader}>TESTING</Text>
      <View style={[styles.sectionCard, { backgroundColor: t.surface, borderColor: t.glassBorder, borderTopColor: t.glassBorderTop }]}>
        <SettingsRow label="Auto Background Test">
          <Switch
            value={autoBackground} onValueChange={setAutoBackground}
            trackColor={{ false: t.switchTrackOff, true: COLORS.accent }}
            thumbColor={autoBackground ? COLORS.white : t.switchThumbOff}
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
            <Text style={[styles.serverText, { color: t.textSecondary }]}>Auto (Nearest)</Text>
            <TouchableOpacity activeOpacity={0.7}>
              <Text style={styles.changeLink}>Change</Text>
            </TouchableOpacity>
          </View>
        </SettingsRow>
      </View>

      {/* UNITS & DISPLAY */}
      <Text style={styles.sectionHeader}>UNITS & DISPLAY</Text>
      <View style={[styles.sectionCard, { backgroundColor: t.surface, borderColor: t.glassBorder, borderTopColor: t.glassBorderTop }]}>
        <SettingsRow label="Speed Unit">
          <SegmentedControl
            options={[
              { label: 'Mbps', value: 'mbps' },
              { label: 'Kbps', value: 'kbps' },
              { label: 'MB/s', value: 'mbs' },
            ]}
            selected={speedUnit} onSelect={setSpeedUnit}
          />
        </SettingsRow>
        <SettingsRow label="Show Ping" isLast>
          <Switch
            value={showPing} onValueChange={setShowPing}
            trackColor={{ false: t.switchTrackOff, true: COLORS.accent }}
            thumbColor={showPing ? COLORS.white : t.switchThumbOff}
          />
        </SettingsRow>
      </View>

      {/* NOTIFICATIONS */}
      <Text style={styles.sectionHeader}>NOTIFICATIONS</Text>
      <View style={[styles.sectionCard, { backgroundColor: t.surface, borderColor: t.glassBorder, borderTopColor: t.glassBorderTop }]}>
        <SettingsRow label="Notify on test complete">
          <Switch
            value={notifyComplete} onValueChange={setNotifyComplete}
            trackColor={{ false: t.switchTrackOff, true: COLORS.accent }}
            thumbColor={notifyComplete ? COLORS.white : t.switchThumbOff}
          />
        </SettingsRow>
        <SettingsRow label="Alert if speed below" isLast>
          <View style={styles.thresholdRow}>
            <TextInput
              style={[styles.thresholdInput, { backgroundColor: t.controlBg, borderColor: t.controlBorder, color: t.textPrimary }]}
              value={alertThreshold} onChangeText={setAlertThreshold}
              keyboardType="numeric" placeholder="—"
              placeholderTextColor={t.placeholderText} maxLength={5}
            />
            <Text style={[styles.thresholdUnit, { color: t.textSecondary }]}>Mbps</Text>
          </View>
        </SettingsRow>
      </View>

      {/* DATA */}
      <Text style={styles.sectionHeader}>DATA</Text>
      <View style={[styles.sectionCard, { backgroundColor: t.surface, borderColor: t.glassBorder, borderTopColor: t.glassBorderTop }]}>
        <View style={styles.dataButtons}>
          <TouchableOpacity style={styles.destructiveButton} onPress={handleClearHistory} activeOpacity={0.7}>
            <Text style={styles.destructiveButtonText}>Clear Test History</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.exportButton} onPress={handleExport} activeOpacity={0.7}>
            <Text style={styles.exportButtonText}>Export History as CSV</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Text style={[styles.versionText, { color: t.textMuted }]}>ZOLT v1.0.0</Text>
    </Animated.ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  contentContainer: { paddingHorizontal: 16, paddingBottom: 40 },

  sectionHeader: { fontSize: 11, fontWeight: '800', color: COLORS.accent, letterSpacing: 2, marginTop: 28, marginBottom: 8, marginLeft: 4 },
  sectionCard: { borderRadius: RADIUS.lg, overflow: 'hidden', borderWidth: 1 },

  accentSwatch: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  accentDot: { width: 20, height: 20, borderRadius: 10, backgroundColor: COLORS.accent, borderWidth: 2, borderColor: COLORS.accentDark },
  accentLabel: { fontSize: 13, fontWeight: '600' },

  serverRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  serverText: { fontSize: 13, fontWeight: '500' },
  changeLink: { fontSize: 13, color: COLORS.accent, fontWeight: '700' },

  thresholdRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  thresholdInput: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, width: 70, fontSize: 14, fontWeight: '700', textAlign: 'center' },
  thresholdUnit: { fontSize: 13, fontWeight: '600' },

  dataButtons: { padding: 16, gap: 12 },
  destructiveButton: { paddingVertical: 13, borderRadius: RADIUS.pill, borderWidth: 1.5, borderColor: COLORS.danger, backgroundColor: 'transparent', alignItems: 'center' },
  destructiveButtonText: { color: COLORS.danger, fontSize: 14, fontWeight: '700' },
  exportButton: { paddingVertical: 13, borderRadius: RADIUS.pill, borderWidth: 1.5, borderColor: COLORS.accent, backgroundColor: 'transparent', alignItems: 'center' },
  exportButtonText: { color: COLORS.accent, fontSize: 14, fontWeight: '700' },

  versionText: { textAlign: 'center', fontSize: 11, marginTop: 32, letterSpacing: 1, fontWeight: '500' },
});

export default SettingsScreen;

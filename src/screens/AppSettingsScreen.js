import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import LegalModal from '../components/LegalModal';
import FlashTitle from '../components/FlashTitle';
import { APP_NAME, APP_VERSION, TEST_PROVIDERS } from '../config/appInfo';
import { HISTORY_RETENTION_OPTIONS } from '../config/appSettings';
import { LEGAL_SECTIONS } from '../content/legal';
import { useAppSettings } from '../context/AppSettingsContext';
import SpeedTestService from '../services/SpeedTestService';
import SoundEngine from '../services/SoundEngine';
import { buildHistoryCsv } from '../utils/history';
import { COLORS, RADIUS, useTheme } from '../utils/theme';

const SegmentedControl = ({ options, selected, onSelect }) => {
  const { t } = useTheme();
  const isDark = t.mode === 'dark';
  const slideAnim = useRef(new Animated.Value(0)).current;
  const [segmentWidth, setSegmentWidth] = useState(0);

  const selectedIndex = options.findIndex((option) => option.value === selected);

  useEffect(() => {
    if (segmentWidth > 0) {
      Animated.spring(slideAnim, {
        toValue: selectedIndex * segmentWidth,
        tension: 300,
        friction: 25,
        useNativeDriver: false,
      }).start();
    }
  }, [segmentWidth, selectedIndex, slideAnim]);

  return (
    <View
      style={[segStyles.container, { backgroundColor: isDark ? '#2A2A2A' : '#E8E8E8' }]}
      onLayout={(event) => {
        const width = event.nativeEvent.layout.width;
        setSegmentWidth(width / options.length);
      }}
    >
      {segmentWidth > 0 && (
        <Animated.View
          style={[
            segStyles.indicator,
            {
              width: segmentWidth - 4,
              transform: [{ translateX: Animated.add(slideAnim, 2) }],
            },
          ]}
        />
      )}
      {options.map((option) => {
        const active = option.value === selected;
        return (
          <TouchableOpacity
            key={option.value}
            style={segStyles.segment}
            onPress={() => onSelect(option.value)}
            activeOpacity={0.7}
          >
            <Text style={[segStyles.segmentText, { color: isDark ? '#999' : '#777' }, active && segStyles.segmentTextActive]}>
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const segStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderRadius: 22,
    overflow: 'hidden',
    padding: 2,
    position: 'relative',
  },
  indicator: {
    position: 'absolute',
    top: 2,
    bottom: 2,
    backgroundColor: COLORS.accent,
    borderRadius: 20,
    zIndex: 0,
  },
  segment: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '700',
  },
  segmentTextActive: {
    color: COLORS.black,
    fontWeight: '800',
  },
});

const Dropdown = ({ options, selected, onSelect, isOpen, onToggle }) => {
  const { t } = useTheme();

  return (
    <View>
      <TouchableOpacity
        style={[dropStyles.trigger, { backgroundColor: t.controlBg, borderColor: t.controlBorder }]}
        onPress={onToggle}
        activeOpacity={0.7}
      >
        <Text style={[dropStyles.triggerText, { color: t.textPrimary }]}>
          {options.find((option) => option.value === selected)?.label || 'Select'}
        </Text>
        <Text style={[dropStyles.arrow, { color: t.textSecondary }]}>{isOpen ? '▲' : '▼'}</Text>
      </TouchableOpacity>
      {isOpen && (
        <View style={[dropStyles.menu, { backgroundColor: t.controlBg, borderColor: t.controlBorder }]}>
          {options.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[
                dropStyles.menuItem,
                { borderBottomColor: t.controlSepLight },
                option.value === selected && dropStyles.menuItemActive,
              ]}
              onPress={() => {
                onSelect(option.value);
                onToggle();
              }}
              activeOpacity={0.7}
            >
              <Text style={[dropStyles.menuItemText, { color: t.textSecondary }, option.value === selected && dropStyles.menuItemTextActive]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
};

const dropStyles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
  },
  triggerText: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  arrow: {
    fontSize: 10,
    marginLeft: 8,
  },
  menu: {
    marginTop: 4,
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
  },
  menuItem: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
  },
  menuItemActive: {
    backgroundColor: 'rgba(245,196,0,0.1)',
  },
  menuItemText: {
    fontSize: 13,
    fontWeight: '600',
  },
  menuItemTextActive: {
    color: COLORS.accent,
  },
});

const SettingsRow = ({ label, children, isLast }) => {
  const { t } = useTheme();

  return (
    <View style={[styles.row, !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.separator }]}>
      <Text style={[styles.rowLabel, { color: t.textPrimary }]}>{label}</Text>
      <View style={styles.rowRight}>{children}</View>
    </View>
  );
};

const ActionButton = ({ text, onPress, danger = false }) => (
  <TouchableOpacity
    style={[styles.actionButton, danger ? styles.actionButtonDanger : styles.actionButtonDefault]}
    onPress={onPress}
    activeOpacity={0.7}
  >
    <Text style={[styles.actionButtonText, danger ? styles.actionButtonDangerText : styles.actionButtonDefaultText]}>
      {text}
    </Text>
  </TouchableOpacity>
);

const AppSettingsScreen = () => {
  const { t, themeChoice, setThemeChoice } = useTheme();
  const { settings, updateSettings, resetSettings } = useAppSettings();
  const [historyCount, setHistoryCount] = useState(0);
  const [retentionOpen, setRetentionOpen] = useState(false);
  const [legalVisible, setLegalVisible] = useState(false);
  const [selectedLegalKey, setSelectedLegalKey] = useState('privacy');
  const [sfxMuted, setSfxMuted] = useState(SoundEngine.muted);
  const [sfxVolume, setSfxVolume] = useState(SoundEngine.volume);
  const [hapticsOn, setHapticsOn] = useState(SoundEngine.hapticsEnabled);
  const contentFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(contentFade, { toValue: 1, duration: 300, useNativeDriver: false }).start();
    loadHistoryCount();
  }, [contentFade]);

  const loadHistoryCount = async () => {
    const history = await SpeedTestService.getHistory();
    setHistoryCount(history.length);
  };

  const openLegalSection = (key) => {
    setSelectedLegalKey(key);
    setLegalVisible(true);
  };

  const handleRetentionChange = async (value) => {
    await updateSettings({ historyRetentionDays: value });
    await loadHistoryCount();
  };

  const handleExportHistory = async () => {
    const history = await SpeedTestService.getHistory();
    if (!history.length) {
      Alert.alert('No history', 'Run a speed test before exporting history.');
      return;
    }

    try {
      await Share.share({
        title: `${APP_NAME} speed history`,
        message: buildHistoryCsv(history),
      });
    } catch (error) {
      Alert.alert('Export failed', 'Could not open the share sheet on this device.');
    }
  };

  const handleClearHistory = () => {
    Alert.alert('Clear test history', 'This will permanently delete all saved speed tests on this device.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await SpeedTestService.clearHistory();
          await loadHistoryCount();
          Alert.alert('Done', 'Saved speed test history has been removed.');
        },
      },
    ]);
  };

  const handleResetAll = () => {
    Alert.alert('Reset local app data', 'This clears history, peaks, and app preferences stored on this device.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: async () => {
          await SpeedTestService.clearHistory();
          await SpeedTestService.clearPeaks();
          await resetSettings();
          setThemeChoice('dark');
          SoundEngine.muted = false;
          SoundEngine.volume = 0.7;
          SoundEngine.hapticsEnabled = true;
          setSfxMuted(false);
          setSfxVolume(0.7);
          setHapticsOn(true);
          await loadHistoryCount();
          Alert.alert('Reset complete', 'Local app data and preferences were reset.');
        },
      },
    ]);
  };

  return (
    <Animated.ScrollView
      style={[styles.container, { backgroundColor: t.bg, opacity: contentFade }]}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      <FlashTitle text="APPEARANCE" size="small" interval={5000} center style={styles.sectionHeader} />
      <View style={[styles.sectionCard, { backgroundColor: t.surface }]}>
        <SettingsRow label="Theme" isLast>
          <View style={{ width: 220 }}>
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
      </View>

      <FlashTitle text="MEASUREMENT" size="small" interval={5300} center style={styles.sectionHeader} />
      <View style={[styles.sectionCard, { backgroundColor: t.surface }]}>
        <SettingsRow label="Speed unit">
          <View style={{ width: 220 }}>
            <SegmentedControl
              options={[
                { label: 'Mbps', value: 'mbps' },
                { label: 'Kbps', value: 'kbps' },
                { label: 'MB/s', value: 'mbs' },
              ]}
              selected={settings.speedUnit}
              onSelect={(value) => updateSettings({ speedUnit: value })}
            />
          </View>
        </SettingsRow>
        <SettingsRow label="Show Ping" isLast>
          <Switch
            value={settings.showPing}
            onValueChange={(value) => updateSettings({ showPing: value })}
            trackColor={{ false: t.switchTrackOff, true: COLORS.accent }}
            thumbColor={settings.showPing ? COLORS.white : t.switchThumbOff}
            ios_backgroundColor={t.switchTrackOff}
          />
        </SettingsRow>
        <SettingsRow label="History retention" isLast>
          <View style={{ width: 180 }}>
            <Dropdown
              options={HISTORY_RETENTION_OPTIONS}
              selected={settings.historyRetentionDays}
              onSelect={handleRetentionChange}
              isOpen={retentionOpen}
              onToggle={() => setRetentionOpen(!retentionOpen)}
            />
          </View>
        </SettingsRow>
      </View>

      <FlashTitle text="SOUND & HAPTICS" size="small" interval={5600} center style={styles.sectionHeader} />
      <View style={[styles.sectionCard, { backgroundColor: t.surface }]}>
        <SettingsRow label="Sound effects">
          <Switch
            value={!sfxMuted}
            onValueChange={() => {
              const nextMuted = !sfxMuted;
              setSfxMuted(nextMuted);
              SoundEngine.muted = nextMuted;
              if (!nextMuted) SoundEngine.playToggleOn();
            }}
            trackColor={{ false: t.switchTrackOff, true: COLORS.accent }}
            thumbColor={!sfxMuted ? COLORS.white : t.switchThumbOff}
            ios_backgroundColor={t.switchTrackOff}
          />
        </SettingsRow>
        <SettingsRow label="Master volume">
          <View style={styles.volumeRow}>
            {[0.25, 0.5, 0.75, 1].map((value) => (
              <TouchableOpacity
                key={value}
                style={[styles.volumeDot, sfxVolume >= value && styles.volumeDotActive]}
                onPress={() => {
                  setSfxVolume(value);
                  SoundEngine.volume = value;
                  SoundEngine.playNavTick();
                }}
                activeOpacity={0.7}
              />
            ))}
            <Text style={[styles.volumeLabel, { color: t.textSecondary }]}>{Math.round(sfxVolume * 100)}%</Text>
          </View>
        </SettingsRow>
        <SettingsRow label="Haptic feedback" isLast>
          <Switch
            value={hapticsOn}
            onValueChange={(value) => {
              setHapticsOn(value);
              SoundEngine.hapticsEnabled = value;
              if (value) SoundEngine.playToggleOn();
            }}
            trackColor={{ false: t.switchTrackOff, true: COLORS.accent }}
            thumbColor={hapticsOn ? COLORS.white : t.switchThumbOff}
            ios_backgroundColor={t.switchTrackOff}
          />
        </SettingsRow>
      </View>

      <FlashTitle text="DATA & PRIVACY" size="small" interval={5900} center style={styles.sectionHeader} />
      <View style={[styles.sectionCard, { backgroundColor: t.surface }]}>
        <SettingsRow label="Disclosure status">
          <View style={[styles.statusPill, settings.dataDisclosureAccepted ? styles.statusAccepted : styles.statusPending]}>
            <Text style={[styles.statusPillText, settings.dataDisclosureAccepted ? styles.statusAcceptedText : styles.statusPendingText]}>
              {settings.dataDisclosureAccepted ? 'Accepted' : 'Pending'}
            </Text>
          </View>
        </SettingsRow>
        <SettingsRow label="Saved tests">
          <Text style={[styles.infoText, { color: t.textSecondary }]}>{historyCount}</Text>
        </SettingsRow>
        <SettingsRow label="Privacy documents" isLast>
          <TouchableOpacity onPress={() => openLegalSection('privacy')} activeOpacity={0.7}>
            <Text style={styles.linkText}>Open</Text>
          </TouchableOpacity>
        </SettingsRow>
        <View style={styles.buttonGroup}>
          <ActionButton text="Export history as CSV" onPress={handleExportHistory} />
          <ActionButton text="Clear saved history" onPress={handleClearHistory} danger />
          <ActionButton text="Reset all local data" onPress={handleResetAll} danger />
        </View>
      </View>

      <FlashTitle text="LEGAL" size="small" interval={6200} center style={styles.sectionHeader} />
      <View style={[styles.sectionCard, { backgroundColor: t.surface }]}>
        <View style={styles.buttonGroup}>
          <ActionButton text="Privacy policy" onPress={() => openLegalSection('privacy')} />
          <ActionButton text="Terms of use" onPress={() => openLegalSection('terms')} />
          <ActionButton text="Data practices" onPress={() => openLegalSection('data')} />
        </View>
      </View>

      <FlashTitle text="ABOUT" size="small" interval={6500} center style={styles.sectionHeader} />
      <View style={[styles.sectionCard, { backgroundColor: t.surface }]}>
        <View style={styles.aboutContent}>
          <Text style={[styles.aboutTitle, { color: t.textPrimary }]}>{APP_NAME} v{APP_VERSION}</Text>
          <Text style={[styles.aboutText, { color: t.textSecondary }]}>
            Speed results, preferences, and disclosure status stay on-device in this codebase.
          </Text>
          <Text style={[styles.aboutText, { color: t.textSecondary }]}>
            Test providers: {TEST_PROVIDERS.join(', ')}.
          </Text>
        </View>
      </View>

      <LegalModal
        visible={legalVisible}
        selectedKey={selectedLegalKey}
        sections={LEGAL_SECTIONS}
        onClose={() => setLegalVisible(false)}
        onSelect={setSelectedLegalKey}
      />
    </Animated.ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  contentContainer: { paddingHorizontal: 16, paddingBottom: 40 },
  sectionHeader: { marginTop: 28, marginBottom: 10 },
  sectionCard: {
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 10,
    elevation: 5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    minHeight: 48,
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
  },
  rowRight: {
    flexShrink: 0,
    alignItems: 'flex-end',
  },
  buttonGroup: {
    padding: 16,
    gap: 12,
  },
  actionButton: {
    paddingVertical: 13,
    borderRadius: RADIUS.pill,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  actionButtonDefault: {
    borderColor: COLORS.accent,
    backgroundColor: 'transparent',
  },
  actionButtonDanger: {
    borderColor: COLORS.danger,
    backgroundColor: 'transparent',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  actionButtonDefaultText: {
    color: COLORS.accent,
  },
  actionButtonDangerText: {
    color: COLORS.danger,
  },
  statusPill: {
    borderRadius: RADIUS.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  statusAccepted: {
    backgroundColor: 'rgba(0, 196, 140, 0.14)',
  },
  statusPending: {
    backgroundColor: 'rgba(245, 196, 0, 0.14)',
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  statusAcceptedText: {
    color: COLORS.success,
  },
  statusPendingText: {
    color: COLORS.accent,
  },
  infoText: {
    fontSize: 13,
    fontWeight: '600',
  },
  linkText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.accent,
  },
  volumeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  volumeDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: COLORS.accent,
    backgroundColor: 'transparent',
  },
  volumeDotActive: {
    backgroundColor: COLORS.accent,
  },
  volumeLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 4,
    minWidth: 36,
    textAlign: 'right',
  },
  aboutContent: {
    padding: 16,
    gap: 8,
  },
  aboutTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  aboutText: {
    fontSize: 13,
    lineHeight: 20,
  },
});

export default AppSettingsScreen;

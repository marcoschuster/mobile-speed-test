import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Alert, Animated, Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import Speedometer from '../components/Speedometer';
import StatCard from '../components/StatCard';
import FlashTitle from '../components/FlashTitle';
import SpeedTestService from '../services/SpeedTestService';
import SoundEngine from '../services/SoundEngine';
import { COLORS, RADIUS, SHADOWS, useTheme } from '../utils/theme';
import { getConnectionQuality } from '../utils/measurements';

// ── Type Definitions ─────────────────────────────────────────────────────────
interface IntervalOption {
  key: string;
  label: string;
  ms: number;
}

interface AnimatedButtonProps {
  onPress: () => void;
  style: any;
  textStyle: any;
  children: React.ReactNode;
  disabled?: boolean;
  glowing?: boolean;
}

interface InsightCardProps {
  title: string;
  value: string;
  subtitle: string;
}

const INTERVALS: IntervalOption[] = [
  { key: '30m', label: '30m', ms: 30 * 60 * 1000 },
  { key: '1h', label: '1h', ms: 60 * 60 * 1000 },
  { key: '3h', label: '3h', ms: 3 * 60 * 60 * 1000 },
  { key: '6h', label: '6h', ms: 6 * 60 * 60 * 1000 },
  { key: '12h', label: '12h', ms: 12 * 60 * 60 * 1000 },
  { key: '24h', label: '24h', ms: 24 * 60 * 60 * 1000 },
];

const AnimatedButton = ({ onPress, style, textStyle, children, disabled, glowing }: AnimatedButtonProps) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const handleIn = () => Animated.spring(scaleAnim, { toValue: 0.96, tension: 300, friction: 10, useNativeDriver: false }).start();
  const handleOut = () => Animated.spring(scaleAnim, { toValue: 1, tension: 200, friction: 8, useNativeDriver: false }).start();

  useEffect(() => {
    if (glowing) {
      const pulse = Animated.loop(Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 1000, useNativeDriver: false }),
        Animated.timing(glowAnim, { toValue: 0, duration: 1000, useNativeDriver: false }),
      ]));
      pulse.start();
      return () => pulse.stop();
    } else { glowAnim.setValue(0); }
  }, [glowing]);

  const glowShadowOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.7] });
  const glowShadowRadius = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 28] });

  const { t } = useTheme();

  return (
    <TouchableOpacity activeOpacity={1} onPress={onPress} onPressIn={handleIn} onPressOut={handleOut} disabled={disabled}>
      <Animated.View style={[
        glowing ? { shadowColor: t.accent, shadowOffset: { width: 0, height: 0 }, shadowOpacity: glowShadowOpacity, shadowRadius: glowShadowRadius, elevation: 12, borderRadius: RADIUS.pill } : null,
      ]}>
        <Animated.View style={[style, { transform: [{ scale: scaleAnim }] }]}>
          <Text style={textStyle}>{children}</Text>
        </Animated.View>
      </Animated.View>
    </TouchableOpacity>
  );
};

const InsightCard = ({ title, value, subtitle }: InsightCardProps) => {
  const { t } = useTheme();

  return (
    <View style={[styles.insightCard, { backgroundColor: t.surface }]}>
      <View style={[styles.insightTint, { backgroundColor: t.accentTintSoft }]} />
      <Text style={[styles.insightTitle, { color: t.textMuted }]}>{title}</Text>
      <Text style={[styles.insightValue, { color: t.textPrimary }]}>{value}</Text>
      <Text style={[styles.insightSubtitle, { color: t.textSecondary }]}>{subtitle}</Text>
    </View>
  );
};

const SpeedTestScreen = () => {
  const { t } = useTheme();
  const [isTestRunning, setIsTestRunning] = useState(false);
  const [currentType, setCurrentType] = useState('Ready');
  const [downloadSpeed, setDownloadSpeed] = useState(0);
  const [uploadSpeed, setUploadSpeed] = useState(0);
  const [ping, setPing] = useState(0);
  const [liveDownload, setLiveDownload] = useState(0);
  const [liveUpload, setLiveUpload] = useState(0);
  const [livePing, setLivePing] = useState(0);
  const [backgroundMode, setBackgroundMode] = useState(false);
  const [backgroundInterval, setBackgroundInterval] = useState<string | null>(null);
  const [showIntervalOptions, setShowIntervalOptions] = useState(false);
  const [progressText, setProgressText] = useState('');
  const backgroundTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const liveSpeedRef = useRef(0);
  const gaugeWhirRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const contentFade = useRef(new Animated.Value(1)).current;
  const autoFloatAnim = useRef(new Animated.Value(0)).current;
  const shareFloatAnim = useRef(new Animated.Value(0)).current;
  const startFloatAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    contentFade.setValue(0);
    Animated.timing(contentFade, { toValue: 1, duration: 400, useNativeDriver: false }).start();
    
    // Floating animation for auto button
    const autoFloat = Animated.loop(Animated.sequence([
      Animated.timing(autoFloatAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
      Animated.timing(autoFloatAnim, { toValue: 0, duration: 2000, useNativeDriver: true }),
    ]));
    autoFloat.start();
    
    // Floating animation for share button (offset timing)
    const shareFloat = Animated.loop(Animated.sequence([
      Animated.timing(shareFloatAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
      Animated.timing(shareFloatAnim, { toValue: 0, duration: 2000, useNativeDriver: true }),
    ]));
    shareFloat.start();
    
    // Floating animation for start button
    const startFloat = Animated.loop(Animated.sequence([
      Animated.timing(startFloatAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
      Animated.timing(startFloatAnim, { toValue: 0, duration: 2000, useNativeDriver: true }),
    ]));
    startFloat.start();
    
    return () => {
      if (backgroundTimerRef.current) clearInterval(backgroundTimerRef.current);
      if (gaugeWhirRef.current) clearInterval(gaugeWhirRef.current);
      autoFloat.stop();
      shareFloat.stop();
      startFloat.stop();
    };
  }, []);

  const runTest = async () => {
    setIsTestRunning(true); setCurrentType('Testing');
    setDownloadSpeed(0); setUploadSpeed(0); setPing(0);
    setLiveDownload(0); setLiveUpload(0); setLivePing(0);

    // Start gauge whir sound — periodic grain tied to live speed ref
    liveSpeedRef.current = 0;
    let lastWhirProgress = 0;
    gaugeWhirRef.current = setInterval(() => {
      const maxVal = 200;
      const progress = Math.min(liveSpeedRef.current / maxVal, 1);
      if (progress > 0.01 && Math.abs(progress - lastWhirProgress) > 0.02) {
        SoundEngine.playGaugeWhir(progress);
        lastWhirProgress = progress;
      }
    }, 350);

    await SpeedTestService.runSpeedTest(
      (progress: string, type: string) => {
        setProgressText(progress);
        if (type === 'ping') setCurrentType('Ping');
        else if (type === 'download') setCurrentType('Download');
        else if (type === 'upload') setCurrentType('Upload');
      },
      (speed: number, type: string) => {
        liveSpeedRef.current = speed; // keep ref fresh for gauge whir
        if (type === 'download') setLiveDownload(speed);
        else if (type === 'upload') setLiveUpload(speed);
      },
      async (result: any) => {
        if (gaugeWhirRef.current) { clearInterval(gaugeWhirRef.current); gaugeWhirRef.current = null; }
        setDownloadSpeed(result.download); setUploadSpeed(result.upload); setPing(result.ping);
        setLivePing(result.ping); setLiveDownload(result.download); setLiveUpload(result.upload);
        setCurrentType('Complete');
        SoundEngine.playTestComplete();
        setTimeout(() => { setIsTestRunning(false); setCurrentType('Ready'); setProgressText(''); setLiveDownload(0); setLiveUpload(0); setLivePing(0); }, 4000);
      },
      (error: string) => {
        if (gaugeWhirRef.current) { clearInterval(gaugeWhirRef.current); gaugeWhirRef.current = null; }
        Alert.alert('Test Failed', error); setIsTestRunning(false); setCurrentType('Error'); setProgressText(''); setLiveDownload(0); setLiveUpload(0); setLivePing(0);
      },
      (pingSample: number) => { setLivePing(pingSample); },
      (type: string, value: number) => {
        // Show result instantly when each phase completes + play sound
        SoundEngine.playPhaseComplete();
        if (type === 'ping') setPing(value);
        else if (type === 'download') setDownloadSpeed(value);
        else if (type === 'upload') setUploadSpeed(value);
      }
    );
  };

  const startTest = () => { SoundEngine.playStartTest(); runTest(); };
  const stopTest = () => {
    if (gaugeWhirRef.current) { clearInterval(gaugeWhirRef.current); gaugeWhirRef.current = null; }
    SpeedTestService.stopTest(); setIsTestRunning(false); setCurrentType('Ready'); setProgressText(''); setLiveDownload(0); setLiveUpload(0); setLivePing(0);
  };

  const toggleBackgroundMode = () => {
    if (backgroundMode) {
      if (backgroundTimerRef.current) { clearInterval(backgroundTimerRef.current); backgroundTimerRef.current = null; }
      setBackgroundMode(false); setBackgroundInterval(null); setShowIntervalOptions(false);
      Alert.alert('Background Testing', 'Background testing disabled.');
    } else { setShowIntervalOptions(!showIntervalOptions); }
  };

  const selectInterval = (interval: IntervalOption) => {
    if (interval.key === 'disabled') {
      if (backgroundTimerRef.current) { clearInterval(backgroundTimerRef.current); backgroundTimerRef.current = null; }
      setBackgroundInterval(null); setBackgroundMode(false);
      Alert.alert('Background Testing', 'Disabled', [{ text: 'OK' }]);
    } else {
      if (backgroundTimerRef.current) { clearInterval(backgroundTimerRef.current); backgroundTimerRef.current = null; }
      setBackgroundInterval(interval.key); setBackgroundMode(true);
      backgroundTimerRef.current = setInterval(() => { if (!SpeedTestService.isTestRunning) runTest(); }, interval.ms);
      Alert.alert('Background Testing', 'Enabled \u2014 every ' + interval.label, [{ text: 'OK' }]);
    }
  };

  const getIntervalLabel = (): string => { if (!backgroundInterval) return ''; const found = INTERVALS.find((i) => i.key === backgroundInterval); return found ? found.label : ''; };

  const getNeedleColor = (): string => {
    switch (currentType) {
      case 'Download': return t.accent;
      case 'Upload': return t.uploadLine;
      case 'Ping': return COLORS.success;
      case 'Complete': return t.accent;
      default: return t.accent;
    }
  };

  const getSpeedValue = (): number => {
    switch (currentType) {
      case 'Download': return liveDownload; case 'Upload': return liveUpload;
      case 'Ping': return livePing; case 'Complete': return downloadSpeed; default: return 0;
    }
  };
  const getMaxValue = (): number => currentType === 'Ping' ? 1500 : 200;
  const getSpeedLabel = (): string => {
    switch (currentType) {
      case 'Download': return 'DOWNLOAD'; case 'Upload': return 'UPLOAD'; case 'Ping': return 'PING';
      case 'Complete': return 'COMPLETE'; case 'Testing': return 'CONNECTING'; default: return '';
    }
  };
  const getSpeedUnit = (): string => currentType === 'Ping' ? 'ms' : 'Mbps';

  const connectionQuality = getConnectionQuality({ download: downloadSpeed, upload: uploadSpeed, ping });

  return (
    <View style={[styles.container, { backgroundColor: t.bg }]}>
      <Animated.ScrollView style={{ opacity: contentFade }} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.speedoWrap}>
          <Speedometer speed={getSpeedValue()} maxValue={getMaxValue()} label={getSpeedLabel()} unit={getSpeedUnit()} needleColor={getNeedleColor()} isRunning={isTestRunning} onStart={startTest} />
        </View>
        <View style={styles.controls}>
          <View style={styles.primaryControlsRow}>
            {isTestRunning && (
              <Animated.View style={{ transform: [{ translateY: startFloatAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -5] }) }] }}>
                <AnimatedButton onPress={stopTest} style={[styles.runningButton, { backgroundColor: t.accent, borderColor: t.accent, shadowColor: t.accent }]} textStyle={[styles.runningButtonText, { color: t.buttonText }]} glowing>Stop Test</AnimatedButton>
              </Animated.View>
            )}
          </View>
        </View>
        {showIntervalOptions && (
          <View style={[styles.intervalBox, { backgroundColor: t.surface }]}>
            <View style={styles.intervalTitleWrap}>
              <Text style={[styles.intervalTitle, { color: t.textPrimary }]}>SELECT INTERVAL</Text>
            </View>
            <View style={styles.intervalGrid}>
              <TouchableOpacity key="disabled" style={[styles.intervalBtn, { borderColor: t.accent }, backgroundInterval === null && [styles.intervalBtnActive, { backgroundColor: t.accent }]]} onPress={() => selectInterval({ key: 'disabled', label: 'X', ms: 0 })} activeOpacity={0.7}>
                <Text style={[styles.intervalBtnText, backgroundInterval === null && [styles.intervalBtnTextActive, { color: COLORS.black }]]}>X</Text>
              </TouchableOpacity>
              {INTERVALS.map((iv) => (
                <TouchableOpacity key={iv.key} style={[styles.intervalBtn, { borderColor: t.accent }, backgroundInterval === iv.key && [styles.intervalBtnActive, { backgroundColor: t.accent }]]} onPress={() => selectInterval(iv)} activeOpacity={0.7}>
                  <Text style={[styles.intervalBtnText, backgroundInterval === iv.key && [styles.intervalBtnTextActive, { color: COLORS.black }]]}>{iv.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
        {progressText && <Text style={[styles.progressText, { color: t.textMuted, textShadowColor: 'rgba(0, 0, 0, 0.2)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 1.5 }]}>{progressText}</Text>}
        <View style={styles.statsGrid}>
          <StatCard label="Download" value={downloadSpeed} activePhase={currentType} />
          <StatCard label="Upload" value={uploadSpeed} activePhase={currentType} />
          <StatCard label="Ping" value={ping} unit="ms" activePhase={currentType} />
        </View>
        <View style={styles.insightsWrap}>
          <InsightCard title="Connection Quality" value={connectionQuality.label} subtitle={connectionQuality.summary} />
          <InsightCard title="Last Test Traffic" value="0 MB" subtitle="Download + upload payload used by the latest completed test" />
          <InsightCard title="Server Used" value="Automatic" subtitle="The app automatically picks the best available endpoint" />
        </View>

        <View style={styles.bottomButtonsRow}>
          <TouchableOpacity
            style={[styles.bottomButton, { borderColor: t.accent }]}
            onPress={toggleBackgroundMode}
            activeOpacity={0.7}
          >
            <Text style={[styles.bottomButtonText, { color: t.accent }]}>Auto</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.bottomButton, { borderColor: t.accent }]}
            onPress={() => {}}
            activeOpacity={0.7}
          >
            <View style={styles.bottomButtonContent}>
              <MaterialIcons name="share" size={24} color={t.accent} />
              <Text style={[styles.bottomButtonText, { color: t.accent }]}>Share</Text>
            </View>
          </TouchableOpacity>
        </View>
      </Animated.ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, alignItems: 'center', paddingBottom: 40, zIndex: 2 },
  speedoWrap: { marginTop: 0, marginBottom: 4, alignItems: 'center' },
  progressText: { fontSize: 12, fontStyle: 'italic', marginBottom: 8, letterSpacing: 0.5, fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif' },
  statsGrid: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginVertical: 16 },
  controls: { alignItems: 'center', marginVertical: 8, width: '100%' },
  primaryControlsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', width: '100%' },
  mergedButtonGroup: { flexDirection: 'row', alignItems: 'center' },
  mergedButtonContainer: { flexDirection: 'row', flex: 1 },
  autoButton: { paddingVertical: 16, paddingHorizontal: 16, borderTopLeftRadius: RADIUS.pill, borderBottomLeftRadius: RADIUS.pill, backgroundColor: 'transparent', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 4 },
  autoButtonActive: {},
  autoButtonText: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1.5,
  },
  autoButtonTextActive: { color: COLORS.black },
  shareButton: { paddingVertical: 16, paddingHorizontal: 16, borderRadius: RADIUS.pill, borderWidth: 0, backgroundColor: 'transparent', width: 60, alignItems: 'center', justifyContent: 'center', marginLeft: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 4 },
  startButton: {
    paddingVertical: 16, paddingHorizontal: 40,
    borderRadius: RADIUS.pill, ...SHADOWS.button, borderWidth: 1.5, marginLeft: 10,
  },
  startButtonText: { fontSize: 16, fontWeight: '800', letterSpacing: 1, fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif' },
  runningButton: {
    paddingVertical: 16, paddingHorizontal: 40,
    borderRadius: RADIUS.pill,
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 8, borderWidth: 1.5, marginLeft: 10,
  },
  runningButtonText: { fontSize: 16, fontWeight: '800', letterSpacing: 1, fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif' },
  bgButton: { paddingVertical: 11, paddingHorizontal: 28, borderRadius: RADIUS.pill, borderWidth: 1.5, backgroundColor: 'transparent' },
  bgButtonActive: {},
  bgButtonText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1.5,
  },
  bgButtonTextActive: { color: COLORS.black },
  intervalBox: { marginTop: 16, width: '100%', borderRadius: RADIUS.lg, padding: 18, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 4 },
  intervalTitleWrap: { alignItems: 'center', marginBottom: 14 },
  intervalTitle: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.2, fontWeight: '700', color: '#666' },
  intervalGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10 },
  intervalBtn: { paddingVertical: 14, paddingHorizontal: 24, borderRadius: RADIUS.pill, borderWidth: 1, backgroundColor: 'transparent', minWidth: 60, alignItems: 'center' },
  intervalBtnActive: {},
  intervalBtnText: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1.5,
  },
  intervalBtnTextActive: { color: COLORS.black },
  insightsWrap: { width: '100%', marginTop: 20, gap: 12 },
  insightCard: { borderRadius: RADIUS.lg, padding: 16, overflow: 'visible', ...SHADOWS.clayCard },
  insightTint: { ...StyleSheet.absoluteFillObject },
  insightTitle: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.2, fontWeight: '700', marginBottom: 6 },
  insightValue: { fontSize: 21, fontWeight: '800', marginBottom: 6 },
  insightSubtitle: { fontSize: 13, lineHeight: 19 },
  bottomButtonsRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
    marginTop: 20,
    marginBottom: 20,
  },
  bottomButton: {
    flex: 1,
    height: 56,
    borderRadius: RADIUS.pill,
    backgroundColor: 'transparent',
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bottomButtonText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  },
});

export default SpeedTestScreen;

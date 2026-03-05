import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Alert, Animated, Platform,
} from 'react-native';
import Speedometer from '../components/Speedometer';
import StatCard from '../components/StatCard';
import FlashTitle from '../components/FlashTitle';
import SpeedTestService from '../services/SpeedTestService';
import { COLORS, RADIUS, SHADOWS, useTheme } from '../utils/theme';

const INTERVALS = [
  { key: '30m', label: '30 min', ms: 30 * 60 * 1000 },
  { key: '1h', label: '1 h', ms: 60 * 60 * 1000 },
  { key: '3h', label: '3 h', ms: 3 * 60 * 60 * 1000 },
  { key: '6h', label: '6 h', ms: 6 * 60 * 60 * 1000 },
  { key: '12h', label: '12 h', ms: 12 * 60 * 60 * 1000 },
  { key: '24h', label: '24 h', ms: 24 * 60 * 60 * 1000 },
];

const AnimatedButton = ({ onPress, style, textStyle, children, disabled, glowing }) => {
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

  const glowShadowRadius = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 28] });
  const glowShadowOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.7] });

  return (
    <TouchableOpacity activeOpacity={1} onPress={onPress} onPressIn={handleIn} onPressOut={handleOut} disabled={disabled}>
      <Animated.View style={[
        glowing ? { shadowColor: COLORS.accent, shadowOffset: { width: 0, height: 0 }, shadowOpacity: glowShadowOpacity, shadowRadius: glowShadowRadius, elevation: 12, borderRadius: RADIUS.pill } : null,
      ]}>
        <Animated.View style={[style, { transform: [{ scale: scaleAnim }] }]}>
          <Text style={textStyle}>{children}</Text>
        </Animated.View>
      </Animated.View>
    </TouchableOpacity>
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
  const [backgroundInterval, setBackgroundInterval] = useState(null);
  const [showIntervalOptions, setShowIntervalOptions] = useState(false);
  const [progressText, setProgressText] = useState('');
  const backgroundTimerRef = useRef(null);
  const contentFade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    contentFade.setValue(0);
    Animated.timing(contentFade, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    return () => { if (backgroundTimerRef.current) clearInterval(backgroundTimerRef.current); };
  }, []);

  const runTest = async () => {
    setIsTestRunning(true); setCurrentType('Testing');
    setDownloadSpeed(0); setUploadSpeed(0); setPing(0);
    setLiveDownload(0); setLiveUpload(0); setLivePing(0);
    await SpeedTestService.runSpeedTest(
      (progress, type) => {
        setProgressText(progress);
        if (type === 'ping') setCurrentType('Ping');
        else if (type === 'download') setCurrentType('Download');
        else if (type === 'upload') setCurrentType('Upload');
      },
      (speed, type) => { if (type === 'download') setLiveDownload(speed); else if (type === 'upload') setLiveUpload(speed); },
      async (result) => {
        setDownloadSpeed(result.download); setUploadSpeed(result.upload); setPing(result.ping);
        setLivePing(result.ping); setLiveDownload(result.download); setLiveUpload(result.upload);
        setCurrentType('Complete');
        setTimeout(() => { setIsTestRunning(false); setCurrentType('Ready'); setProgressText(''); setLiveDownload(0); setLiveUpload(0); setLivePing(0); }, 4000);
      },
      (error) => { Alert.alert('Test Failed', error); setIsTestRunning(false); setCurrentType('Error'); setProgressText(''); setLiveDownload(0); setLiveUpload(0); setLivePing(0); },
      (pingSample) => { setLivePing(pingSample); }
    );
  };

  const startTest = () => runTest();
  const stopTest = () => { SpeedTestService.stopTest(); setIsTestRunning(false); setCurrentType('Ready'); setProgressText(''); setLiveDownload(0); setLiveUpload(0); setLivePing(0); };

  const toggleBackgroundMode = () => {
    if (backgroundMode) {
      if (backgroundTimerRef.current) { clearInterval(backgroundTimerRef.current); backgroundTimerRef.current = null; }
      setBackgroundMode(false); setBackgroundInterval(null); setShowIntervalOptions(false);
      Alert.alert('Background Testing', 'Background testing disabled.');
    } else { setShowIntervalOptions(!showIntervalOptions); }
  };

  const selectInterval = (interval) => {
    if (backgroundTimerRef.current) { clearInterval(backgroundTimerRef.current); backgroundTimerRef.current = null; }
    setBackgroundInterval(interval.key); setBackgroundMode(true); setShowIntervalOptions(false);
    backgroundTimerRef.current = setInterval(() => { if (!SpeedTestService.isTestRunning) runTest(); }, interval.ms);
    Alert.alert('Background Testing', 'Enabled \u2014 every ' + interval.label, [{ text: 'OK' }]);
  };

  const getIntervalLabel = () => { if (!backgroundInterval) return ''; const found = INTERVALS.find((i) => i.key === backgroundInterval); return found ? found.label : ''; };

  const getNeedleColor = () => {
    switch (currentType) {
      case 'Download': return COLORS.accent;
      case 'Upload':   return t.uploadLine;
      case 'Ping':     return COLORS.success;
      case 'Complete': return COLORS.accent;
      default:         return t.gaugeLabelMinor;
    }
  };

  const getSpeedValue = () => {
    switch (currentType) {
      case 'Download': return liveDownload; case 'Upload': return liveUpload;
      case 'Ping': return livePing; case 'Complete': return downloadSpeed; default: return 0;
    }
  };
  const getMaxValue = () => currentType === 'Ping' ? 1500 : 200;
  const getSpeedLabel = () => {
    switch (currentType) {
      case 'Download': return 'DOWNLOAD'; case 'Upload': return 'UPLOAD'; case 'Ping': return 'PING';
      case 'Complete': return 'COMPLETE'; case 'Testing': return 'CONNECTING'; default: return '';
    }
  };
  const getSpeedUnit = () => currentType === 'Ping' ? 'ms' : 'Mbps';

  return (
    <View style={[styles.container, { backgroundColor: t.bg }]}>

      <Animated.ScrollView style={{ opacity: contentFade }} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.speedoWrap}>
          <Speedometer speed={getSpeedValue()} maxValue={getMaxValue()} label={getSpeedLabel()} unit={getSpeedUnit()} needleColor={getNeedleColor()} isRunning={isTestRunning} />
        </View>
        {progressText ? <Text style={[styles.progressText, { color: t.textMuted }]}>{progressText}</Text> : null}
        <View style={styles.statsGrid}>
          <StatCard label="Download" value={downloadSpeed} activePhase={currentType} />
          <StatCard label="Upload" value={uploadSpeed} activePhase={currentType} />
          <StatCard label="Ping" value={ping} unit="ms" activePhase={currentType} />
        </View>
        <View style={styles.controls}>
          {!isTestRunning ? (
            <AnimatedButton onPress={startTest} style={styles.startButton} textStyle={styles.startButtonText}>Start Test</AnimatedButton>
          ) : (
            <AnimatedButton onPress={stopTest} style={styles.runningButton} textStyle={styles.runningButtonText} glowing>Stop Test</AnimatedButton>
          )}
          <AnimatedButton onPress={toggleBackgroundMode} style={[styles.bgButton, backgroundMode && styles.bgButtonActive]} textStyle={[styles.bgButtonText, backgroundMode && styles.bgButtonTextActive]}>
            {backgroundMode ? 'Background: ON (' + getIntervalLabel() + ')' : 'Background Testing'}
          </AnimatedButton>
          {showIntervalOptions && !backgroundMode && (
            <View style={[styles.intervalBox, { backgroundColor: t.glass }]}>
              <View style={styles.intervalTitleWrap}>
                <FlashTitle text="SELECT INTERVAL" size="small" interval={5000} center />
              </View>
              <View style={styles.intervalGrid}>
                {INTERVALS.map((iv) => (
                  <TouchableOpacity key={iv.key} style={styles.intervalBtn} onPress={() => selectInterval(iv)} activeOpacity={0.7}>
                    <Text style={styles.intervalBtnText}>{iv.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
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
  startButton: {
    backgroundColor: COLORS.accent, paddingVertical: 16, paddingHorizontal: 52,
    borderRadius: RADIUS.pill, marginBottom: 14, ...SHADOWS.button,
  },
  startButtonText: { color: COLORS.black, fontSize: 16, fontWeight: '800', letterSpacing: 1, fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif' },
  runningButton: {
    backgroundColor: COLORS.accent, paddingVertical: 16, paddingHorizontal: 52,
    borderRadius: RADIUS.pill, marginBottom: 14,
    shadowColor: COLORS.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 8,
  },
  runningButtonText: { color: COLORS.black, fontSize: 16, fontWeight: '800', letterSpacing: 1, fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif' },
  bgButton: { paddingVertical: 11, paddingHorizontal: 28, borderRadius: RADIUS.pill, borderWidth: 1.5, borderColor: COLORS.accent, backgroundColor: 'transparent' },
  bgButtonActive: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  bgButtonText: { color: COLORS.accent, fontSize: 13, fontWeight: '700', letterSpacing: 0.5 },
  bgButtonTextActive: { color: COLORS.black },
  intervalBox: { marginTop: 16, width: '100%', borderRadius: RADIUS.lg, padding: 18, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 4 },
  intervalTitleWrap: { alignItems: 'center', marginBottom: 14 },
  intervalGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10 },
  intervalBtn: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: COLORS.accent, backgroundColor: 'transparent', minWidth: 72, alignItems: 'center' },
  intervalBtnText: { color: COLORS.accent, fontSize: 13, fontWeight: '700', fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif' },
});

export default SpeedTestScreen;

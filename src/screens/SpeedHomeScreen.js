import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Platform,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import FlashTitle from '../components/FlashTitle';
import LegalModal from '../components/LegalModal';
import Speedometer from '../components/Speedometer';
import StatCard from '../components/StatCard';

const ShareIcon = () => (
  <View style={{ width: 20, height: 20, alignItems: 'center', justifyContent: 'center' }}>
    <View style={{ 
      position: 'absolute', 
      width: 20, 
      height: 20, 
      alignItems: 'center', 
      justifyContent: 'center' 
    }}>
      {/* Modern share icon design */}
      <View style={{
        position: 'absolute',
        width: 8,
        height: 8,
        backgroundColor: COLORS.accent,
        borderRadius: 4,
        top: 2,
      }} />
      <View style={{
        position: 'absolute',
        width: 8,
        height: 8,
        backgroundColor: COLORS.accent,
        borderRadius: 4,
        bottom: 2,
        left: 2,
      }} />
      <View style={{
        position: 'absolute',
        width: 8,
        height: 8,
        backgroundColor: COLORS.accent,
        borderRadius: 4,
        bottom: 2,
        right: 2,
      }} />
      {/* Connection lines */}
      <View style={{
        position: 'absolute',
        width: 6,
        height: 1.5,
        backgroundColor: COLORS.accent,
        top: 5,
        left: 6,
        transform: [{ rotate: '45deg' }],
      }} />
      <View style={{
        position: 'absolute',
        width: 6,
        height: 1.5,
        backgroundColor: COLORS.accent,
        top: 5,
        right: 6,
        transform: [{ rotate: '-45deg' }],
      }} />
    </View>
  </View>
);
import { useFocusEffect } from '@react-navigation/native';
import { BACKGROUND_TEST_INTERVALS } from '../config/appSettings';
import { APP_NAME } from '../config/appInfo';
import { LEGAL_SECTIONS } from '../content/legal';
import { useAppSettings } from '../context/AppSettingsContext';
import SoundEngine from '../services/SoundEngine';
import SpeedTestService from '../services/SpeedTestService';
import { summarizeHistory } from '../utils/history';
import {
  convertSpeedFromMbps,
  formatBytes,
  formatPing,
  formatSpeedValue,
  getConnectionQuality,
  getSpeedUnitLabel,
} from '../utils/measurements';
import { COLORS, RADIUS, SHADOWS, useTheme } from '../utils/theme';

const AnimatedButton = ({ onPress, style, textStyle, children, disabled, glowing }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  const handleIn = () => Animated.spring(scaleAnim, {
    toValue: 0.96,
    tension: 300,
    friction: 10,
    useNativeDriver: false,
  }).start();

  const handleOut = () => Animated.spring(scaleAnim, {
    toValue: 1,
    tension: 200,
    friction: 8,
    useNativeDriver: false,
  }).start();

  useEffect(() => {
    if (!glowing) {
      glowAnim.setValue(0);
      return undefined;
    }

    const pulse = Animated.loop(Animated.sequence([
      Animated.timing(glowAnim, { toValue: 1, duration: 1000, useNativeDriver: false }),
      Animated.timing(glowAnim, { toValue: 0, duration: 1000, useNativeDriver: false }),
    ]));

    pulse.start();
    return () => pulse.stop();
  }, [glowing, glowAnim]);

  const glowShadowRadius = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 28] });
  const glowShadowOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.7] });

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={onPress}
      onPressIn={handleIn}
      onPressOut={handleOut}
      disabled={disabled}
    >
      <Animated.View
        style={[
          glowing
            ? {
                shadowColor: COLORS.accent,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: glowShadowOpacity,
                shadowRadius: glowShadowRadius,
                elevation: 12,
                borderRadius: RADIUS.pill,
              }
            : null,
        ]}
      >
        <Animated.View
          style={[
            style,
            disabled && styles.buttonDisabled,
            { transform: [{ scale: scaleAnim }] },
          ]}
        >
          <Text style={textStyle}>{children}</Text>
        </Animated.View>
      </Animated.View>
    </TouchableOpacity>
  );
};

const InsightCard = ({ title, value, subtitle }) => {
  const { t } = useTheme();

  return (
    <View style={[styles.insightCard, { backgroundColor: t.surface }]}>
      <View
        style={[
          styles.insightTint,
          { backgroundColor: t.mode === 'dark' ? 'rgba(245, 196, 0, 0.03)' : 'rgba(245, 196, 0, 0.015)' },
        ]}
      />
      <Text style={[styles.insightTitle, { color: t.textMuted }]}>{title}</Text>
      <Text style={[styles.insightValue, { color: t.textPrimary }]}>{value}</Text>
      <Text style={[styles.insightSubtitle, { color: t.textSecondary }]}>{subtitle}</Text>
    </View>
  );
};

const SpeedHomeScreen = () => {
  const { t } = useTheme();
  const { settings, updateSettings } = useAppSettings();

  const [isTestRunning, setIsTestRunning] = useState(false);
  const [currentType, setCurrentType] = useState('Ready');
  const [downloadSpeed, setDownloadSpeed] = useState(0);
  const [uploadSpeed, setUploadSpeed] = useState(0);
  const [ping, setPing] = useState(0);
  const [liveDownload, setLiveDownload] = useState(0);
  const [liveUpload, setLiveUpload] = useState(0);
  const [livePing, setLivePing] = useState(0);
  const [progressText, setProgressText] = useState('');
  const [historySummary, setHistorySummary] = useState(summarizeHistory([]));
  const [peaks, setPeaks] = useState({ download: 0, upload: 0, ping: 0 });
  const [legalVisible, setLegalVisible] = useState(false);
  const [backgroundIntervalOpen, setBackgroundIntervalOpen] = useState(false);
  const [backgroundTestRef, setBackgroundTestRef] = useState(null);
  const [selectedLegalKey, setSelectedLegalKey] = useState('privacy');

  const gaugeWhirRef = useRef(null);
  const liveSpeedRef = useRef(0);
  const contentFade = useRef(new Animated.Value(1)).current;

  const startBackgroundTest = async (intervalMinutes) => {
    if (!settings.dataDisclosureAccepted) return;
    
    const runBackgroundTest = async () => {
      try {
        const result = await SpeedTestService.runTest({
          onProgress: (phase, progress) => {
            console.log(`Background test ${phase}: ${progress}%`);
          },
          onSpeedUpdate: (speed, type) => {
            console.log(`Background ${type} speed: ${speed} Mbps`);
          },
        });
        
        if (result.success) {
          await SpeedTestService.saveResult(result);
          console.log('Background test completed successfully');
        }
      } catch (error) {
        console.error('Background test failed:', error);
      }
    };

    // Run initial test immediately
    setTimeout(() => {
      runBackgroundTest();
    }, 1000);

    // Set up interval for background tests
    const intervalMs = intervalMinutes * 60 * 1000;
    const intervalId = setInterval(runBackgroundTest, intervalMs);
    setBackgroundTestRef(intervalId);
  };

  const stopBackgroundTest = () => {
    if (backgroundTestRef) {
      clearInterval(backgroundTestRef);
      setBackgroundTestRef(null);
    }
  };

  const loadPersistedData = useCallback(async () => {
    const history = await SpeedTestService.getHistory();
    setHistorySummary(summarizeHistory(history));
    await SpeedTestService.loadPeaks();
    setPeaks(SpeedTestService.getPeaks());
  }, []);

  useEffect(() => {
    contentFade.setValue(0);
    Animated.timing(contentFade, { toValue: 1, duration: 400, useNativeDriver: false }).start();
    loadPersistedData();

    return () => {
      if (gaugeWhirRef.current) clearInterval(gaugeWhirRef.current);
      if (backgroundTestRef) clearInterval(backgroundTestRef);
    };
  }, [contentFade, loadPersistedData, backgroundTestRef]);

  useFocusEffect(useCallback(() => {
    loadPersistedData();
  }, [loadPersistedData]));

  const speedUnitLabel = getSpeedUnitLabel(settings.speedUnit);
  const lastTest = historySummary.lastTest;
  const qualitySource = {
    download: downloadSpeed || lastTest?.download || 0,
    upload: uploadSpeed || lastTest?.upload || 0,
    ping: ping || lastTest?.ping || 0,
  };
  const connectionQuality = getConnectionQuality(qualitySource);

  const acknowledgeDisclosure = async () => {
    await updateSettings({ dataDisclosureAccepted: true });
    SoundEngine.playToggleOn();
  };

  const openLegalSection = (key) => {
    setSelectedLegalKey(key);
    setLegalVisible(true);
  };

  const shareLastResult = async () => {
    if (!lastTest) {
      Alert.alert('No results yet', 'Run a speed test before sharing a result.');
      return;
    }

    try {
      await Share.share({
        title: `${APP_NAME} speed result`,
        message: [
          `${APP_NAME} speed result`,
          `Download: ${formatSpeedValue(lastTest.download, settings.speedUnit)} ${speedUnitLabel}`,
          `Upload: ${formatSpeedValue(lastTest.upload, settings.speedUnit)} ${speedUnitLabel}`,
          `Ping: ${formatPing(lastTest.ping)}`,
          `Data used: ${formatBytes(lastTest.totalBytes || 0)}`,
          `Server: ${lastTest.serverName || 'Automatic'} (${lastTest.serverLocation || 'Automatic'})`,
        ].join('\n'),
      });
    } catch (error) {
      Alert.alert('Share failed', 'Could not open the share sheet on this device.');
    }
  };

  const runTest = async () => {
    setIsTestRunning(true);
    setCurrentType('Testing');
    setDownloadSpeed(0);
    setUploadSpeed(0);
    setPing(0);
    setLiveDownload(0);
    setLiveUpload(0);
    setLivePing(0);

    liveSpeedRef.current = 0;
    let lastWhirProgress = 0;
    gaugeWhirRef.current = setInterval(() => {
      const progress = Math.min(liveSpeedRef.current / 200, 1);
      if (progress > 0.01 && Math.abs(progress - lastWhirProgress) > 0.02) {
        SoundEngine.playGaugeWhir(progress);
        lastWhirProgress = progress;
      }
    }, 350);

    await SpeedTestService.runSpeedTest(
      (progress, type) => {
        setProgressText(progress);
        if (type === 'ping') setCurrentType('Ping');
        else if (type === 'download') setCurrentType('Download');
        else if (type === 'upload') setCurrentType('Upload');
      },
      (speed, type) => {
        liveSpeedRef.current = speed;
        if (type === 'download') setLiveDownload(speed);
        else if (type === 'upload') setLiveUpload(speed);
      },
      async (result) => {
        if (gaugeWhirRef.current) {
          clearInterval(gaugeWhirRef.current);
          gaugeWhirRef.current = null;
        }

        setDownloadSpeed(result.download);
        setUploadSpeed(result.upload);
        setPing(result.ping);
        setLivePing(result.ping);
        setLiveDownload(result.download);
        setLiveUpload(result.upload);
        setCurrentType('Complete');
        setProgressText(`Completed on ${result.serverName}`);
        SoundEngine.playTestComplete();

        await loadPersistedData();

        setTimeout(() => {
          setIsTestRunning(false);
          setCurrentType('Ready');
          setProgressText('');
          setLiveDownload(0);
          setLiveUpload(0);
          setLivePing(0);
        }, 4000);
      },
      (error) => {
        if (gaugeWhirRef.current) {
          clearInterval(gaugeWhirRef.current);
          gaugeWhirRef.current = null;
        }

        Alert.alert('Test Failed', error);
        setIsTestRunning(false);
        setCurrentType('Error');
        setProgressText('');
        setLiveDownload(0);
        setLiveUpload(0);
        setLivePing(0);
      },
      (pingSample) => setLivePing(pingSample),
      (type, value) => {
        SoundEngine.playPhaseComplete();
        if (type === 'ping') setPing(value);
        else if (type === 'download') setDownloadSpeed(value);
        else if (type === 'upload') setUploadSpeed(value);
      },
    );
  };

  const startTest = () => {
    if (!settings.dataDisclosureAccepted) {
      Alert.alert(
        'Review the data notice first',
        'Accept the network and data-usage disclosure before running your first test.',
      );
      return;
    }

    SoundEngine.playStartTest();
    runTest();
  };

  const stopTest = () => {
    if (gaugeWhirRef.current) {
      clearInterval(gaugeWhirRef.current);
      gaugeWhirRef.current = null;
    }

    SpeedTestService.stopTest();
    setIsTestRunning(false);
    setCurrentType('Ready');
    setProgressText('');
    setLiveDownload(0);
    setLiveUpload(0);
    setLivePing(0);
  };

  const gaugeValue = useMemo(() => {
    const rawSpeed = (() => {
      switch (currentType) {
        case 'Download':
          return liveDownload;
        case 'Upload':
          return liveUpload;
        case 'Ping':
          return livePing;
        case 'Complete':
          return downloadSpeed;
        default:
          return 0;
      }
    })();

    return currentType === 'Ping'
      ? rawSpeed
      : convertSpeedFromMbps(rawSpeed, settings.speedUnit);
  }, [currentType, downloadSpeed, liveDownload, livePing, liveUpload, settings.speedUnit]);

  const gaugeMax = currentType === 'Ping'
    ? 1500
    : convertSpeedFromMbps(200, settings.speedUnit);

  const gaugeLabel = (() => {
    switch (currentType) {
      case 'Download':
        return 'DOWNLOAD';
      case 'Upload':
        return 'UPLOAD';
      case 'Ping':
        return 'PING';
      case 'Complete':
        return 'COMPLETE';
      case 'Testing':
        return 'CONNECTING';
      default:
        return '';
    }
  })();

  const gaugeNeedleColor = (() => {
    switch (currentType) {
      case 'Download':
        return COLORS.accent;
      case 'Upload':
        return t.uploadLine;
      case 'Ping':
        return COLORS.success;
      case 'Complete':
        return COLORS.accent;
      default:
        return t.gaugeLabelMinor;
    }
  })();

  return (
    <View style={[styles.container, { backgroundColor: t.bg }]}>
      <Animated.ScrollView
        style={{ opacity: contentFade }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {!settings.dataDisclosureAccepted && (
          <View style={[styles.disclosureCard, { backgroundColor: t.surface }]}>
            <View
              style={[
                styles.disclosureTint,
                { backgroundColor: t.mode === 'dark' ? 'rgba(245, 196, 0, 0.04)' : 'rgba(245, 196, 0, 0.02)' },
              ]}
            />
            <FlashTitle text="NETWORK DISCLOSURE" size="small" interval={5000} center />
            <Text style={[styles.disclosureText, { color: t.textSecondary }]}>
              Running a test sends traffic to Measurement Lab and Cloudflare and can use a noticeable amount of mobile data. Results stay on-device unless you export them.
            </Text>
            <View style={styles.disclosureActions}>
              <TouchableOpacity
                style={styles.secondaryPill}
                onPress={() => openLegalSection('privacy')}
                activeOpacity={0.7}
              >
                <Text style={styles.secondaryPillText}>Review Policy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.primaryPill}
                onPress={acknowledgeDisclosure}
                activeOpacity={0.7}
              >
                <Text style={styles.primaryPillText}>I Understand</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={styles.speedoWrap}>
          <Speedometer
            speed={gaugeValue}
            maxValue={gaugeMax}
            label={gaugeLabel}
            unit={currentType === 'Ping' ? 'ms' : speedUnitLabel}
            needleColor={gaugeNeedleColor}
            isRunning={isTestRunning}
          />
        </View>

        {progressText ? (
          <Text
            style={[
              styles.progressText,
              {
                color: t.textMuted,
                textShadowColor: 'rgba(0, 0, 0, 0.2)',
                textShadowOffset: { width: 0, height: 1 },
                textShadowRadius: 1.5,
              },
            ]}
          >
            {progressText}
          </Text>
        ) : null}

        <View style={styles.statsGrid}>
          <StatCard
            label="Download"
            value={formatSpeedValue(downloadSpeed, settings.speedUnit)}
            unit={speedUnitLabel}
            activePhase={currentType}
            footerText={peaks.download ? `Best ${formatSpeedValue(peaks.download, settings.speedUnit, 1)} ${speedUnitLabel}` : 'Best pending'}
          />
          <StatCard
            label="Upload"
            value={formatSpeedValue(uploadSpeed, settings.speedUnit)}
            unit={speedUnitLabel}
            activePhase={currentType}
            footerText={peaks.upload ? `Best ${formatSpeedValue(peaks.upload, settings.speedUnit, 1)} ${speedUnitLabel}` : 'Best pending'}
          />
          {settings.showPing && (
            <StatCard
              label="Ping"
              value={ping}
              unit="ms"
              activePhase={currentType}
              footerText={peaks.ping ? `Best ${formatPing(peaks.ping)}` : 'Best pending'}
            />
          )}
        </View>

        <View style={styles.controls}>
          <View style={styles.centeredControls}>
            {!isTestRunning ? (
              <AnimatedButton
                onPress={startTest}
                style={styles.startButton}
                textStyle={[styles.startButtonText, { color: t.buttonText }]}
                disabled={!settings.dataDisclosureAccepted}
              >
                Start Test
              </AnimatedButton>
            ) : (
              <AnimatedButton
                onPress={stopTest}
                style={styles.runningButton}
                textStyle={[styles.runningButtonText, { color: t.buttonText }]}
                glowing
              >
                Stop Test
              </AnimatedButton>
            )}
          </View>
          
          <View style={styles.bottomControlsRow}>
            <AnimatedButton
              onPress={() => setBackgroundIntervalOpen(!backgroundIntervalOpen)}
              style={styles.backgroundTestButtonSmall}
              textStyle={styles.backgroundTestTextSmall}
            >
              Background Test
            </AnimatedButton>
            
            {lastTest && (
              <AnimatedButton
                onPress={shareLastResult}
                style={styles.shareIconButton}
                disabled={false}
              >
                <ShareIcon />
              </AnimatedButton>
            )}
          </View>
        </View>

        {backgroundIntervalOpen && (
          <View style={[styles.backgroundTestOptions, { backgroundColor: t.surface }]}>
            <TouchableOpacity
              style={[styles.backgroundTestOption, settings.backgroundTestInterval === null && styles.backgroundTestOptionActive]}
              onPress={() => {
                updateSettings({ backgroundTestInterval: null });
                setBackgroundIntervalOpen(false);
                if (backgroundTestRef) {
                  clearInterval(backgroundTestRef);
                  setBackgroundTestRef(null);
                }
              }}
              activeOpacity={0.7}
            >
              <Text style={[styles.backgroundTestOptionText, { color: settings.backgroundTestInterval === null ? COLORS.black : t.textPrimary }]}>
                Disabled
              </Text>
            </TouchableOpacity>
            {BACKGROUND_TEST_INTERVALS.map((interval) => (
              <TouchableOpacity
                key={interval.value}
                style={[styles.backgroundTestOption, settings.backgroundTestInterval === interval.value && styles.backgroundTestOptionActive]}
                onPress={() => {
                  updateSettings({ backgroundTestInterval: interval.value });
                  setBackgroundIntervalOpen(false);
                  startBackgroundTest(interval.value);
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.backgroundTestOptionText, { color: settings.backgroundTestInterval === interval.value ? COLORS.black : t.textPrimary }]}>
                  {interval.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={styles.insightsWrap}>
          <InsightCard
            title="Connection Quality"
            value={connectionQuality.label}
            subtitle={connectionQuality.summary}
          />
          <InsightCard
            title="Last Test Traffic"
            value={lastTest ? formatBytes(lastTest.totalBytes || 0) : 'No data yet'}
            subtitle={lastTest ? 'Download + upload payload used by the latest completed test.' : 'Run a test to see the actual traffic used.'}
          />
          <InsightCard
            title="Server Used"
            value={lastTest ? lastTest.serverName : 'Automatic'}
            subtitle={lastTest ? `${lastTest.serverLocation} • ${lastTest.provider}` : 'The app automatically picks the best available endpoint.'}
          />
        </View>
      </Animated.ScrollView>

      <LegalModal
        visible={legalVisible}
        selectedKey={selectedLegalKey}
        sections={LEGAL_SECTIONS}
        onClose={() => setLegalVisible(false)}
        onSelect={setSelectedLegalKey}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    padding: 20,
    alignItems: 'center',
    paddingBottom: 40,
    zIndex: 2,
  },
  speedoWrap: {
    marginTop: 0,
    marginBottom: 4,
    alignItems: 'center',
  },
  progressText: {
    fontSize: 12,
    fontStyle: 'italic',
    marginBottom: 8,
    letterSpacing: 0.5,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginVertical: 16,
  },
  controls: {
    alignItems: 'center',
    marginVertical: 8,
    width: '100%',
  },
  startButton: {
    backgroundColor: COLORS.accent,
    paddingVertical: 16,
    paddingHorizontal: 52,
    borderRadius: RADIUS.pill,
    marginBottom: 14,
    ...SHADOWS.button,
  },
  startButtonText: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  },
  runningButton: {
    backgroundColor: COLORS.accent,
    paddingVertical: 16,
    paddingHorizontal: 52,
    borderRadius: RADIUS.pill,
    marginBottom: 14,
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  runningButtonText: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  actionRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 10,
  },
  utilityButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: RADIUS.pill,
    borderWidth: 1.5,
    borderColor: COLORS.accent,
    backgroundColor: 'transparent',
    alignItems: 'center',
  },
  utilityButtonText: {
    color: COLORS.accent,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  centeredControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  bottomControlsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  nextToControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backgroundTestButtonSmall: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: RADIUS.pill,
    borderWidth: 1.5,
    borderColor: COLORS.accent,
    backgroundColor: 'transparent',
    alignItems: 'center',
  },
  backgroundTestTextSmall: {
    color: COLORS.accent,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  shareIconButton: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: RADIUS.pill,
    borderWidth: 1.5,
    borderColor: COLORS.accent,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareIconButtonAbsolute: {
    position: 'absolute',
    right: 0,
    top: 0,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: RADIUS.pill,
    borderWidth: 1.5,
    borderColor: COLORS.accent,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backgroundTestSection: {
    width: '100%',
    marginTop: 16,
  },
  backgroundTestButton: {
    borderRadius: RADIUS.pill,
    borderWidth: 1.5,
    borderColor: COLORS.accent,
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  backgroundTestTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backgroundTestText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  backgroundTestInterval: {
    fontSize: 11,
    fontWeight: '500',
    flex: 1,
    textAlign: 'center',
  },
  backgroundTestArrow: {
    fontSize: 10,
    marginLeft: 8,
  },
  backgroundTestOptions: {
    marginTop: 4,
    borderRadius: RADIUS.lg,
    paddingVertical: 8,
    paddingHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  backgroundTestOption: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: 'transparent',
    alignItems: 'center',
    marginBottom: 4,
  },
  backgroundTestOptionActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  backgroundTestOptionText: {
    fontSize: 13,
    fontWeight: '600',
  },
  insightsWrap: {
    width: '100%',
    marginTop: 20,
    gap: 12,
  },
  insightCard: {
    borderRadius: RADIUS.lg,
    padding: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 10,
    elevation: 5,
  },
  insightTint: {
    ...StyleSheet.absoluteFillObject,
  },
  insightTitle: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    fontWeight: '700',
    marginBottom: 6,
  },
  insightValue: {
    fontSize: 21,
    fontWeight: '800',
    marginBottom: 6,
  },
  insightSubtitle: {
    fontSize: 13,
    lineHeight: 19,
  },
  disclosureCard: {
    width: '100%',
    borderRadius: RADIUS.lg,
    padding: 16,
    marginBottom: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 10,
    elevation: 5,
  },
  disclosureTint: {
    ...StyleSheet.absoluteFillObject,
  },
  disclosureText: {
    marginTop: 12,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  disclosureActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginTop: 14,
  },
  secondaryPill: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: RADIUS.pill,
    borderWidth: 1.5,
    borderColor: COLORS.accent,
  },
  secondaryPillText: {
    color: COLORS.accent,
    fontWeight: '700',
    fontSize: 12,
  },
  primaryPill: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.accent,
  },
  primaryPillText: {
    color: COLORS.black,
    fontWeight: '800',
    fontSize: 12,
  },
});

export default SpeedHomeScreen;

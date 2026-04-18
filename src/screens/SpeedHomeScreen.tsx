export { default } from './SpeedHomeLiquidScreen';
/*
import React, { useCallback, useEffect, useMemo, useRef, useState, ReactNode, ViewStyle } from 'react';
import {
  Alert,
  Animated,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import FlashTitle from '../components/FlashTitle';
import LegalModal from '../components/LegalModal';
import Speedometer from '../components/Speedometer';
import StatCard from '../components/StatCard';
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

// ── Type Definitions ─────────────────────────────────────────────────────────
interface ShareIconProps {
  size?: number;
  color?: string;
}

interface AnimatedButtonProps {
  onPress: () => void;
  style?: ViewStyle;
  textStyle?: any;
  children: ReactNode;
  disabled?: boolean;
  glowing?: boolean;
}

interface InsightCardProps {
  title: string;
  value: string;
  subtitle: string;
}

// ── Components ─────────────────────────────────────────────────────────────
const ShareIcon = ({ size = 20, color }: ShareIconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path
      d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    <Path
      d="M16 6l-4-4-4 4"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    <Path
      d="M12 2v13"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </Svg>
);

const AnimatedButton = ({ onPress, style, textStyle, children, disabled, glowing }: AnimatedButtonProps) => {
  const { t } = useTheme();
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
    tension: 300,
    friction: 10,
    useNativeDriver: false,
  }).start();

  const handlePress = () => {
    if (!disabled) {
      onPress();
    }
  };

  // Glow effect when glowing prop is true
  const glowShadowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.1, 0.5],
  });
  const glowShadowRadius = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [4, 18],
  });

  return (
    <Animated.View
      style={[
        style,
        {
          transform: [{ scale: scaleAnim }],
        },
        glowing
          ? {
              shadowColor: t.accent,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: glowShadowOpacity,
              shadowRadius: glowShadowRadius,
              elevation: 12,
              borderRadius: RADIUS.pill,
            }
          : null,
      ]}
    >
      <TouchableOpacity
        onPress={handlePress}
        onPressIn={handleIn}
        onPressOut={handleOut}
        activeOpacity={1}
        disabled={disabled}
        style={[StyleSheet.absoluteFill, { backgroundColor: 'transparent' }]}
      >
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' }}>
          {textStyle ? <Text style={textStyle}>{children}</Text> : children}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const InsightCard = ({ title, value, subtitle }: InsightCardProps) => {
  const { t } = useTheme();

  return (
    <View style={[styles.insightCard, { backgroundColor: t.surface, position: 'relative', overflow: 'hidden' }]}>
      <View style={[{ position: 'absolute', top: -15, right: -15, width: 100, height: 100, borderRadius: 999, opacity: 0.15, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 50, elevation: 0 }, { backgroundColor: t.accent }]} />
      <View style={[{ position: 'absolute', bottom: -12, left: -12, width: 80, height: 80, borderRadius: 999, opacity: 0.12, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 45, elevation: 0 }, { backgroundColor: t.uploadLine || t.accent }]} />
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
  const [backgroundTestRef, setBackgroundTestRef] = useState<NodeJS.Timeout | null>(null);
  const [selectedLegalKey, setSelectedLegalKey] = useState('privacy');

  const gaugeWhirRef = useRef<NodeJS.Timeout | null>(null);
  const liveSpeedRef = useRef(0);
  const contentFade = useRef(new Animated.Value(1)).current;

  const startBackgroundTest = async (intervalMinutes: number) => {
    if (!settings.dataDisclosureAccepted) return;

    const runBackgroundTest = async () => {
      try {
        await SpeedTestService.runSpeedTest(
          (progress, type) => {
            console.log(`Background test ${type}: ${progress}`);
          },
          (speed, type) => {
            console.log(`Background ${type} speed: ${speed} Mbps`);
          },
          async (result) => {
            console.log('Background test completed successfully');
          },
          (error) => {
            console.error('Background test failed:', error);
          },
          (pingSample) => {
            console.log(`Background ping sample: ${pingSample}ms`);
          },
          (type, value) => {
            console.log(`Background ${type} phase complete: ${value}`);
          }
        );
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

  const openLegalSection = (key: string) => {
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
        return t.accent;
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
                { backgroundColor: t.accentTintCard },
              ]}
            />
            <FlashTitle text="NETWORK DISCLOSURE" size="small" interval={5000} center />
            <Text style={[styles.disclosureText, { color: t.textSecondary }]}>
              Running a test sends traffic to Measurement Lab and Cloudflare and can use a noticeable amount of mobile data. Results stay on-device unless you export them.
            </Text>
            <View style={styles.disclosureActions}>
              <TouchableOpacity
                style={[styles.secondaryPill, { borderColor: t.accent }]}
                onPress={() => openLegalSection('privacy')}
                activeOpacity={0.7}
              >
                <Text style={[styles.secondaryPillText, { color: t.accent }]}>Review Policy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryPill, { backgroundColor: t.accent }]}
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

        <View style={styles.disclosureActions}>
          <View style={styles.primaryControlsRow}>
            {!isTestRunning ? (
              <AnimatedButton
                onPress={startTest}
                style={[styles.startButton, { backgroundColor: t.accent, shadowColor: SHADOWS.clayButton.shadowColor, shadowOffset: SHADOWS.clayButton.shadowOffset, shadowOpacity: SHADOWS.clayButton.shadowOpacity, shadowRadius: SHADOWS.clayButton.shadowRadius, elevation: SHADOWS.clayButton.elevation }]}
                textStyle={[styles.startButtonText, { color: t.buttonText }]}
                disabled={!settings.dataDisclosureAccepted}
              >
                Start Test
              </AnimatedButton>
            ) : (
              <AnimatedButton
                onPress={stopTest}
                style={[styles.runningButton, { backgroundColor: t.accent, shadowColor: SHADOWS.clayButton.shadowColor, shadowOffset: SHADOWS.clayButton.shadowOffset, shadowOpacity: SHADOWS.clayButton.shadowOpacity, shadowRadius: SHADOWS.clayButton.shadowRadius, elevation: SHADOWS.clayButton.elevation }]}
                textStyle={[styles.runningButtonText, { color: t.buttonText }]}
                glowing
              >
                Stop Test
              </AnimatedButton>
            )}
          </View>
        </View>

        {progressText && (
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
        )}

        <View style={[styles.statsGrid, { overflow: 'visible' }]}>
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

        <View style={styles.bottomButtonsRow}>
          <TouchableOpacity
            style={[styles.backgroundTestIconButton, { borderColor: t.accent }]}
            onPress={toggleBackgroundMode}
            activeOpacity={0.7}
          >
            <MaterialIcons name="autorenew" size={20} color={t.accent} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.shareIconButton, { borderColor: t.accent }]}
            onPress={() => {}}
            activeOpacity={0.7}
          >
            <MaterialIcons name="share" size={20} color={t.accent} />
          </TouchableOpacity>
        </View>

        <View style={styles.bottomButtonsRow}>
          <TouchableOpacity
            style={[styles.bottomButton, { borderColor: t.accent }]}
            onPress={() => setBackgroundIntervalOpen(!backgroundIntervalOpen)}
            activeOpacity={0.7}
          >
            <Text style={[styles.bottomButtonText, { color: t.accent }]}>Auto</Text>
          </TouchableOpacity>
          {lastTest && (
            <TouchableOpacity
              style={[styles.bottomButton, { borderColor: t.accent }]}
              onPress={shareLastResult}
              activeOpacity={0.7}
            >
              <View style={styles.bottomButtonContent}>
                <ShareIcon size={24} color={t.accent} />
                <Text style={[styles.bottomButtonText, { color: t.accent }]}>Share</Text>
              </View>
            </TouchableOpacity>
          )}
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
    marginTop: 18,
    marginBottom: 16,
  },
  controls: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 4,
    width: '100%',
  },
  startButton: {
    height: 52,
    paddingVertical: 14,
    paddingHorizontal: 76,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startButtonText: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1,
    lineHeight: 20,
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  },
  runningButton: {
    height: 52,
    paddingVertical: 14,
    paddingHorizontal: 76,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  runningButtonText: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1,
    lineHeight: 20,
    textAlign: 'center',
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
    backgroundColor: 'transparent',
    alignItems: 'center',
  },
  utilityButtonText: {
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
  primaryControlsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    gap: 12,
    marginTop: 6,
  },
  nextToControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backgroundTestButtonSmall: {
    height: 48,
    width: 64,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 20,
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backgroundTestTextSmall: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
    lineHeight: 16,
    textAlign: 'center',
    textDecorationLine: 'none',
  },
  shareIconButton: {
    height: 48,
    width: 64,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 20,
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backgroundTestIconButton: {
    height: 48,
    width: 64,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 20,
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareIconButtonAbsolute: {
    position: 'absolute',
    right: 0,
    top: 0,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backgroundTestSection: {
    width: '100%',
    marginTop: 16,
  },
  backgroundTestButton: {
    borderRadius: 20,
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  backgroundTestTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
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
    marginTop: 8,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 4,
  },
  backgroundTestOption: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 16,
    backgroundColor: 'transparent',
    alignItems: 'center',
    minWidth: '30%',
    flex: 1,
  },
  backgroundTestOptionActive: {},
  backgroundTestOptionText: {
    fontSize: 11,
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
    ...SHADOWS.clayCard,
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
  },
  secondaryPillText: {
    fontWeight: '700',
    fontSize: 12,
  },
  primaryPill: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: RADIUS.pill,
  },
  primaryPillText: {
    color: COLORS.black,
    fontWeight: '800',
    fontSize: 12,
  },
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

export default SpeedHomeScreen;
*/

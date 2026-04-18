import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Platform,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import Svg, { Path } from 'react-native-svg';
import FlashTitle from '../components/FlashTitle';
import LiquidGlass from '../components/LiquidGlass';
import Speedometer from '../components/Speedometer';
import StatCard from '../components/StatCard';
import { useAppSettings } from '../context/AppSettingsContext';
import { useTestContext } from '../context/TestContext';
import SoundEngine from '../services/SoundEngine';
import SpeedTestService from '../services/SpeedTestService';
import { summarizeHistory } from '../utils/history';
import { useTheme, withAlpha } from '../utils/theme';
import {
  convertSpeedFromMbps,
  formatBytes,
  formatPing,
  formatSpeedValue,
  getConnectionQuality,
  getSpeedUnitLabel,
} from '../utils/measurements';

const APP_NAME = 'Flash';

const BACKGROUND_TEST_INTERVALS = [
  { key: 'off', label: 'Off', minutes: null },
  { key: '30m', label: '30 Min', minutes: 30 },
  { key: '1h', label: '1 Hour', minutes: 60 },
  { key: '3h', label: '3 Hours', minutes: 180 },
  { key: '6h', label: '6 Hours', minutes: 360 },
];

const resolveSpeedUnitKey = (unit: 'Mbps' | 'MB/s' | 'kB/s') => {
  switch (unit) {
    case 'MB/s':
      return 'mbs' as const;
    case 'kB/s':
      return 'kbps' as const;
    case 'Mbps':
    default:
      return 'mbps' as const;
  }
};

const ShareIcon = ({ size = 20, color = '#FFFFFF' }: { size?: number; color?: string }) => (
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

const CycleIcon = ({ size = 20, color = '#FFFFFF' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path
      d="M17 1v5h-5"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    <Path
      d="M3 11a8 8 0 0 1 13.66-5.66L17 6"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    <Path
      d="M7 23v-5h5"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    <Path
      d="M21 13a8 8 0 0 1-13.66 5.66L7 18"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </Svg>
);

const ParticleField = ({ color }: { color: string }) => {
  const opacity = useRef(Array.from({ length: 8 }, () => new Animated.Value(0.25))).current;

  useEffect(() => {
    const loops = opacity.map((value, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 180),
          Animated.timing(value, {
            toValue: 0.7,
            duration: 2200,
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 0.2,
            duration: 2200,
            useNativeDriver: true,
          }),
        ])
      )
    );

    loops.forEach((loop) => loop.start());

    return () => {
      loops.forEach((loop) => loop.stop());
    };
  }, [opacity]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {opacity.map((value, index) => (
        <Animated.View
          key={index}
          style={[
            styles.particle,
            {
              backgroundColor: color,
              left: `${8 + index * 11}%`,
              top: `${10 + (index % 4) * 18}%`,
              opacity: value,
              transform: [
                {
                  translateY: value.interpolate({
                    inputRange: [0.2, 0.7],
                    outputRange: [6, -8],
                  }),
                },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
};

const InsightCard = ({ title, value, subtitle }: { title: string; value: string; subtitle: string }) => {
  const { t } = useTheme();

  return (
    <LiquidGlass style={styles.insightCard} contentStyle={styles.insightCardContent}>
      <Text style={[styles.insightTitle, { color: t.textMuted }]}>{title}</Text>
      <Text style={[styles.insightValue, { color: t.textPrimary }]}>{value}</Text>
      <Text style={[styles.insightSubtitle, { color: t.textSecondary }]}>{subtitle}</Text>
    </LiquidGlass>
  );
};

const SpeedHomeLiquidScreen = () => {
  const { t } = useTheme();
  const { settings, updateSettings } = useAppSettings();
  const { setIsTestRunning } = useTestContext();
  const [isTestRunning, setIsTestRunningLocal] = useState(false);
  const [currentType, setCurrentType] = useState('Ready');
  const [downloadSpeed, setDownloadSpeed] = useState(0);
  const [uploadSpeed, setUploadSpeed] = useState(0);
  const [ping, setPing] = useState(0);
  const [liveDownload, setLiveDownload] = useState(0);
  const [liveUpload, setLiveUpload] = useState(0);
  const [livePing, setLivePing] = useState(0);
  const [progressText, setProgressText] = useState('');
  const [historySummary, setHistorySummary] = useState(summarizeHistory([]));
  const [lastTest, setLastTest] = useState<any | null>(null);
  const [peaks, setPeaks] = useState({ download: 0, upload: 0, ping: 0 });
  const [backgroundIntervalOpen, setBackgroundIntervalOpen] = useState(false);
  const [backgroundTimer, setBackgroundTimer] = useState<ReturnType<typeof setInterval> | null>(null);
  const gaugeWhirRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const liveSpeedRef = useRef(0);
  const contentFade = useRef(new Animated.Value(0)).current;
  const speedUnitKey = resolveSpeedUnitKey(settings.speedUnit);
  const speedUnitLabel = getSpeedUnitLabel(speedUnitKey);
  const palette = useMemo(() => ({
    bgGradient: ['#070b16', '#10192b', withAlpha(t.accentDark, 0.4)] as const,
    accent: t.accent,
    accent2: t.accentLight,
    danger: t.danger,
    success: t.success,
    particle: withAlpha(t.accentLight, 0.9),
  }), [t]);

  const loadPersistedData = useCallback(async () => {
    const history = await SpeedTestService.getHistory();
    setHistorySummary(summarizeHistory(history));
    setLastTest(history[0] || null);
    await SpeedTestService.loadPeaks();
    setPeaks(SpeedTestService.getPeaks());
  }, []);

  useEffect(() => {
    Animated.timing(contentFade, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();

    loadPersistedData();

    return () => {
      if (gaugeWhirRef.current) clearInterval(gaugeWhirRef.current);
      if (backgroundTimer) clearInterval(backgroundTimer);
    };
  }, [backgroundTimer, contentFade, loadPersistedData]);

  useFocusEffect(useCallback(() => {
    loadPersistedData();
  }, [loadPersistedData]));

  const qualitySource = {
    download: downloadSpeed || lastTest?.download || 0,
    upload: uploadSpeed || lastTest?.upload || 0,
    ping: ping || lastTest?.ping || 0,
  };
  const connectionQuality = getConnectionQuality(qualitySource);

  const resetLiveState = () => {
    setProgressText('');
    setLiveDownload(0);
    setLiveUpload(0);
    setLivePing(0);
  };

  const startBackgroundTests = async (minutes: number | null) => {
    if (backgroundTimer) {
      clearInterval(backgroundTimer);
      setBackgroundTimer(null);
    }

    await updateSettings({ backgroundTestInterval: minutes });

    if (!minutes) return;

    const interval = setInterval(() => {
      if (!SpeedTestService.isTestRunning) {
        runTest(true);
      }
    }, minutes * 60 * 1000);

    setBackgroundTimer(interval);
  };

  const acknowledgeDisclosure = async () => {
    await updateSettings({ dataDisclosureAccepted: true });
    SoundEngine.playToggleOn();
  };

  const openPolicy = () => {
    Alert.alert(
      'Network & Data Policy',
      'Running a test sends traffic to Measurement Lab and Cloudflare. Results stay on-device unless you export them, and mobile data usage can be noticeable on slower networks.',
    );
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
          `Download: ${formatSpeedValue(lastTest.download, speedUnitKey)} ${speedUnitLabel}`,
          `Upload: ${formatSpeedValue(lastTest.upload, speedUnitKey)} ${speedUnitLabel}`,
          `Ping: ${formatPing(lastTest.ping)}`,
          `Data used: ${formatBytes(lastTest.totalBytes || 0)}`,
          `Server: ${lastTest.serverName || 'Automatic'} (${lastTest.serverLocation || 'Automatic'})`,
        ].join('\n'),
      });
    } catch (_error) {
      Alert.alert('Share failed', 'Could not open the share sheet on this device.');
    }
  };

  const runTest = async (backgroundOnly = false) => {
    setIsTestRunningLocal(true);
    setIsTestRunning(true);
    setCurrentType('Testing');
    setDownloadSpeed(0);
    setUploadSpeed(0);
    setPing(0);
    resetLiveState();

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
        setLiveDownload(result.download);
        setLiveUpload(result.upload);
        setLivePing(result.ping);
        setCurrentType('Complete');
        setProgressText(`Completed on ${result.serverName || 'Automatic server'}`);
        if (!backgroundOnly) SoundEngine.playTestComplete();
        await loadPersistedData();

        setTimeout(() => {
          setIsTestRunningLocal(false);
          setIsTestRunning(false);
          setCurrentType('Ready');
          resetLiveState();
        }, 2600);
      },
      (error) => {
        if (gaugeWhirRef.current) {
          clearInterval(gaugeWhirRef.current);
          gaugeWhirRef.current = null;
        }

        setIsTestRunningLocal(false);
        setIsTestRunning(false);
        setCurrentType('Error');
        resetLiveState();
        Alert.alert('Test Failed', error);
      },
      (pingSample) => setLivePing(pingSample),
      (type, value) => {
        if (!backgroundOnly) SoundEngine.playPhaseComplete();
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
    setIsTestRunningLocal(false);
    setIsTestRunning(false);
    setCurrentType('Ready');
    resetLiveState();
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

    return currentType === 'Ping' ? rawSpeed : convertSpeedFromMbps(rawSpeed, speedUnitKey);
  }, [currentType, downloadSpeed, liveDownload, livePing, liveUpload, speedUnitKey]);

  const gaugeMax = currentType === 'Ping' ? 1500 : convertSpeedFromMbps(200, speedUnitKey);

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
        return palette.accent;
      case 'Upload':
        return palette.accent2;
      case 'Ping':
        return palette.success;
      case 'Complete':
        return palette.accent;
      default:
        return t.textMuted;
    }
  })();

  const selectedBackgroundLabel = BACKGROUND_TEST_INTERVALS.find(
    (option) => option.minutes === settings.backgroundTestInterval,
  )?.label || 'Off';

  return (
    <View style={styles.container}>
      <LinearGradient colors={palette.bgGradient} style={StyleSheet.absoluteFill} />
      <ParticleField color={palette.particle} />
      <Animated.ScrollView
        style={{ opacity: contentFade }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {!settings.dataDisclosureAccepted ? (
          <LiquidGlass style={styles.disclosureCard} contentStyle={styles.disclosureContent}>
            <FlashTitle text="NETWORK DISCLOSURE" size="small" interval={5000} center />
            <Text style={styles.disclosureText}>
              Running a test sends traffic to Measurement Lab and Cloudflare and can use a noticeable amount of mobile data. Results stay on-device unless you export them.
            </Text>
            <View style={styles.disclosureActions}>
              <LiquidGlass
                onPress={openPolicy}
                borderRadius={999}
                blurIntensity={28}
                style={styles.secondaryAction}
                contentStyle={styles.actionContent}
              >
                <Text style={[styles.secondaryActionText, { color: t.textPrimary }]}>Review Policy</Text>
              </LiquidGlass>
              <LiquidGlass
                onPress={acknowledgeDisclosure}
                borderRadius={999}
                blurIntensity={28}
                style={styles.primaryAction}
                contentStyle={styles.actionContent}
              >
                <LinearGradient
                  colors={[palette.accent, palette.accent2]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <Text style={[styles.primaryActionText, { color: t.textPrimary }]}>I Understand</Text>
              </LiquidGlass>
            </View>
          </LiquidGlass>
        ) : null}

        <LiquidGlass
          style={[
            styles.gaugeCard,
            {
              borderColor: withAlpha(t.accentLight, 0.34),
              backgroundColor: withAlpha(t.accent, t.mode === 'dark' ? 0.16 : 0.08),
              shadowColor: t.accentDark,
            },
          ]}
          contentStyle={styles.gaugeCardContent}
        >
          <Speedometer
            speed={gaugeValue}
            maxValue={gaugeMax}
            label={gaugeLabel}
            unit={currentType === 'Ping' ? 'ms' : speedUnitLabel}
            needleColor={gaugeNeedleColor}
            isRunning={isTestRunning}
          />
        </LiquidGlass>

        <LiquidGlass
          onPress={isTestRunning ? stopTest : startTest}
          borderRadius={999}
          blurIntensity={32}
          style={styles.startButtonShell}
          contentStyle={styles.startButtonContent}
          disabled={!settings.dataDisclosureAccepted && !isTestRunning}
        >
          <LinearGradient
            colors={isTestRunning ? [palette.danger, palette.accent] : [palette.accent, palette.accent2]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <Text style={[styles.startButtonText, { color: t.textPrimary }]}>{isTestRunning ? 'Stop Test' : 'Start Test'}</Text>
        </LiquidGlass>

        {progressText ? <Text style={[styles.progressText, { color: t.textSecondary }]}>{progressText}</Text> : null}

        <View style={styles.statsGrid}>
          <StatCard
            label="Download"
            value={formatSpeedValue(downloadSpeed, speedUnitKey)}
            unit={speedUnitLabel}
            activePhase={currentType}
            footerText={peaks.download ? `Best ${formatSpeedValue(peaks.download, speedUnitKey, 1)} ${speedUnitLabel}` : 'Best pending'}
          />
          <StatCard
            label="Upload"
            value={formatSpeedValue(uploadSpeed, speedUnitKey)}
            unit={speedUnitLabel}
            activePhase={currentType}
            footerText={peaks.upload ? `Best ${formatSpeedValue(peaks.upload, speedUnitKey, 1)} ${speedUnitLabel}` : 'Best pending'}
          />
          {settings.showPing ? (
            <StatCard
              label="Ping"
              value={ping}
              unit="ms"
              activePhase={currentType}
              footerText={peaks.ping ? `Best ${formatPing(peaks.ping)}` : 'Best pending'}
            />
          ) : null}
        </View>

        <View style={styles.insightsWrap}>
          <InsightCard
            title="Connection Quality"
            value={connectionQuality.label}
            subtitle={connectionQuality.summary}
          />
          <InsightCard
            title="Last Test Traffic"
            value={lastTest ? formatBytes(lastTest.totalBytes || historySummary.totalDataUsedBytes) : 'No data yet'}
            subtitle={lastTest ? 'Download + upload payload used by the latest completed test.' : 'Run a test to see the actual traffic used.'}
          />
          <InsightCard
            title="Server Used"
            value={lastTest ? lastTest.serverName || 'Automatic' : 'Automatic'}
            subtitle={lastTest ? `${lastTest.serverLocation || 'Unknown'} • ${lastTest.provider || 'Measurement Lab'}` : 'The app automatically picks the best available endpoint.'}
          />
        </View>

        <View style={styles.iconRow}>
          <LiquidGlass
            onPress={() => setBackgroundIntervalOpen((value) => !value)}
            style={styles.iconButton}
            contentStyle={styles.iconButtonContent}
            borderRadius={20}
            blurIntensity={28}
          >
            <CycleIcon color={t.textPrimary} />
            <Text style={[styles.iconButtonText, { color: t.textPrimary }]}>Auto</Text>
          </LiquidGlass>
          <LiquidGlass
            onPress={shareLastResult}
            style={styles.iconButton}
            contentStyle={styles.iconButtonContent}
            borderRadius={20}
            blurIntensity={28}
          >
            <ShareIcon color={t.textPrimary} />
            <Text style={[styles.iconButtonText, { color: t.textPrimary }]}>Share</Text>
          </LiquidGlass>
        </View>

        {backgroundIntervalOpen ? (
          <LiquidGlass style={styles.intervalPanel} contentStyle={styles.intervalPanelContent}>
            <Text style={[styles.intervalTitle, { color: t.textPrimary }]}>Background Test Interval</Text>
            <Text style={[styles.intervalSubtitle, { color: t.textSecondary }]}>Current: {selectedBackgroundLabel}</Text>
            <View style={styles.intervalOptions}>
              {BACKGROUND_TEST_INTERVALS.map((option) => {
                const active = settings.backgroundTestInterval === option.minutes;
                return (
                  <LiquidGlass
                    key={option.key}
                    onPress={() => startBackgroundTests(option.minutes)}
                    style={[styles.intervalChip, active && styles.intervalChipActive]}
                    contentStyle={styles.intervalChipContent}
                    borderRadius={999}
                    blurIntensity={24}
                  >
                    {active ? (
                      <LinearGradient
                        colors={[palette.accent, palette.accent2]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={StyleSheet.absoluteFill}
                      />
                    ) : null}
                    <Text style={[styles.intervalChipText, { color: t.textPrimary }, active && styles.intervalChipTextActive]}>{option.label}</Text>
                  </LiquidGlass>
                );
              })}
            </View>
          </LiquidGlass>
        ) : null}

      </Animated.ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0e27',
  },
  content: {
    padding: 18,
    paddingBottom: 160,
  },
  particle: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  disclosureCard: {
    marginBottom: 18,
  },
  disclosureContent: {
    gap: 14,
  },
  disclosureText: {
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
  },
  disclosureActions: {
    flexDirection: 'row',
    gap: 10,
  },
  secondaryAction: {
    flex: 1,
    minHeight: 52,
  },
  primaryAction: {
    flex: 1,
    minHeight: 52,
  },
  actionContent: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryActionText: {
    fontSize: 13,
    fontWeight: '700',
  },
  primaryActionText: {
    fontSize: 13,
    fontWeight: '800',
  },
  gaugeCard: {
    marginBottom: 16,
    shadowOpacity: 0.4,
  },
  gaugeCardContent: {
    paddingHorizontal: 10,
    paddingVertical: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startButtonShell: {
    minHeight: 60,
    marginBottom: 14,
  },
  startButtonContent: {
    minHeight: 60,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startButtonText: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.8,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  },
  progressText: {
    fontSize: 12,
    fontStyle: 'italic',
    marginBottom: 10,
    textAlign: 'center',
    letterSpacing: 0.4,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 8,
    marginBottom: 18,
  },
  insightsWrap: {
    gap: 12,
  },
  insightCard: {
    width: '100%',
  },
  insightCardContent: {
    padding: 18,
  },
  insightTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  insightValue: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 6,
  },
  insightSubtitle: {
    fontSize: 13,
    lineHeight: 20,
  },
  iconRow: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
    marginTop: 18,
  },
  iconButton: {
    flex: 1,
    minHeight: 64,
  },
  iconButtonContent: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  iconButtonText: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  intervalPanel: {
    marginTop: 16,
  },
  intervalPanelContent: {
    padding: 18,
  },
  intervalTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  intervalSubtitle: {
    fontSize: 12,
    marginBottom: 14,
  },
  intervalOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  intervalChip: {
    minWidth: '30%',
  },
  intervalChipActive: {
    borderColor: 'rgba(255,255,255,0.34)',
  },
  intervalChipContent: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  intervalChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  intervalChipTextActive: {
  },
});

export default SpeedHomeLiquidScreen;

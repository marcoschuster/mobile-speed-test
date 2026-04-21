import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  LayoutChangeEvent,
  Platform,
  ScrollView,
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
import { useAppSettings } from '../context/AppSettingsContext';
import { useTabBarMotion } from '../context/TabBarMotionContext';
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
  { key: 'off', label: 'Off', seconds: null },
  { key: '1h', label: '1 Hour', seconds: 60 * 60 },
  { key: '3h', label: '3 Hours', seconds: 3 * 60 * 60 },
  { key: '6h', label: '6 Hours', seconds: 6 * 60 * 60 },
  { key: '12h', label: '12 Hours', seconds: 12 * 60 * 60 },
  { key: '1d', label: '1 Day', seconds: 24 * 60 * 60 },
];
const MAX_CUSTOM_INTERVAL = {
  days: 99,
  hours: 23,
  minutes: 59,
  seconds: 59,
} as const;
const MIN_PERFORMANCE_WARNING_SECONDS = 60 * 60;

type DurationParts = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
};

const clampDurationPart = (
  value: number,
  min: number,
  max: number,
) => Math.max(min, Math.min(max, Math.trunc(value)));

const durationPartsToSeconds = (parts: DurationParts) => (
  parts.days * 24 * 60 * 60 +
  parts.hours * 60 * 60 +
  parts.minutes * 60 +
  parts.seconds
);

const secondsToDurationParts = (totalSeconds: number): DurationParts => {
  const safe = Math.max(0, Math.min(totalSeconds, (((MAX_CUSTOM_INTERVAL.days * 24) + MAX_CUSTOM_INTERVAL.hours) * 60 + MAX_CUSTOM_INTERVAL.minutes) * 60 + MAX_CUSTOM_INTERVAL.seconds));
  const days = Math.floor(safe / (24 * 60 * 60));
  const dayRemainder = safe % (24 * 60 * 60);
  const hours = Math.floor(dayRemainder / (60 * 60));
  const hourRemainder = dayRemainder % (60 * 60);
  const minutes = Math.floor(hourRemainder / 60);
  const seconds = hourRemainder % 60;

  return { days, hours, minutes, seconds };
};

const formatIntervalLabel = (totalSeconds: number | null) => {
  if (!totalSeconds) {
    return 'Off';
  }

  const preset = BACKGROUND_TEST_INTERVALS.find((option) => option.seconds === totalSeconds);
  if (preset) {
    return preset.label;
  }

  const { days, hours, minutes, seconds } = secondsToDurationParts(totalSeconds);
  const parts = [
    days ? `${days}d` : null,
    hours ? `${hours}h` : null,
    minutes ? `${minutes}m` : null,
    seconds ? `${seconds}s` : null,
  ].filter(Boolean);

  return `Custom • ${parts.join(' ')}`;
};

const resolveStoredBackgroundIntervalSeconds = (
  settings: {
    backgroundTestInterval: number | null;
    backgroundTestIntervalSeconds?: number | null;
  },
) => settings.backgroundTestIntervalSeconds
  ?? (typeof settings.backgroundTestInterval === 'number'
    ? settings.backgroundTestInterval * 60
    : null);

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

const DownloadMetricIcon = ({ size = 18, color = '#FACC15' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path
      d="M12 4v12m0 0l-5-5m5 5l5-5M5 20h14"
      stroke={color}
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </Svg>
);

const UploadMetricIcon = ({ size = 18, color = '#4FC3F7' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path
      d="M12 20V8m0 0l-5 5m5-5l5 5M5 4h14"
      stroke={color}
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </Svg>
);

const PingMetricIcon = ({ size = 18, color = '#00C48C' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path
      d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z"
      fill={color}
    />
  </Svg>
);

const TEST_PHASE_ORDER = ['Download', 'Upload', 'Ping'] as const;
const PHASE_MARKER_SIZE = 46;

const MetricPhaseMarker = ({
  color,
}: {
  color: string;
}) => {
  const pulse = useRef(new Animated.Value(0)).current;
  const bars = useRef([
    new Animated.Value(0.42),
    new Animated.Value(0.85),
    new Animated.Value(0.56),
  ]).current;

  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 620,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 620,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    const barLoops = bars.map((bar, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 110),
          Animated.timing(bar, {
            toValue: 1,
            duration: 240,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(bar, {
            toValue: 0.42,
            duration: 240,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ])
      )
    );

    pulseLoop.start();
    barLoops.forEach((loop) => loop.start());

    return () => {
      pulseLoop.stop();
      barLoops.forEach((loop) => loop.stop());
    };
  }, [bars, pulse]);

  return (
    <View style={styles.metricMarkerWrap}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.metricMarkerHalo,
          {
            backgroundColor: `${color}22`,
            opacity: pulse.interpolate({
              inputRange: [0, 1],
              outputRange: [0.18, 0.38],
            }),
            transform: [
              {
                scale: pulse.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.9, 1.28],
                }),
              },
            ],
          },
        ]}
      />
      <View style={styles.metricPillsRow}>
        {bars.map((bar, index) => (
          <Animated.View
            key={index}
            style={[
              styles.metricPill,
              {
                backgroundColor: color,
                opacity: bar,
                transform: [{ scaleY: bar }],
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
};

const MetricSlot = ({
  icon,
  color,
  value,
  unit,
  active,
  complete,
  placeholder,
}: {
  icon: React.ReactNode;
  color: string;
  value: string;
  unit: string;
  active: boolean;
  complete: boolean;
  placeholder: boolean;
}) => {
  const revealOpacity = useRef(new Animated.Value(complete && !active ? 1 : 0)).current;
  const revealTranslateY = useRef(new Animated.Value(complete && !active ? 0 : 10)).current;
  const placeholderOpacity = useRef(new Animated.Value(placeholder ? 1 : 0)).current;
  const placeholderTranslateY = useRef(new Animated.Value(placeholder ? 0 : 8)).current;

  useEffect(() => {
    if (complete && !active) {
      Animated.parallel([
        Animated.timing(revealOpacity, {
          toValue: 1,
          duration: 260,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(revealTranslateY, {
          toValue: 0,
          duration: 260,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start();
      return;
    }

    revealOpacity.setValue(0);
    revealTranslateY.setValue(10);
  }, [active, complete, revealOpacity, revealTranslateY]);

  useEffect(() => {
    if (placeholder) {
      Animated.parallel([
        Animated.timing(placeholderOpacity, {
          toValue: 1,
          duration: 180,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(placeholderTranslateY, {
          toValue: 0,
          duration: 180,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start();
      return;
    }

    Animated.parallel([
      Animated.timing(placeholderOpacity, {
        toValue: 0,
        duration: 130,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(placeholderTranslateY, {
        toValue: 8,
        duration: 130,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [placeholder, placeholderOpacity, placeholderTranslateY]);

  return (
    <View style={styles.metricSlot}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.metricValueWrap,
          styles.metricPlaceholderWrap,
          {
            opacity: placeholderOpacity,
            transform: [{ translateY: placeholderTranslateY }],
          },
        ]}
      >
        <View style={styles.metricIconWrap}>
          {icon}
        </View>
        <Text
          style={[
            styles.metricValue,
            styles.metricPlaceholderValue,
            {
              color,
            },
          ]}
        >
          ?
        </Text>
      </Animated.View>
      <Animated.View
        style={[
          styles.metricValueWrap,
          {
            opacity: revealOpacity,
            transform: [{ translateY: revealTranslateY }],
          },
        ]}
      >
        <View style={styles.metricIconWrap}>
          {icon}
        </View>
        <Text
          style={[
            styles.metricValue,
            {
              color,
            },
          ]}
        >
          {value}
        </Text>
        <Text style={styles.metricUnit}>{unit}</Text>
      </Animated.View>
    </View>
  );
};

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

const DurationPickerColumn = ({
  label,
  value,
  max,
  onChange,
}: {
  label: string;
  value: number;
  max: number;
  onChange: (nextValue: number) => void;
}) => {
  const { t } = useTheme();

  return (
    <View style={styles.durationColumn}>
      <Text style={[styles.durationColumnLabel, { color: t.textSecondary }]}>{label}</Text>
      <LiquidGlass
        onPress={() => onChange(clampDurationPart(value + 1, 0, max))}
        style={styles.durationAdjustButton}
        contentStyle={styles.durationAdjustButtonContent}
        borderRadius={16}
        blurIntensity={24}
      >
        <Text style={[styles.durationAdjustText, { color: t.textPrimary }]}>+</Text>
      </LiquidGlass>
      <View style={[styles.durationValueWrap, { borderColor: withAlpha(t.textPrimary, 0.14) }]}>
        <Text style={[styles.durationValueText, { color: t.textPrimary }]}>{String(value).padStart(2, '0')}</Text>
      </View>
      <LiquidGlass
        onPress={() => onChange(clampDurationPart(value - 1, 0, max))}
        style={styles.durationAdjustButton}
        contentStyle={styles.durationAdjustButtonContent}
        borderRadius={16}
        blurIntensity={24}
      >
        <Text style={[styles.durationAdjustText, { color: t.textPrimary }]}>-</Text>
      </LiquidGlass>
    </View>
  );
};

const SpeedHomeLiquidScreen = () => {
  const { t } = useTheme();
  const { settings, updateSettings } = useAppSettings();
  const { setIsTestRunning } = useTestContext();
  const { setTabBarMode } = useTabBarMotion();
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
  const [hasTestCompleted, setHasTestCompleted] = useState(false);
  const [peaks, setPeaks] = useState({ download: 0, upload: 0, ping: 0 });
  const [backgroundIntervalOpen, setBackgroundIntervalOpen] = useState(false);
  const [customIntervalOpen, setCustomIntervalOpen] = useState(false);
  const [customInterval, setCustomInterval] = useState<DurationParts>({
    days: 0,
    hours: 1,
    minutes: 0,
    seconds: 0,
  });
  const [backgroundTimer, setBackgroundTimer] = useState<ReturnType<typeof setInterval> | null>(null);
  const [metricTrackWidth, setMetricTrackWidth] = useState(0);
  const [runnerVisible, setRunnerVisible] = useState(false);
  const gaugeWhirRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const liveSpeedRef = useRef(0);
  const contentFade = useRef(new Animated.Value(0)).current;
  const runnerX = useRef(new Animated.Value(0)).current;
  const runnerY = useRef(new Animated.Value(400)).current;
  const runnerOpacity = useRef(new Animated.Value(0)).current;
  const runnerScale = useRef(new Animated.Value(0.92)).current;
  const runnerMounted = useRef(false);
  const lastScrollY = useRef(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const insightsOpacity = useRef(new Animated.Value(hasTestCompleted ? 1 : 0)).current;
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

  const pushLiveSample = useCallback((kind: 'download' | 'upload' | 'ping', value: number) => {
    if (kind === 'download') setLiveDownload(value);
    else if (kind === 'upload') setLiveUpload(value);
    else setLivePing(value);
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
    setTabBarMode('expanded');
    lastScrollY.current = 0;
    loadPersistedData();
  }, [loadPersistedData, setTabBarMode]));

  const handleScroll = useCallback((event: any) => {
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
  }, [setTabBarMode]);

  // Animate insights when test completes
  useEffect(() => {
    if (hasTestCompleted) {
      Animated.timing(insightsOpacity, {
        toValue: 1,
        duration: 400,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
    }
  }, [hasTestCompleted]);

  const qualitySource = {
    download: downloadSpeed || lastTest?.download || 0,
    upload: uploadSpeed || lastTest?.upload || 0,
    ping: ping || lastTest?.ping || 0,
  };
  const connectionQuality = getConnectionQuality(qualitySource);
  const currentBackgroundIntervalSeconds = resolveStoredBackgroundIntervalSeconds(settings);
  const customIntervalSeconds = durationPartsToSeconds(customInterval);
  const customIntervalSummaryLabel = customIntervalSeconds > 0
    ? formatIntervalLabel(customIntervalSeconds).replace('Custom • ', '')
    : '0s';
  const hasActivePresetInterval = BACKGROUND_TEST_INTERVALS.some(
    (option) => option.seconds === currentBackgroundIntervalSeconds,
  );

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

    const seconds = minutes;

    await updateSettings({
      backgroundTestInterval:
        typeof seconds === 'number' && seconds % 60 === 0
          ? seconds / 60
          : null,
      backgroundTestIntervalSeconds: seconds,
    });

    if (!seconds) return;

    const interval = setInterval(() => {
      if (!SpeedTestService.isTestRunning) {
        runTest(true);
      }
    }, seconds * 1000);

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
        if (type === 'download' || type === 'upload') {
          pushLiveSample(type, speed);
        }
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
          setHasTestCompleted(true);

          // Auto-scroll to show stats cards and hide nav bar
          setTimeout(() => {
            scrollViewRef.current?.scrollTo({ y: 300, animated: true });
            setTabBarMode('hidden');
          }, 300);
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
      (pingSample) => pushLiveSample('ping', pingSample),
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

  const updateCustomIntervalPart = useCallback((
    key: keyof DurationParts,
    nextValue: number,
  ) => {
    setCustomInterval((previous) => ({
      ...previous,
      [key]: clampDurationPart(nextValue, 0, MAX_CUSTOM_INTERVAL[key]),
    }));
  }, []);

  const applyCustomInterval = useCallback(() => {
    if (customIntervalSeconds <= 0) {
      Alert.alert('Choose a valid interval', 'Set at least one second for the custom background test interval.');
      return;
    }

    startBackgroundTests(customIntervalSeconds);
    setCustomIntervalOpen(false);
  }, [customIntervalSeconds]);

  const gaugeValue = useMemo(() => {
    const rawSpeed = (() => {
      switch (currentType) {
        case 'Download':
          return liveDownload;
        case 'Upload':
          return liveUpload;
        case 'Ping':
          return livePing;
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
        return t.uploadLine;
      case 'Ping':
        return palette.success;
      case 'Complete':
        return palette.accent;
      default:
        return t.textMuted;
    }
  })();

  const runnerSpeed = useMemo(() => {
    switch (currentType) {
      case 'Download':
        return liveDownload;
      case 'Upload':
        return liveUpload;
      case 'Ping':
        return Math.max(40, 220 - livePing * 7);
      default:
        return 72;
    }
  }, [currentType, liveDownload, livePing, liveUpload]);

  const runnerLabel = currentType === 'Testing' ? 'Connecting' : currentType;
  const runnerColor = currentType === 'Upload'
    ? t.uploadLine
    : currentType === 'Ping'
      ? t.success
      : '#FACC15';

  const getPhaseSlotCenter = useCallback((phase: typeof TEST_PHASE_ORDER[number]) => {
    if (!metricTrackWidth) {
      return 0;
    }

    const index = TEST_PHASE_ORDER.indexOf(phase);
    const slotWidth = metricTrackWidth / TEST_PHASE_ORDER.length;
    return slotWidth * index + slotWidth / 2;
  }, [metricTrackWidth]);

  const animateRunnerToPhase = useCallback((phase: typeof TEST_PHASE_ORDER[number]) => {
    if (!metricTrackWidth) {
      return;
    }

    const targetX = getPhaseSlotCenter(phase) - PHASE_MARKER_SIZE / 2;

    if (!runnerMounted.current) {
      runnerMounted.current = true;
      setRunnerVisible(true);
      runnerX.setValue(targetX - 18);
      runnerY.setValue(10);
      runnerOpacity.setValue(0);
      runnerScale.setValue(0.92);

      Animated.parallel([
        Animated.timing(runnerOpacity, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(runnerScale, {
          toValue: 1,
          duration: 200,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(runnerY, {
          toValue: 0,
          duration: 280,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(runnerX, {
          toValue: targetX,
          duration: 320,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
      return;
    }

    Animated.parallel([
      Animated.timing(runnerX, {
        toValue: targetX,
        duration: 420,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(runnerY, {
          toValue: -6,
          duration: 140,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(runnerY, {
          toValue: 0,
          duration: 220,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [getPhaseSlotCenter, metricTrackWidth, runnerOpacity, runnerScale, runnerX, runnerY]);

  const exitRunner = useCallback(() => {
    if (!metricTrackWidth || !runnerMounted.current) {
      return;
    }

    Animated.parallel([
      Animated.timing(runnerX, {
        toValue: metricTrackWidth + 28,
        duration: 340,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(runnerOpacity, {
        toValue: 0,
        duration: 240,
        useNativeDriver: true,
      }),
    ]).start(() => {
      runnerMounted.current = false;
      setRunnerVisible(false);
      runnerY.setValue(10);
      runnerScale.setValue(0.92);
    });
  }, [metricTrackWidth, runnerOpacity, runnerScale, runnerX, runnerY]);

  useEffect(() => {
    if (currentType === 'Download' || currentType === 'Upload' || currentType === 'Ping') {
      animateRunnerToPhase(currentType);
      return;
    }

    if (currentType === 'Complete') {
      exitRunner();
      return;
    }

    if (!isTestRunning) {
      runnerMounted.current = false;
      setRunnerVisible(false);
      runnerOpacity.setValue(0);
      runnerY.setValue(10);
      runnerScale.setValue(0.92);
    }
  }, [animateRunnerToPhase, currentType, exitRunner, isTestRunning, runnerOpacity, runnerScale, runnerY]);

  const selectedBackgroundLabel = formatIntervalLabel(currentBackgroundIntervalSeconds);

  const metricSlots = [
    {
      key: 'Download',
      color: '#FACC15',
      value: formatSpeedValue(downloadSpeed, speedUnitKey),
      unit: speedUnitLabel,
      complete: downloadSpeed > 0,
      icon: <DownloadMetricIcon color="#FACC15" />,
    },
    {
      key: 'Upload',
      color: t.uploadLine,
      value: formatSpeedValue(uploadSpeed, speedUnitKey),
      unit: speedUnitLabel,
      complete: uploadSpeed > 0,
      icon: <UploadMetricIcon color={t.uploadLine} />,
    },
    {
      key: 'Ping',
      color: t.success,
      value: String(Math.round(ping || 0)),
      unit: 'ms',
      complete: ping > 0,
      icon: <PingMetricIcon color={t.success} />,
    },
  ] as const;
  const shouldShowMetricTrack = isTestRunning || metricSlots.some((slot) => slot.complete);

  const handleMetricTrackLayout = (event: LayoutChangeEvent) => {
    const { width } = event.nativeEvent.layout;
    if (width !== metricTrackWidth) {
      setMetricTrackWidth(width);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={palette.bgGradient || ['#0a0e27', '#1a1f3a', '#2d1b69']} style={StyleSheet.absoluteFill} />
      <ParticleField color={palette.particle || '#8B5CF6'} />
      <Animated.ScrollView
        ref={scrollViewRef}
        style={{ opacity: contentFade }}
        contentContainerStyle={styles.content}
        onScroll={handleScroll}
        scrollEventThrottle={16}
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
                  colors={[palette.accent || '#8B5CF6', palette.accent2 || '#6366f1']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <Text style={[styles.primaryActionText, { color: t.textPrimary }]}>I Understand</Text>
              </LiquidGlass>
            </View>
          </LiquidGlass>
        ) : null}

        <Speedometer
          speed={gaugeValue}
          maxValue={gaugeMax}
          label={gaugeLabel}
          unit={currentType === 'Ping' ? 'ms' : speedUnitLabel}
          needleColor={gaugeNeedleColor}
          isRunning={isTestRunning}
          onStart={startTest}
          onStop={stopTest}
        />

        {shouldShowMetricTrack ? (
          <View style={styles.metricTrack} onLayout={handleMetricTrackLayout}>
            {runnerVisible ? (
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.runnerOverlay,
                  {
                    opacity: runnerOpacity,
                    transform: [
                      { translateX: runnerX },
                      { translateY: runnerY },
                      { scale: runnerScale },
                    ],
                  },
                ]}
              >
                <MetricPhaseMarker color={runnerColor} />
              </Animated.View>
            ) : null}

            <View style={styles.metricRow}>
              {metricSlots.map((slot) => {
                const active = currentType === slot.key && isTestRunning;
                const placeholder = isTestRunning && !slot.complete && !active;

                return (
                  <MetricSlot
                    key={slot.key}
                    icon={slot.icon}
                    color={slot.color}
                    value={slot.value}
                    unit={slot.unit}
                    active={active}
                    complete={slot.complete}
                    placeholder={placeholder}
                  />
                );
              })}
            </View>
          </View>
        ) : null}

        {!isTestRunning && progressText ? (
          <Text style={[styles.progressText, { color: t.textSecondary }]}>{progressText}</Text>
        ) : null}

        <Animated.View style={[styles.insightsWrap, { opacity: insightsOpacity }]}>
          <InsightCard
            title="Connection Quality"
            value={isTestRunning || !hasTestCompleted ? 'Waiting...' : connectionQuality.label}
            subtitle={isTestRunning || !hasTestCompleted ? 'Run a test to assess your connection quality.' : connectionQuality.summary}
          />
          <InsightCard
            title="Last Test Traffic"
            value={isTestRunning || !hasTestCompleted ? '---' : formatBytes(lastTest?.totalBytes || historySummary.totalDataUsedBytes)}
            subtitle={isTestRunning || !hasTestCompleted ? 'Run a test to see the actual traffic used.' : 'Download + upload payload used by the latest completed test.'}
          />
          <InsightCard
            title="Server Used"
            value={isTestRunning || !hasTestCompleted ? 'Waiting...' : (lastTest?.serverName || 'Automatic')}
            subtitle={isTestRunning || !hasTestCompleted ? 'Searching for optimal server...' : `${lastTest?.serverLocation || 'Unknown'} • ${lastTest?.provider || 'Measurement Lab'}`}
          />
        </Animated.View>

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
            <Text numberOfLines={1} ellipsizeMode="clip" style={[styles.iconButtonText, { color: t.textPrimary }]}>Share</Text>
          </LiquidGlass>
        </View>

        {backgroundIntervalOpen ? (
          <LiquidGlass style={styles.intervalPanel} contentStyle={styles.intervalPanelContent}>
            <Text style={[styles.intervalTitle, { color: t.textPrimary }]}>Background Test Interval</Text>
            <Text style={[styles.intervalSubtitle, { color: t.textSecondary }]}>Current: {selectedBackgroundLabel}</Text>
            <View style={styles.intervalOptions}>
              {BACKGROUND_TEST_INTERVALS.map((option) => {
                const active = currentBackgroundIntervalSeconds === option.seconds;
                return (
                  <LiquidGlass
                    key={option.key}
                    onPress={() => {
                      setCustomIntervalOpen(false);
                      startBackgroundTests(option.seconds);
                    }}
                    style={[styles.intervalChip, active && styles.intervalChipActive]}
                    contentStyle={styles.intervalChipContent}
                    borderRadius={999}
                    blurIntensity={24}
                  >
                    {active ? (
                      <LinearGradient
                        colors={[palette.accent || '#8B5CF6', palette.accent2 || '#6366f1']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={StyleSheet.absoluteFill}
                      />
                    ) : null}
                    <Text style={[styles.intervalChipText, { color: t.textPrimary }, active && styles.intervalChipTextActive]}>{option.label}</Text>
                  </LiquidGlass>
                );
              })}
              <LiquidGlass
                onPress={() => {
                  setCustomIntervalOpen((value) => !value);
                  if (!customIntervalOpen) {
                    setCustomInterval(
                      secondsToDurationParts(currentBackgroundIntervalSeconds || (60 * 60)),
                    );
                  }
                }}
                style={[
                  styles.intervalChip,
                  customIntervalOpen && styles.intervalChipActive,
                  !hasActivePresetInterval && currentBackgroundIntervalSeconds
                    ? styles.intervalChipActive
                    : null,
                ]}
                contentStyle={styles.intervalChipContent}
                borderRadius={999}
                blurIntensity={24}
              >
                {customIntervalOpen || (!hasActivePresetInterval && currentBackgroundIntervalSeconds) ? (
                  <LinearGradient
                    colors={[palette.accent || '#8B5CF6', palette.accent2 || '#6366f1']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                ) : null}
                <Text style={[styles.intervalChipText, { color: t.textPrimary }, (customIntervalOpen || (!hasActivePresetInterval && currentBackgroundIntervalSeconds)) && styles.intervalChipTextActive]}>
                  Custom
                </Text>
              </LiquidGlass>
            </View>
            {customIntervalOpen ? (
              <View style={styles.customIntervalWrap}>
                <Text style={[styles.customIntervalTitle, { color: t.textPrimary }]}>Custom Interval</Text>
                <Text style={[styles.customIntervalSubtitle, { color: t.textSecondary }]}>
                  Pick a repeating timer up to 99 days, 23 hours, 59 minutes, and 59 seconds.
                </Text>
                <View style={styles.durationPickerRow}>
                  <DurationPickerColumn
                    label="Days"
                    value={customInterval.days}
                    max={MAX_CUSTOM_INTERVAL.days}
                    onChange={(nextValue) => updateCustomIntervalPart('days', nextValue)}
                  />
                  <DurationPickerColumn
                    label="Hours"
                    value={customInterval.hours}
                    max={MAX_CUSTOM_INTERVAL.hours}
                    onChange={(nextValue) => updateCustomIntervalPart('hours', nextValue)}
                  />
                  <DurationPickerColumn
                    label="Min"
                    value={customInterval.minutes}
                    max={MAX_CUSTOM_INTERVAL.minutes}
                    onChange={(nextValue) => updateCustomIntervalPart('minutes', nextValue)}
                  />
                  <DurationPickerColumn
                    label="Sec"
                    value={customInterval.seconds}
                    max={MAX_CUSTOM_INTERVAL.seconds}
                    onChange={(nextValue) => updateCustomIntervalPart('seconds', nextValue)}
                  />
                </View>
                <Text style={[styles.customIntervalSummary, { color: t.textPrimary }]}>
                  Repeats every {customIntervalSummaryLabel}
                </Text>
                {customIntervalSeconds > 0 && customIntervalSeconds < MIN_PERFORMANCE_WARNING_SECONDS ? (
                  <Text style={[styles.intervalWarning, { color: palette.danger || '#FF6B6B' }]}>
                    Intervals under 1 hour may reduce phone performance and heat up the device.
                  </Text>
                ) : null}
                <LiquidGlass
                  onPress={applyCustomInterval}
                  style={styles.customApplyButton}
                  contentStyle={styles.customApplyButtonContent}
                  borderRadius={18}
                  blurIntensity={26}
                >
                  <LinearGradient
                    colors={[palette.accent || '#8B5CF6', palette.accent2 || '#6366f1']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                  <Text style={[styles.customApplyButtonText, { color: t.textPrimary }]}>Apply Custom Interval</Text>
                </LiquidGlass>
              </View>
            ) : null}
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
    marginTop: 6,
    marginBottom: 10,
    textAlign: 'center',
    letterSpacing: 0.4,
  },
  metricTrack: {
    width: '100%',
    minHeight: 122,
    marginTop: 10,
    marginBottom: 18,
    position: 'relative',
    justifyContent: 'center',
  },
  metricRow: {
    flexDirection: 'row',
    width: '100%',
    alignItems: 'center',
  },
  metricSlot: {
    flex: 1,
    minHeight: 94,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  metricIconWrap: {
    minHeight: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricValueWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  metricPlaceholderWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  metricValue: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  metricPlaceholderValue: {
    fontSize: 28,
    lineHeight: 30,
  },
  metricUnit: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.54)',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  metricMarkerWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 52,
    height: 32,
  },
  metricMarkerHalo: {
    position: 'absolute',
    width: 52,
    height: 28,
    borderRadius: 999,
  },
  metricPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    height: 20,
  },
  metricPill: {
    width: 8,
    height: 18,
    borderRadius: 999,
  },
  runnerOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 52,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
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
    minWidth: 88,
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
  customIntervalWrap: {
    marginTop: 16,
    gap: 12,
  },
  customIntervalTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  customIntervalSubtitle: {
    fontSize: 12,
    lineHeight: 18,
  },
  durationPickerRow: {
    flexDirection: 'row',
    gap: 10,
  },
  durationColumn: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  durationColumnLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  durationAdjustButton: {
    width: '100%',
    minHeight: 42,
  },
  durationAdjustButtonContent: {
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationAdjustText: {
    fontSize: 24,
    fontWeight: '500',
    lineHeight: 24,
  },
  durationValueWrap: {
    width: '100%',
    minHeight: 60,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  durationValueText: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  customIntervalSummary: {
    fontSize: 13,
    fontWeight: '700',
  },
  intervalWarning: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
  },
  customApplyButton: {
    marginTop: 2,
  },
  customApplyButtonContent: {
    minHeight: 54,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customApplyButtonText: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});

export default SpeedHomeLiquidScreen;

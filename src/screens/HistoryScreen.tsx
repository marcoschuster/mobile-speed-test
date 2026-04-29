import React, { useState, useEffect, useRef, useMemo, useCallback, ReactNode } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  Pressable,
  Alert,
  RefreshControl,
  Animated,
  PanResponder,
  Share,
  ViewStyle,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Svg, { Polygon, Path } from 'react-native-svg';
import SpeedTestService from '../services/SpeedTestService';
import LiquidGlass from '../components/LiquidGlass';
import { useAppSettings } from '../context/AppSettingsContext';
import { useTabBarMotion } from '../context/TabBarMotionContext';
import { buildHistoryCsv, summarizeHistory } from '../utils/history';
import { formatBytes, formatSpeedValue, getSpeedUnitLabel } from '../utils/measurements';
import { COLORS, RADIUS, useTheme, withAlpha } from '../utils/theme';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// ── Type Definitions ─────────────────────────────────────────────────────────
interface IconProps {
  size?: number;
  color?: string;
}

interface CalendarProps {
  history: any[];
  selectedDate: string | null;
  onSelectDate: (dateKey: string) => void;
  onClearSelection: () => void;
}

interface CalendarCell {
  day: number | null;
  key: string;
  dateKey?: string;
}

interface PulsingDateProps {
  text: string;
  baseColor: string;
  accentColor: string;
}

interface HistoryCardProps {
  item: any;
  index: number;
  formatDate: (dateString: string) => string;
  speedUnit: any;
  speedUnitLabel: string;
  onDelete: (item: any, resetSwipe?: () => void) => void;
}

interface SummaryStripProps {
  history: any[];
  speedUnit: any;
  speedUnitLabel: string;
}

// ── Small inline icons ──────────────────────────────────────────────────────
const DownloadIcon = ({ size = 13, color }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M12 4v12m0 0l-5-5m5 5l5-5M5 20h14" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </Svg>
);
const UploadIcon = ({ size = 13, color }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M12 20V8m0 0l-5 5m5-5l5 5M5 4h14" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </Svg>
);
const PingIcon = ({ size = 13, color = COLORS.success }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z" fill={color} />
  </Svg>
);
const CalendarIcon = ({ size = 16, color }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2z" fill={color} />
  </Svg>
);
const ChevronLeft = ({ size = 18, color }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" fill={color} />
  </Svg>
);
const ChevronRight = ({ size = 18, color }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12z" fill={color} />
  </Svg>
);
const TrashIcon = ({ size = 16, color = COLORS.danger }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M9 3h6l1 2h4v2H4V5h4l1-2zm1 7h2v8h-2v-8zm4 0h2v8h-2v-8zM7 10h2v8H7v-8zm-1 10h12l1-13H5l1 13z" fill={color} />
  </Svg>
);

const SWIPE_REVEAL_WIDTH = 92;
const SWIPE_DELETE_THRESHOLD = 148;

// ── Calendar helpers ────────────────────────────────────────────────────────
const toDateKey = (d: Date): string => {
  const yr = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const dy = String(d.getDate()).padStart(2, '0');
  return `${yr}-${mo}-${dy}`;
};

const getMonthName = (month: number, year: number): string => {
  const d = new Date(year, month);
  return d.toLocaleString('default', { month: 'long' });
};

const buildCalendarGrid = (year: number, month: number): CalendarCell[] => {
  // First day of the month
  const firstDay = new Date(year, month, 1);
  // Day of week: JS 0=Sun, we want Mon=0
  let startDow = firstDay.getDay() - 1;
  if (startDow < 0) startDow = 6; // Sunday wraps to 6

  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: CalendarCell[] = [];

  // Leading blanks
  for (let i = 0; i < startDow; i++) {
    cells.push({ day: null, key: `blank-start-${i}` });
  }

  // Actual days
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, key: `day-${d}`, dateKey: toDateKey(new Date(year, month, d)) });
  }

  // Trailing blanks to fill last row
  while (cells.length % 7 !== 0) {
    cells.push({ day: null, key: `blank-end-${cells.length}` });
  }

  return cells;
};

// ── Calendar Component ──────────────────────────────────────────────────────
const Calendar = ({ history, selectedDate, onSelectDate, onClearSelection }: CalendarProps) => {
  const { t } = useTheme();
  const isDark = t.mode === 'dark';
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  // Build a Set of date keys that have test history
  const testDays = useMemo(() => {
    const set = new Set<string>();
    const safeHistory = Array.isArray(history) ? history : [];
    safeHistory.forEach((item) => {
      if (!item?.date) return;
      const d = new Date(item.date);
      set.add(toDateKey(d));
    });
    return set;
  }, [history]);

  const cells = useMemo(() => buildCalendarGrid(viewYear, viewMonth), [viewYear, viewMonth]);

  const todayKey = toDateKey(today);

  const goToPrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const goToNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const cardTint = t.accentTintCard;

  return (
    <LiquidGlass style={calStyles.container} borderRadius={RADIUS.lg} contentStyle={calStyles.containerContent}>
      <View style={[calStyles.gradientTint, { backgroundColor: cardTint }]} />

      {/* Month navigation */}
      <View style={calStyles.navRow}>
        <TouchableOpacity onPress={goToPrevMonth} activeOpacity={0.6} style={calStyles.navBtn}>
          <ChevronLeft color={t.textSecondary} />
        </TouchableOpacity>
        <Text style={[calStyles.monthLabel, { color: t.textPrimary }]}>
          {getMonthName(viewMonth, viewYear)} {viewYear}
        </Text>
        <TouchableOpacity onPress={goToNextMonth} activeOpacity={0.6} style={calStyles.navBtn}>
          <ChevronRight color={t.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Weekday headers */}
      <View style={calStyles.weekdayRow}>
        {WEEKDAYS.map((wd) => (
          <View key={wd} style={calStyles.weekdayCell}>
            <Text style={[calStyles.weekdayText, { color: t.textMuted, textShadowColor: 'rgba(0, 0, 0, 0.2)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 1.5 }]}>{wd}</Text>
          </View>
        ))}
      </View>

      {/* Day grid */}
      <View style={calStyles.grid}>
        {cells.map((cell) => {
          if (cell.day === null) {
            return <View key={cell.key} style={calStyles.dayCell} />;
          }

          const hasTest = testDays.has(cell.dateKey!);
          const isSelected = selectedDate === cell.dateKey;
          const isToday = cell.dateKey === todayKey;

          return (
            <TouchableOpacity
              key={cell.key}
              style={[
                calStyles.dayCell,
                hasTest && calStyles.dayCellHasTest,
                hasTest && { backgroundColor: t.accentTintStrong },
                isSelected && [calStyles.dayCellSelected, { backgroundColor: t.accent }],
              ]}
              activeOpacity={0.6}
              onPress={() => {
                if (isSelected) {
                  onClearSelection();
                } else {
                  onSelectDate(cell.dateKey!);
                }
              }}
            >
              <Text
                style={[
                  calStyles.dayText,
                  { color: t.textSecondary, textShadowColor: 'rgba(0, 0, 0, 0.2)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 1.5 },
                  hasTest && { color: t.accent, fontWeight: '800' },
                  isSelected && { color: COLORS.black },
                  isToday && !isSelected && !hasTest && { color: t.textPrimary, fontWeight: '700' },
                ]}
              >
                {cell.day}
              </Text>
              {isToday && !isSelected && (
                <View style={[calStyles.todayDot, { backgroundColor: t.accent }]} />
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Filter indicator */}
      {selectedDate && (
        <TouchableOpacity style={calStyles.clearRow} onPress={onClearSelection} activeOpacity={0.7}>
          <Text style={[calStyles.clearText, { color: t.accent }]}>
            Showing: {formatDateKeyNice(selectedDate)}
          </Text>
          <Text style={[calStyles.clearAction, { color: t.accent }]}>Show All</Text>
        </TouchableOpacity>
      )}
    </LiquidGlass>
  );
};

const formatDateKeyNice = (dateKey: string): string => {
  const [y, m, d] = dateKey.split('-');
  const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
  return date.toLocaleDateString('default', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
};

const calStyles = StyleSheet.create({
  container: {
    marginHorizontal: 16, marginTop: 12, borderRadius: RADIUS.lg, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 4,
    paddingBottom: 4,
  },
  containerContent: {
    padding: 0,
  },
  gradientTint: { ...StyleSheet.absoluteFillObject, borderRadius: RADIUS.lg },
  navRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 8, paddingTop: 14, paddingBottom: 8,
  },
  navBtn: { padding: 6 },
  monthLabel: { fontSize: 15, fontWeight: '800', letterSpacing: 0.5 },
  weekdayRow: { flexDirection: 'row', paddingHorizontal: 6, marginBottom: 4 },
  weekdayCell: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  weekdayText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 6, paddingBottom: 8 },
  dayCell: {
    width: '14.285%', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 8, borderRadius: 10,
  },
  dayCellHasTest: {
    borderRadius: 10,
  },
  dayCellSelected: {
    borderRadius: 10,
  },
  dayText: { fontSize: 13, fontWeight: '500' },
  todayDot: {
    width: 4, height: 4, borderRadius: 2,
    marginTop: 2,
  },
  clearRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.06)',
  },
  clearText: { 
    fontSize: 12, 
    fontWeight: '600', 
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1.5,
  },
  clearAction: { 
    fontSize: 12, 
    fontWeight: '700', 
    textDecorationLine: 'underline',
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1.5,
  },
});

// ── Animated date with pulsing yellow on hover ──────────────────────────────
const PulsingDate = ({ text, baseColor, accentColor }: PulsingDateProps) => {
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const pulseRef = useRef<Animated.CompositeAnimation | null>(null);

  const startPulse = () => {
    pulseRef.current = Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: false }),
      Animated.timing(pulseAnim, { toValue: 0, duration: 600, useNativeDriver: false }),
    ]));
    pulseRef.current.start();
  };

  const stopPulse = () => {
    if (pulseRef.current) pulseRef.current.stop();
    Animated.timing(pulseAnim, { toValue: 0, duration: 200, useNativeDriver: false }).start();
  };

  const color = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [baseColor, accentColor],
  });

  return (
    <Pressable onHoverIn={startPulse} onHoverOut={stopPulse} onPressIn={startPulse} onPressOut={stopPulse}>
      <Animated.Text style={[styles.historyDate, { color }]}>{text}</Animated.Text>
    </Pressable>
  );
};

// ── Animated History Card ───────────────────────────────────────────────────
const HistoryCard = ({ item, index, formatDate, speedUnit, speedUnitLabel, onDelete }: HistoryCardProps) => {
  const { t } = useTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const swipeOpenRef = useRef(false);

  useEffect(() => {
    const delay = Math.min(index * 80, 600);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 350, delay, useNativeDriver: false }),
      Animated.timing(slideAnim, { toValue: 0, duration: 350, delay, useNativeDriver: false }),
    ]).start();
  }, []);

  const closeSwipe = useCallback(() => {
    swipeOpenRef.current = false;
    Animated.spring(translateX, {
      toValue: 0,
      damping: 18,
      stiffness: 180,
      mass: 0.9,
      useNativeDriver: true,
    }).start();
  }, [translateX]);

  const openSwipe = useCallback(() => {
    swipeOpenRef.current = true;
    Animated.spring(translateX, {
      toValue: -SWIPE_REVEAL_WIDTH,
      damping: 18,
      stiffness: 180,
      mass: 0.9,
      useNativeDriver: true,
    }).start();
  }, [translateX]);

  const triggerDelete = useCallback(() => {
    onDelete(item, closeSwipe);
  }, [closeSwipe, item, onDelete]);

  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gestureState) => (
      Math.abs(gestureState.dx) > Math.abs(gestureState.dy) &&
      Math.abs(gestureState.dx) > 8
    ),
    onPanResponderMove: (_, gestureState) => {
      const base = swipeOpenRef.current ? -SWIPE_REVEAL_WIDTH : 0;
      const nextValue = Math.max(-SWIPE_DELETE_THRESHOLD, Math.min(0, base + gestureState.dx));
      translateX.setValue(nextValue);
    },
    onPanResponderRelease: (_, gestureState) => {
      const base = swipeOpenRef.current ? -SWIPE_REVEAL_WIDTH : 0;
      const finalX = base + gestureState.dx;

      if (finalX <= -SWIPE_DELETE_THRESHOLD || (gestureState.vx < -1.2 && finalX < -32)) {
        Animated.timing(translateX, {
          toValue: -220,
          duration: 160,
          useNativeDriver: true,
        }).start(({ finished }) => {
          if (finished) triggerDelete();
        });
        return;
      }

      if (finalX <= -(SWIPE_REVEAL_WIDTH * 0.45)) {
        openSwipe();
        return;
      }

      closeSwipe();
    },
    onPanResponderTerminate: closeSwipe,
  }), [closeSwipe, openSwipe, translateX, triggerDelete]);

  return (
    <Animated.View
      style={[
        styles.historyItem,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <View style={[styles.historyDeleteUnderlay, { backgroundColor: withAlpha(COLORS.danger, 0.14) }]}>
        <Pressable
          onPress={triggerDelete}
          style={({ pressed }) => [
            styles.historyDeleteRevealButton,
            {
              backgroundColor: pressed ? withAlpha(COLORS.danger, 0.24) : withAlpha(COLORS.danger, 0.18),
              borderColor: withAlpha(COLORS.danger, 0.44),
            },
          ]}
        >
          <TrashIcon size={18} color={COLORS.danger} />
          <Text style={styles.historyDeleteRevealText}>Delete</Text>
        </Pressable>
      </View>

      <Animated.View
        style={[styles.historySwipeCard, { transform: [{ translateX }] }]}
        {...panResponder.panHandlers}
      >
        <LiquidGlass style={styles.historyItemInner} borderRadius={20} contentStyle={styles.historyItemInnerContent}>
          <View style={styles.historyContent}>
            <View style={styles.historyTopRow}>
              <PulsingDate text={formatDate(item.date)} baseColor={t.textSecondary} accentColor={t.accent} />
              <Pressable
                onPress={triggerDelete}
                hitSlop={10}
                style={({ pressed }) => [
                  styles.inlineDeleteButton,
                  {
                    backgroundColor: pressed ? withAlpha(COLORS.danger, 0.24) : withAlpha(COLORS.danger, 0.16),
                    borderColor: withAlpha(COLORS.danger, 0.36),
                  },
                ]}
              >
                <TrashIcon size={13} color={COLORS.danger} />
              </Pressable>
            </View>
            <View style={styles.historyStats}>
              <View style={styles.historyStat}>
                <View style={styles.statIconRow}>
                  <DownloadIcon color={t.accent} />
                  <Text style={[styles.historyStatLabel, { color: t.textMuted, textShadowColor: 'rgba(0, 0, 0, 0.2)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 1.5 }]}>Download</Text>
                </View>
                <Text style={[styles.historyStatValue, { color: t.textPrimary }]}>
                  {formatSpeedValue(item.download, speedUnit as any, 1)}
                  <Text style={[styles.historyStatUnit, { color: t.textSecondary }]}> {speedUnitLabel}</Text>
                </Text>
              </View>

              <View style={[styles.historyStatDivider, { backgroundColor: t.separator }]} />

              <View style={styles.historyStat}>
                <View style={styles.statIconRow}>
                  <UploadIcon color={t.uploadLine} />
                  <Text style={[styles.historyStatLabel, { color: t.textMuted, textShadowColor: 'rgba(0, 0, 0, 0.2)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 1.5 }]}>Upload</Text>
                </View>
                <Text style={[styles.historyStatValue, { color: t.textPrimary }]}>
                  {formatSpeedValue(item.upload, speedUnit as any, 1)}
                  <Text style={[styles.historyStatUnit, { color: t.textSecondary }]}> {speedUnitLabel}</Text>
                </Text>
              </View>

              <View style={[styles.historyStatDivider, { backgroundColor: t.separator }]} />

              <View style={styles.historyStat}>
                <View style={styles.statIconRow}>
                  <PingIcon color={t.success} />
                  <Text style={[styles.historyStatLabel, { color: t.textMuted, textShadowColor: 'rgba(0, 0, 0, 0.2)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 1.5 }]}>Ping</Text>
                </View>
                <Text style={[styles.historyStatValue, { color: t.textPrimary }]}>
                  {item.ping}
                  <Text style={[styles.historyStatUnit, { color: t.textSecondary, textShadowColor: 'rgba(0, 0, 0, 0.2)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 1.5 }]}> ms</Text>
                </Text>
              </View>
            </View>
            <View style={[styles.metaRow, { borderTopColor: t.separator }]}>
              <Text style={[styles.metaText, { color: t.textMuted }]}>{formatBytes(item.totalBytes || 0)} used</Text>
              <Text style={[styles.metaText, { color: t.textMuted }]}>{(item.serverName || 'Automatic')}{item.serverLocation ? ` • ${item.serverLocation}` : ''}</Text>
            </View>
          </View>
        </LiquidGlass>
      </Animated.View>
    </Animated.View>
  );
};

const SummaryStrip = ({ history, speedUnit, speedUnitLabel }: SummaryStripProps) => {
  const { t } = useTheme();
  const summary = summarizeHistory(history);

  if (!summary.totalTests) return null;

  const cards = [
    {
      label: 'Tests',
      value: String(summary.totalTests),
      subtitle: 'Visible in this view',
    },
    {
      label: 'Average Download',
      value: `${formatSpeedValue(summary.avgDownload, speedUnit as any, 1)} ${speedUnitLabel}`,
      subtitle: 'Across filtered history',
    },
    {
      label: 'Data Used',
      value: formatBytes(summary.totalDataUsedBytes),
      subtitle: 'Saved test traffic total',
    },
    {
      label: 'Average Upload',
      value: `${formatSpeedValue(summary.avgUpload, speedUnit as any, 1)} ${speedUnitLabel}`,
      subtitle: 'Across filtered history',
    },
  ];

  return (
    <View style={styles.summaryRow}>
      {cards.map((card) => (
        <LiquidGlass key={card.label} style={styles.summaryCard} borderRadius={20} contentStyle={styles.summaryCardContent}>
          <Text style={[styles.summaryLabel, { color: t.textMuted }]}>{card.label}</Text>
          <Text style={[styles.summaryValue, { color: t.textPrimary }]}>{card.value}</Text>
          <Text style={[styles.summarySubtitle, { color: t.textSecondary }]}>{card.subtitle}</Text>
        </LiquidGlass>
      ))}
    </View>
  );
};

// ── Screen ──────────────────────────────────────────────────────────────────
const HistoryScreen = () => {
  const { t } = useTheme();
  const { settings } = useAppSettings();
  const { setTabBarMode } = useTabBarMotion();
  const [history, setHistory] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const contentFade = useRef(new Animated.Value(0)).current;
  const calHeight = useRef(new Animated.Value(0)).current;
  const lastScrollY = useRef(0);
  const speedUnitLabel = getSpeedUnitLabel(settings.speedUnit as any);

  const loadHistory = useCallback(async () => {
    const historyData = await SpeedTestService.getHistory();
    setHistory(Array.isArray(historyData) ? historyData : []);
  }, []);

  useEffect(() => {
    loadHistory();
    Animated.timing(contentFade, { toValue: 1, duration: 300, useNativeDriver: false }).start();
  }, [contentFade, loadHistory]);

  useFocusEffect(useCallback(() => {
    setTabBarMode('expanded');
    lastScrollY.current = 0;
    loadHistory();
  }, [loadHistory, setTabBarMode]));

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

  const clearHistory = () => {
    Alert.alert('Clear History', 'Are you sure you want to clear all test history?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear', style: 'destructive', onPress: async () => {
          const c = await SpeedTestService.clearHistory();
          setHistory(c);
          setSelectedDate(null);
        },
      },
    ]);
  };

  const exportHistory = async () => {
    if (!history.length) {
      Alert.alert('No history', 'Run a speed test before exporting results.');
      return;
    }

    try {
      await Share.share({
        title: 'Flash speed history',
        message: buildHistoryCsv(history),
      });
    } catch (error) {
      Alert.alert('Export failed', 'Could not open the share sheet on this device.');
    }
  };

  const onRefresh = async () => { setRefreshing(true); await loadHistory(); setRefreshing(false); };

  const deleteHistoryItem = useCallback((targetItem: any, resetSwipe?: () => void) => {
    Alert.alert('Delete Test', 'Remove this speed test result from history?', [
      {
        text: 'Cancel',
        style: 'cancel',
        onPress: () => resetSwipe?.(),
      },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const updatedHistory = await SpeedTestService.deleteHistoryEntry(targetItem);
          setHistory(updatedHistory);
          if (updatedHistory.length === 0) {
            setSelectedDate(null);
          }
        },
      },
    ]);
  }, []);

  const toggleCalendar = useCallback(() => {
    const opening = !calendarOpen;
    setCalendarOpen(opening);
    Animated.timing(calHeight, {
      toValue: opening ? 1 : 0,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [calendarOpen]);

  const handleSelectDate = useCallback((dateKey: string) => {
    setSelectedDate(dateKey);
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedDate(null);
  }, []);

  // Filter history by selected date
  const filteredHistory = useMemo(() => {
    if (!selectedDate) return history;
    return history.filter((item) => {
      const d = new Date(item.date);
      return toDateKey(d) === selectedDate;
    });
  }, [history, selectedDate]);

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderHistoryItem = ({ item, index }: { item: any; index: number }) => (
    <HistoryCard
      item={item}
      index={index}
      formatDate={formatDate}
      speedUnit={settings.speedUnit as any}
      speedUnitLabel={speedUnitLabel}
      onDelete={deleteHistoryItem}
    />
  );

  const calendarMaxHeight = calHeight.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 420],
  });

  const calendarOpacity = calHeight.interpolate({
    inputRange: [0, 0.3, 1],
    outputRange: [0, 0, 1],
  });

  return (
    <Animated.View style={[styles.container, { opacity: contentFade }]}>
      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContentContainer}
        onScroll={handleScroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.accent} colors={[t.accent]} />}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.actionButtons}>
          {history.length > 0 && (
            <LiquidGlass
              style={[styles.exportHeaderButton, { borderColor: t.glassBorderAccent, backgroundColor: t.glass }]}
              onPress={exportHistory}
              borderRadius={RADIUS.pill}
              blurIntensity={24}
              contentStyle={styles.headerActionContent}
            >
              <Text style={[styles.exportHeaderButtonText, { color: t.accent }]}>Export CSV</Text>
            </LiquidGlass>
          )}
          <LiquidGlass
            style={[
              styles.calendarButton,
              { borderColor: t.glassBorderAccent, backgroundColor: t.glass },
              calendarOpen && [styles.calendarButtonActive, { backgroundColor: t.accentTintStrong, borderColor: t.accent }],
            ]}
            onPress={toggleCalendar}
            borderRadius={RADIUS.pill}
            blurIntensity={24}
            contentStyle={styles.calendarButtonContent}
          >
            <CalendarIcon size={14} color={calendarOpen ? t.textPrimary : t.accent} />
            <Text
              style={[
                styles.calendarButtonText,
                { color: calendarOpen ? t.textPrimary : t.accent },
                calendarOpen && styles.calendarButtonTextActive,
              ]}
            >
              Calendar
            </Text>
          </LiquidGlass>
          {history.length > 0 && (
            <LiquidGlass
              style={[styles.clearButton, { backgroundColor: t.glass }]}
              onPress={clearHistory}
              borderRadius={RADIUS.pill}
              blurIntensity={24}
              contentStyle={styles.headerActionContent}
            >
              <Text style={styles.clearButtonText}>Clear All</Text>
            </LiquidGlass>
          )}
        </View>

        {/* Calendar panel */}
        <Animated.View style={{ maxHeight: calendarMaxHeight, opacity: calendarOpacity, overflow: 'hidden' }}>
          {calendarOpen && (
            <Calendar
              history={history}
              selectedDate={selectedDate}
              onSelectDate={handleSelectDate}
              onClearSelection={handleClearSelection}
            />
          )}
        </Animated.View>

        {/* Content */}
        {history.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Svg width={80} height={112} viewBox="0 0 24 34">
              <Polygon points="14,0 4,18 12,18 10,34 20,14 12,14" fill={t.emptyBolt} />
            </Svg>
            <Text style={[styles.emptyTitle, { color: t.textSecondary }]}>No tests yet</Text>
            <Text style={[styles.emptySubtitle, { color: t.textMuted }]}>
              Run a speed test to start tracking your results
            </Text>
          </View>
        ) : filteredHistory.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyTitle, { color: t.textSecondary }]}>No tests on this day</Text>
            <Text style={[styles.emptySubtitle, { color: t.textMuted }]}>
              Select another date or tap "Show All"
            </Text>
          </View>
        ) : (
          <>
            <SummaryStrip
              history={filteredHistory}
              speedUnit={settings.speedUnit}
              speedUnitLabel={speedUnitLabel}
            />
            {filteredHistory.map((item, index) => (
              <React.Fragment key={`${item.date}-${index}`}>
                {renderHistoryItem({ item, index })}
              </React.Fragment>
            ))}
          </>
        )}
      </ScrollView>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  scrollContainer: { flex: 1 },
  scrollContentContainer: { padding: 16, paddingTop: 6, paddingBottom: 32 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 6, paddingBottom: 10,
  },

  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 0,
    paddingBottom: 4,
    marginBottom: 12,
    flexWrap: 'wrap',
    gap: 8,
  },
  exportHeaderButton: {
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  headerActionContent: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exportHeaderButtonText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  calendarButton: {
    borderRadius: RADIUS.pill,
    borderWidth: 1, backgroundColor: 'transparent',
  },
  calendarButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  calendarButtonActive: {},
  calendarButtonText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.3 },
  calendarButtonTextActive: {},
  clearButton: {
    borderRadius: RADIUS.pill,
    borderWidth: 1, borderColor: COLORS.danger, backgroundColor: 'transparent',
  },
  clearButtonText: { color: COLORS.danger, fontSize: 12, fontWeight: '700', letterSpacing: 0.3 },
  listContainer: { padding: 16, paddingBottom: 32 },

  historyItem: {
    borderRadius: 20, marginBottom: 12, overflow: 'hidden', position: 'relative',
  },
  historyDeleteUnderlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingRight: 14,
    borderRadius: 20,
  },
  historyDeleteRevealButton: {
    width: 74,
    height: '86%',
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  historyDeleteRevealText: {
    color: COLORS.danger,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  historySwipeCard: {
    borderRadius: 20,
  },
  historyItemInner: {
    borderRadius: 20,
  },
  historyItemInnerContent: {
    padding: 0,
  },

  gradientTint: { ...StyleSheet.absoluteFillObject, borderRadius: 20 },
  historyContent: { flex: 1, padding: 16, paddingLeft: 16 },
  historyTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  historyDate: { fontSize: 11, marginBottom: 0, fontWeight: '500' },
  inlineDeleteButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyStats: { flexDirection: 'row', alignItems: 'center' },
  historyStat: { flex: 1, alignItems: 'center' },
  statIconRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4, gap: 4 },
  historyStatLabel: { fontSize: 9, textTransform: 'uppercase', fontWeight: '700', letterSpacing: 0.8 },
  historyStatValue: { fontSize: 16, fontWeight: '900', letterSpacing: -0.5 },
  historyStatUnit: { fontSize: 10, fontWeight: '600' },
  historyStatDivider: { width: 1, height: 28, marginHorizontal: 2 },
  metaRow: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  metaText: {
    fontSize: 11,
    fontWeight: '500',
  },
  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  summaryCard: {
    width: '48.5%',
    borderRadius: 18,
  },
  summaryCardContent: {
    paddingHorizontal: 13,
    paddingVertical: 12,
  },
  summaryLabel: {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '700',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 3,
  },
  summarySubtitle: {
    fontSize: 10,
    lineHeight: 14,
  },

  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyTitle: { fontSize: 20, fontWeight: '800', marginTop: 20, letterSpacing: 0.5 },
  emptySubtitle: { fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 20 },
});

export default HistoryScreen;

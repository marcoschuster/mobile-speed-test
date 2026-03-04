import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Pressable,
  Alert,
  RefreshControl,
  Animated,
} from 'react-native';
import Svg, { Polygon, Path } from 'react-native-svg';
import SpeedTestService from '../services/SpeedTestService';
import { COLORS, RADIUS, SHADOWS, useTheme } from '../utils/theme';

// ── Small inline icons ──────────────────────────────────────────────────────
const DownloadIcon = ({ size = 13, color = COLORS.accent }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M12 4v12m0 0l-5-5m5 5l5-5M5 20h14" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </Svg>
);
const UploadIcon = ({ size = 13, color }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M12 20V8m0 0l-5 5m5-5l5 5M5 4h14" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </Svg>
);
const PingIcon = ({ size = 13, color = COLORS.success }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z" fill={color} />
  </Svg>
);

// ── Animated History Card ───────────────────────────────────────────────────
// ── Animated date with pulsing yellow on hover ──────────────────────────────
const PulsingDate = ({ text, baseColor }) => {
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const pulseRef = useRef(null);

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
    outputRange: [baseColor, COLORS.accent],
  });

  return (
    <Pressable onHoverIn={startPulse} onHoverOut={stopPulse} onPressIn={startPulse} onPressOut={stopPulse}>
      <Animated.Text style={[styles.historyDate, { color }]}>{text}</Animated.Text>
    </Pressable>
  );
};

const HistoryCard = ({ item, index, formatDate }) => {
  const { t } = useTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    const delay = Math.min(index * 80, 600);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 350, delay, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 350, delay, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={[
        styles.historyItem,
        {
          backgroundColor: t.surface,
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <View style={[styles.gradientTint, { backgroundColor: t.mode === 'dark' ? 'rgba(245, 196, 0, 0.04)' : 'rgba(245, 196, 0, 0.02)' }]} />
      <View style={styles.historyContent}>
        <PulsingDate text={formatDate(item.date)} baseColor={t.textSecondary} />
        <View style={styles.historyStats}>
          <View style={styles.historyStat}>
            <View style={styles.statIconRow}>
              <DownloadIcon />
              <Text style={[styles.historyStatLabel, { color: t.textMuted }]}>Download</Text>
            </View>
            <Text style={[styles.historyStatValue, { color: t.textPrimary }]}>
              {item.download.toFixed(1)}
              <Text style={[styles.historyStatUnit, { color: t.textSecondary }]}> Mbps</Text>
            </Text>
          </View>

          <View style={[styles.historyStatDivider, { backgroundColor: t.separator }]} />

          <View style={styles.historyStat}>
            <View style={styles.statIconRow}>
              <UploadIcon color={t.uploadLine} />
              <Text style={[styles.historyStatLabel, { color: t.textMuted }]}>Upload</Text>
            </View>
            <Text style={[styles.historyStatValue, { color: t.textPrimary }]}>
              {item.upload.toFixed(1)}
              <Text style={[styles.historyStatUnit, { color: t.textSecondary }]}> Mbps</Text>
            </Text>
          </View>

          <View style={[styles.historyStatDivider, { backgroundColor: t.separator }]} />

          <View style={styles.historyStat}>
            <View style={styles.statIconRow}>
              <PingIcon />
              <Text style={[styles.historyStatLabel, { color: t.textMuted }]}>Ping</Text>
            </View>
            <Text style={[styles.historyStatValue, { color: t.textPrimary }]}>
              {item.ping}
              <Text style={[styles.historyStatUnit, { color: t.textSecondary }]}> ms</Text>
            </Text>
          </View>
        </View>
      </View>
    </Animated.View>
  );
};

// ── Screen ──────────────────────────────────────────────────────────────────
const HistoryScreen = () => {
  const { t } = useTheme();
  const [history, setHistory] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const contentFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadHistory();
    Animated.timing(contentFade, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }, []);

  const loadHistory = async () => {
    const historyData = await SpeedTestService.getHistory();
    setHistory(historyData);
  };

  const clearHistory = () => {
    Alert.alert('Clear History', 'Are you sure you want to clear all test history?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: async () => { const c = await SpeedTestService.clearHistory(); setHistory(c); } },
    ]);
  };

  const onRefresh = async () => { setRefreshing(true); await loadHistory(); setRefreshing(false); };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderHistoryItem = ({ item, index }) => (
    <HistoryCard item={item} index={index} formatDate={formatDate} />
  );

  return (
    <Animated.View style={[styles.container, { backgroundColor: t.bg, opacity: contentFade }]}>
      <View style={[styles.header, { borderBottomColor: t.separator }]}>
        <Text style={[styles.headerTitle, { color: t.textSecondary }]}>TEST HISTORY</Text>
        {history.length > 0 && (
          <TouchableOpacity style={styles.clearButton} onPress={clearHistory} activeOpacity={0.7}>
            <Text style={styles.clearButtonText}>Clear All</Text>
          </TouchableOpacity>
        )}
      </View>

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
      ) : (
        <FlatList
          data={history}
          renderItem={renderHistoryItem}
          keyExtractor={(item, index) => index.toString()}
          contentContainerStyle={styles.listContainer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} colors={[COLORS.accent]} />}
          showsVerticalScrollIndicator={false}
        />
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 13, fontWeight: '800', letterSpacing: 2 },
  clearButton: {
    paddingHorizontal: 16, paddingVertical: 7, borderRadius: RADIUS.pill,
    borderWidth: 1, borderColor: COLORS.danger, backgroundColor: 'transparent',
  },
  clearButtonText: { color: COLORS.danger, fontSize: 12, fontWeight: '700', letterSpacing: 0.3 },
  listContainer: { padding: 16, paddingBottom: 32 },

  historyItem: {
    borderRadius: RADIUS.lg, marginBottom: 12, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 4,
  },

  gradientTint: { ...StyleSheet.absoluteFillObject, borderRadius: 16 },
  historyContent: { flex: 1, padding: 14, paddingLeft: 14 },
  historyDate: { fontSize: 11, marginBottom: 10, fontWeight: '500' },
  historyStats: { flexDirection: 'row', alignItems: 'center' },
  historyStat: { flex: 1, alignItems: 'center' },
  statIconRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4, gap: 4 },
  historyStatLabel: { fontSize: 9, textTransform: 'uppercase', fontWeight: '700', letterSpacing: 0.8 },
  historyStatValue: { fontSize: 16, fontWeight: '900', letterSpacing: -0.5 },
  historyStatUnit: { fontSize: 10, fontWeight: '600' },
  historyStatDivider: { width: 1, height: 28, marginHorizontal: 2 },

  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyTitle: { fontSize: 20, fontWeight: '800', marginTop: 20, letterSpacing: 0.5 },
  emptySubtitle: { fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 20 },
});

export default HistoryScreen;

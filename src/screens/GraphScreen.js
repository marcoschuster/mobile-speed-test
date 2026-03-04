import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  RefreshControl,
  TouchableOpacity,
  Animated,
} from 'react-native';
import Svg, {
  Line,
  Polyline,
  Circle,
  Text as SvgText,
  G,
  Defs,
  LinearGradient,
  Stop,
  Path,
  Polygon,
} from 'react-native-svg';
import SpeedTestService from '../services/SpeedTestService';
import { COLORS, RADIUS, SHADOWS, useTheme } from '../utils/theme';

const screenWidth = Dimensions.get('window').width;

const TIME_FILTERS = [
  { key: 'day', label: '1 Day' },
  { key: 'week', label: '1 Week' },
  { key: 'month', label: '1 Month' },
];

const GraphScreen = () => {
  const { t } = useTheme();
  const [allHistory, setAllHistory] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [timeFilter, setTimeFilter] = useState('month');
  const contentFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadSpeedHistory();
    Animated.timing(contentFade, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }, []);

  const loadSpeedHistory = async () => {
    const history = await SpeedTestService.getHistory();
    setAllHistory(history);
  };

  const onRefresh = async () => { setRefreshing(true); await loadSpeedHistory(); setRefreshing(false); };

  const getFilteredData = useCallback(() => {
    if (allHistory.length === 0) return [];
    const now = new Date();
    let cutoff;
    switch (timeFilter) {
      case 'day': cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000); break;
      case 'week': cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); break;
      case 'month': default: cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); break;
    }
    const filtered = allHistory.filter((item) => new Date(item.date) >= cutoff);
    return [...filtered].reverse();
  }, [allHistory, timeFilter]);

  const formatXLabel = (dateString) => {
    const date = new Date(dateString);
    const hours = date.getHours().toString().padStart(2, '0');
    const mins = date.getMinutes().toString().padStart(2, '0');
    if (timeFilter === 'day') return `${hours}:${mins}`;
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    if (timeFilter === 'week') return `${month}/${day} ${hours}:${mins}`;
    return `${month}/${day}`;
  };

  const getNiceTicks = (maxVal, tickCount = 5) => {
    if (maxVal <= 0) maxVal = 10;
    const rawStep = maxVal / tickCount;
    const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const residual = rawStep / magnitude;
    let niceStep;
    if (residual <= 1.5) niceStep = 1 * magnitude;
    else if (residual <= 3) niceStep = 2 * magnitude;
    else if (residual <= 7) niceStep = 5 * magnitude;
    else niceStep = 10 * magnitude;
    niceStep = Math.max(1, Math.round(niceStep));
    const niceMax = Math.ceil(maxVal / niceStep) * niceStep;
    const ticks = [];
    for (let v = 0; v <= niceMax; v += niceStep) ticks.push(Math.round(v));
    return { ticks, max: niceMax };
  };

  const renderCustomChart = ({ dataPoints, datasets, yAxisSuffix, title, legends, showGradientFill }) => {
    if (dataPoints.length === 0) return null;

    const yLabelWidth = 55;
    const xLabelHeight = 50;
    const paddingTop = 16;
    const paddingRight = 16;
    const paddingBottom = 8;
    const chartAreaWidth = Math.max(screenWidth - 32 - yLabelWidth - paddingRight, dataPoints.length * 60);
    const chartHeight = 200;
    const totalWidth = yLabelWidth + chartAreaWidth + paddingRight;
    const totalHeight = paddingTop + chartHeight + xLabelHeight + paddingBottom;

    let globalMax = 0;
    datasets.forEach((ds) => { ds.values.forEach((v) => { if (v > globalMax) globalMax = v; }); });
    const { ticks, max: yMax } = getNiceTicks(globalMax);

    const xPos = (index) => {
      if (dataPoints.length === 1) return yLabelWidth + chartAreaWidth / 2;
      return yLabelWidth + (index / (dataPoints.length - 1)) * chartAreaWidth;
    };
    const yPos = (value) => paddingTop + chartHeight - (value / yMax) * chartHeight;

    const maxXLabels = 6;
    const step = Math.max(1, Math.ceil(dataPoints.length / maxXLabels));

    let gradientFillPath = '';
    if (showGradientFill && datasets.length > 0) {
      const ds = datasets[0];
      const points = ds.values.map((val, i) => `${xPos(i)},${yPos(val)}`).join(' L');
      const bottomY = paddingTop + chartHeight;
      gradientFillPath = `M${xPos(0)},${bottomY} L${points} L${xPos(ds.values.length - 1)},${bottomY} Z`;
    }

    return (
      <View style={[styles.chartCard, { backgroundColor: t.surface, borderColor: t.glassBorder, borderTopColor: t.glassBorderTop }]}>
        <Text style={[styles.chartTitle, { color: t.textPrimary }]}>{title}</Text>
        <View style={styles.legendRow}>
          {legends.map((leg, i) => (
            <View key={i} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: leg.color }]} />
              <Text style={[styles.legendText, { color: t.textSecondary }]}>{leg.label}</Text>
            </View>
          ))}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <Svg width={totalWidth} height={totalHeight}>
            <Defs>
              <LinearGradient id="yellowGradFill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor={COLORS.accent} stopOpacity="0.25" />
                <Stop offset="100%" stopColor={COLORS.accent} stopOpacity="0" />
              </LinearGradient>
            </Defs>

            {ticks.map((tick, i) => {
              const y = yPos(tick);
              return (
                <G key={`ytick-${i}`}>
                  <Line x1={yLabelWidth} y1={y} x2={yLabelWidth + chartAreaWidth} y2={y}
                    stroke={t.gridLine} strokeWidth="1" strokeDasharray={tick === 0 ? '' : '4,4'} />
                  <SvgText x={yLabelWidth - 6} y={y + 4} fontSize="10" fill={t.axisLabel} textAnchor="end" fontWeight="600">
                    {tick}{yAxisSuffix}
                  </SvgText>
                </G>
              );
            })}

            <Line x1={yLabelWidth} y1={paddingTop} x2={yLabelWidth} y2={paddingTop + chartHeight} stroke={t.axisLine} strokeWidth="1" />
            <Line x1={yLabelWidth} y1={paddingTop + chartHeight} x2={yLabelWidth + chartAreaWidth} y2={paddingTop + chartHeight} stroke={t.axisLine} strokeWidth="1" />

            {showGradientFill && gradientFillPath ? <Path d={gradientFillPath} fill="url(#yellowGradFill)" /> : null}

            {dataPoints.map((item, i) => {
              if (i % step !== 0 && i !== dataPoints.length - 1) return null;
              const x = xPos(i);
              const lbl = formatXLabel(item.date);
              const parts = lbl.split(' ');
              return (
                <G key={`xlabel-${i}`}>
                  <Line x1={x} y1={paddingTop + chartHeight} x2={x} y2={paddingTop + chartHeight + 4} stroke={t.axisLine} strokeWidth="1" />
                  <SvgText x={x} y={paddingTop + chartHeight + 18} fontSize="9" fill={t.axisLabel} textAnchor="middle" fontWeight="500">{parts[0]}</SvgText>
                  {parts[1] && <SvgText x={x} y={paddingTop + chartHeight + 30} fontSize="9" fill={t.axisLabelSub} textAnchor="middle">{parts[1]}</SvgText>}
                </G>
              );
            })}

            {datasets.map((ds, dsIndex) => {
              const points = ds.values.map((val, i) => `${xPos(i)},${yPos(val)}`).join(' ');
              return (
                <G key={`ds-${dsIndex}`}>
                  <Polyline points={points} fill="none" stroke={ds.color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
                  {ds.values.map((val, i) => (
                    <Circle key={`dot-${dsIndex}-${i}`} cx={xPos(i)} cy={yPos(val)} r="3" fill={ds.color} stroke={t.surface} strokeWidth="1.5" />
                  ))}
                </G>
              );
            })}
          </Svg>
        </ScrollView>
      </View>
    );
  };

  const renderCharts = () => {
    const data = getFilteredData();

    if (allHistory.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Svg width={60} height={84} viewBox="0 0 24 34">
            <Polygon points="14,0 4,18 12,18 10,34 20,14 12,14" fill={t.emptyBolt} />
          </Svg>
          <Text style={[styles.emptyTitle, { color: t.textSecondary }]}>No speed data</Text>
          <Text style={[styles.emptySubtitle, { color: t.textMuted }]}>Run speed tests to see your graphs here</Text>
        </View>
      );
    }

    if (data.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyTitle, { color: t.textSecondary }]}>No data for this period</Text>
          <Text style={[styles.emptySubtitle, { color: t.textMuted }]}>Try selecting a longer time range</Text>
        </View>
      );
    }

    return (
      <>
        {renderCustomChart({
          dataPoints: data,
          datasets: [
            { values: data.map((d) => d.download), color: COLORS.accent, label: 'Download' },
            { values: data.map((d) => d.upload), color: t.uploadLine, label: 'Upload' },
          ],
          yAxisSuffix: '',
          title: 'Download & Upload Speed (Mbps)',
          legends: [
            { color: COLORS.accent, label: 'Download' },
            { color: t.uploadLine, label: 'Upload' },
          ],
          showGradientFill: true,
        })}
        {renderCustomChart({
          dataPoints: data,
          datasets: [{ values: data.map((d) => d.ping), color: COLORS.success, label: 'Ping' }],
          yAxisSuffix: '',
          title: 'Ping / Latency (ms)',
          legends: [{ color: COLORS.success, label: 'Ping' }],
          showGradientFill: false,
        })}
      </>
    );
  };

  return (
    <Animated.View style={[styles.container, { backgroundColor: t.bg, opacity: contentFade }]}>
      <View style={[styles.filterRow, { borderBottomColor: t.separator }]}>
        {TIME_FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterButton, timeFilter === f.key && styles.filterButtonActive]}
            onPress={() => setTimeFilter(f.key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterButtonText, timeFilter === f.key && styles.filterButtonTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} colors={[COLORS.accent]} />}
        showsVerticalScrollIndicator={false}
      >
        {renderCharts()}
      </ScrollView>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  filterRow: {
    flexDirection: 'row', justifyContent: 'center',
    paddingVertical: 14, paddingHorizontal: 16, gap: 10, borderBottomWidth: 1,
  },
  filterButton: {
    paddingHorizontal: 22, paddingVertical: 8, borderRadius: RADIUS.pill,
    borderWidth: 1.5, borderColor: COLORS.accent, backgroundColor: 'transparent',
  },
  filterButtonActive: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  filterButtonText: { fontSize: 13, fontWeight: '700', color: COLORS.accent, letterSpacing: 0.3 },
  filterButtonTextActive: { color: COLORS.black },

  content: { flex: 1 },
  contentContainer: { padding: 16, paddingBottom: 30 },

  chartCard: {
    borderRadius: RADIUS.lg, padding: 16, marginBottom: 20,
    borderWidth: 1, ...SHADOWS.cardLight,
  },
  chartTitle: { fontSize: 14, fontWeight: '800', marginBottom: 8, textAlign: 'center', letterSpacing: 0.5 },
  legendRow: { flexDirection: 'row', justifyContent: 'center', marginBottom: 12, gap: 20 },
  legendItem: { flexDirection: 'row', alignItems: 'center' },
  legendDot: { width: 10, height: 10, borderRadius: 5, marginRight: 6 },
  legendText: { fontSize: 11, fontWeight: '600' },

  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 80 },
  emptyTitle: { fontSize: 18, fontWeight: '800', marginTop: 16, letterSpacing: 0.5 },
  emptySubtitle: { fontSize: 14, textAlign: 'center', marginTop: 8 },
});

export default GraphScreen;

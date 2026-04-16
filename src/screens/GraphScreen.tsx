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
  Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Svg, {
  Rect,
  Line,
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
import SoundEngine from '../services/SoundEngine';
import FlashTitle from '../components/FlashTitle';
import GlassSurface from '../components/GlassSurface';
import { useAppSettings } from '../context/AppSettingsContext';
import { summarizeHistory, type HistoryItem } from '../utils/history';
import { convertSpeedFromMbps, formatBytes, formatSpeedValue, getSpeedUnitLabel } from '../utils/measurements';
import { COLORS, RADIUS, useTheme } from '../utils/theme';

// ── Type Definitions ─────────────────────────────────────────────────────────
interface Point {
  x: number;
  y: number;
}

interface Dataset {
  values: number[];
  color: string;
  label: string;
}

interface AreaGradient {
  color: string;
}

interface InteractiveChartProps {
  dataPoints: HistoryItem[];
  datasets: Dataset[];
  yAxisSuffix: string;
  title: string;
  legends: { color: string; label: string }[];
  areaGradients?: AreaGradient[];
  formatXLabel: (date: string) => string;
  isDark: boolean;
  t: any;
  chartId: string;
}

interface TrendSummaryProps {
  history: HistoryItem[];
  speedUnit: any;
  speedUnitLabel: string;
}

interface TimeFilter {
  key: string;
  label: string;
}

const screenWidth = Dimensions.get('window').width;
const FONT_FAMILY = Platform.OS === 'ios' ? 'System' : 'sans-serif';

const TIME_FILTERS: TimeFilter[] = [
  { key: 'day', label: '1 Day' },
  { key: 'week', label: '1 Week' },
  { key: 'month', label: '1 Month' },
];

// ── Catmull-Rom → cubic bezier spline helper ────────────────────────────────
const buildSplinePath = (points: Point[], tension: number = 0.35): string => {
  if (points.length < 2) return '';
  if (points.length === 2) return `M${points[0].x},${points[0].y} L${points[1].x},${points[1].y}`;

  let d = `M${points[0].x},${points[0].y}`;

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(i - 1, 0)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(i + 2, points.length - 1)];

    const cp1x = p1.x + ((p2.x - p0.x) * tension);
    const cp1y = p1.y + ((p2.y - p0.y) * tension);
    const cp2x = p2.x - ((p3.x - p1.x) * tension);
    const cp2y = p2.y - ((p3.y - p1.y) * tension);

    d += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
  }

  return d;
};

const buildAreaPath = (points: Point[], baselineY: number, tension: number = 0.35): string => {
  if (points.length < 2) return '';
  const spline = buildSplinePath(points, tension);
  const lastPt = points[points.length - 1];
  const firstPt = points[0];
  return `${spline} L${lastPt.x},${baselineY} L${firstPt.x},${baselineY} Z`;
};

// ── Tooltip helpers ─────────────────────────────────────────────────────────
const formatTooltipDate = (dateString: string): string => {
  const d = new Date(dateString);
  const mo = d.toLocaleString('default', { month: 'short' });
  const day = d.getDate();
  const hrs = d.getHours().toString().padStart(2, '0');
  const min = d.getMinutes().toString().padStart(2, '0');
  return `${mo} ${day}, ${hrs}:${min}`;
};

// ── Interactive Chart Component ─────────────────────────────────────────────
const InteractiveChart = ({
  dataPoints, datasets, yAxisSuffix, title, legends, areaGradients,
  formatXLabel, isDark, t, chartId,
}: InteractiveChartProps) => {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const yLabelWidth = 48;
  const xLabelHeight = 50;
  const paddingTop = 20;
  const paddingRight = 16;
  const paddingBottom = 8;
  const chartAreaWidth = Math.max(screenWidth - 32 - yLabelWidth - paddingRight, dataPoints.length * 60);
  const chartHeight = 200;
  const totalWidth = yLabelWidth + chartAreaWidth + paddingRight;
  const totalHeight = paddingTop + chartHeight + xLabelHeight + paddingBottom;

  let globalMax = 0;
  datasets.forEach((ds) => { ds.values.forEach((v) => { if (v > globalMax) globalMax = v; }); });

  const getNiceTicks = (maxVal: number, tickCount: number = 5): { ticks: number[]; max: number } => {
    if (maxVal <= 0) maxVal = 10;
    const rawStep = maxVal / tickCount;
    const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const residual = rawStep / magnitude;
    let niceStep: number;
    if (residual <= 1.5) niceStep = 1 * magnitude;
    else if (residual <= 3) niceStep = 2 * magnitude;
    else if (residual <= 7) niceStep = 5 * magnitude;
    else niceStep = 10 * magnitude;
    niceStep = Math.max(1, Math.round(niceStep));
    const niceMax = Math.ceil(maxVal / niceStep) * niceStep;
    const ticks: number[] = [];
    for (let v = 0; v <= niceMax; v += niceStep) ticks.push(Math.round(v));
    return { ticks, max: niceMax };
  };

  const { ticks, max: yMax } = getNiceTicks(globalMax);

  const xPos = (index: number): number => {
    if (dataPoints.length === 1) return yLabelWidth + chartAreaWidth / 2;
    return yLabelWidth + (index / (dataPoints.length - 1)) * chartAreaWidth;
  };
  const yPos = (value: number): number => paddingTop + chartHeight - (value / yMax) * chartHeight;

  const maxXLabels = 6;
  const step = Math.max(1, Math.ceil(dataPoints.length / maxXLabels));
  const baselineY = paddingTop + chartHeight;

  const chartTintBg = t.accentTintSoft;

  const gradientDefs = (areaGradients || []).map((ag, i) => (
    <LinearGradient key={`areaGrad-${chartId}-${i}`} id={`areaGrad${chartId}${i}`} x1="0" y1="0" x2="0" y2="1">
      <Stop offset="0%" stopColor={ag.color} stopOpacity={isDark ? '0.30' : '0.20'} />
      <Stop offset="100%" stopColor={ag.color} stopOpacity="0" />
    </LinearGradient>
  ));

  const handleDotPress = (index: number): void => {
    if (selectedIndex !== index) SoundEngine.playGraphPing();
    setSelectedIndex(selectedIndex === index ? null : index);
  };

  // Build tooltip content for selected index
  const tooltipData = selectedIndex !== null ? (() => {
    const dp = dataPoints[selectedIndex];
    const cx = xPos(selectedIndex);
    const values = datasets.map((ds) => ({
      label: ds.label,
      value: ds.values[selectedIndex],
      color: ds.color,
      cy: yPos(ds.values[selectedIndex]),
    }));
    const dateStr = formatTooltipDate(dp.date);

    // Tooltip dimensions
    const tooltipW = 130;
    const lineH = 18;
    const tooltipH = 28 + values.length * lineH;
    const tooltipPad = 10;

    // Position: try above the highest point, flip if too close to top
    const minY = Math.min(...values.map((v) => v.cy));
    let tooltipY = minY - tooltipH - 12;
    if (tooltipY < 2) tooltipY = Math.max(...values.map((v) => v.cy)) + 12;

    // Horizontal: centre on dot, clamp to chart bounds
    let tooltipX = cx - tooltipW / 2;
    if (tooltipX < yLabelWidth) tooltipX = yLabelWidth;
    if (tooltipX + tooltipW > totalWidth - 4) tooltipX = totalWidth - tooltipW - 4;

    const tooltipBg = isDark ? '#2C2C2C' : '#FFFFFF';
    const tooltipBorder = isDark ? '#444' : '#DDD';
    const tooltipShadow = isDark ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.12)';

    return { cx, values, dateStr, tooltipW, tooltipH, tooltipPad, tooltipX, tooltipY, tooltipBg, tooltipBorder, tooltipShadow, lineH };
  })() : null;

  // Hit target size for each dot
  const HIT_SIZE = 36;

  return (
    <GlassSurface style={cStyles.chartCard} radius={RADIUS.lg} tintColor={t.accent}>
      <View style={[cStyles.gradientTint, { backgroundColor: chartTintBg }]} />
      <View style={cStyles.chartTitleWrap}>
        <FlashTitle text={title.toUpperCase()} size="small" interval={5000} center disableFlash />
      </View>
      <View style={cStyles.legendRow}>
        {legends.map((leg, i) => (
          <View key={i} style={cStyles.legendItem}>
            <View style={[cStyles.legendDot, { backgroundColor: leg.color }]} />
            <Text style={[cStyles.legendText, { color: t.textSecondary, fontFamily: FONT_FAMILY }]}>{leg.label}</Text>
          </View>
        ))}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ width: totalWidth, height: totalHeight }}>
          {/* SVG Chart Layer */}
          <Svg width={totalWidth} height={totalHeight} style={StyleSheet.absoluteFill}>
            <Defs>
              {gradientDefs}
            </Defs>

            {/* Horizontal grid lines */}
            {ticks.map((tick, i) => {
              const y = yPos(tick);
              return (
                <G key={`ytick-${i}`}>
                  <Line
                    x1={yLabelWidth} y1={y} x2={yLabelWidth + chartAreaWidth} y2={y}
                    stroke={t.gridLine} strokeWidth="1"
                    strokeDasharray={tick === 0 ? '' : '6,4'}
                  />
                  <SvgText
                    x={yLabelWidth - 8} y={y + 4}
                    fontSize="11" fill={t.axisLabel} textAnchor="end" fontWeight="600"
                    fontFamily={FONT_FAMILY}
                  >
                    {tick}{yAxisSuffix}
                  </SvgText>
                </G>
              );
            })}

            {/* Axis lines */}
            <Line x1={yLabelWidth} y1={paddingTop} x2={yLabelWidth} y2={baselineY} stroke={t.axisLine} strokeWidth="1" />
            <Line x1={yLabelWidth} y1={baselineY} x2={yLabelWidth + chartAreaWidth} y2={baselineY} stroke={t.axisLine} strokeWidth="1" />

            {/* Area fills */}
            {datasets.map((ds, dsIndex) => {
              if (!areaGradients || !areaGradients[dsIndex]) return null;
              const pts = ds.values.map((val, i) => ({ x: xPos(i), y: yPos(val) }));
              const areaD = buildAreaPath(pts, baselineY);
              return (
                <Path key={`area-${dsIndex}`} d={areaD} fill={`url(#areaGrad${chartId}${dsIndex})`} />
              );
            })}

            {/* X-axis labels */}
            {dataPoints.map((item, i) => {
              if (i % step !== 0 && i !== dataPoints.length - 1) return null;
              const x = xPos(i);
              const lbl = formatXLabel(item.date);
              const parts = lbl.split(' ');
              return (
                <G key={`xlabel-${i}`}>
                  <Line x1={x} y1={baselineY} x2={x} y2={baselineY + 4} stroke={t.axisLine} strokeWidth="1" />
                  <SvgText
                    x={x} y={baselineY + 18} fontSize="10" fill={t.axisLabel}
                    textAnchor="middle" fontWeight="600" fontFamily={FONT_FAMILY}
                  >{parts[0]}</SvgText>
                  {parts[1] && (
                    <SvgText
                      x={x} y={baselineY + 30} fontSize="10" fill={t.axisLabelSub}
                      textAnchor="middle" fontFamily={FONT_FAMILY}
                    >{parts[1]}</SvgText>
                  )}
                </G>
              );
            })}

            {/* Spline lines */}
            {datasets.map((ds, dsIndex) => {
              const pts = ds.values.map((val, i) => ({ x: xPos(i), y: yPos(val) }));
              const splineD = buildSplinePath(pts);
              return (
                <Path key={`line-${dsIndex}`} d={splineD} fill="none" stroke={ds.color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
              );
            })}

            {/* Data dots — dimmed when another dot is selected */}
            {datasets.map((ds, dsIndex) =>
              ds.values.map((val, i) => {
                const isSelected = selectedIndex === i;
                const hasSelection = selectedIndex !== null;
                return (
                  <Circle
                    key={`dot-${dsIndex}-${i}`}
                    cx={xPos(i)} cy={yPos(val)}
                    r={isSelected ? 5.5 : 3.5}
                    fill={ds.color}
                    stroke={isSelected ? (isDark ? '#fff' : '#333') : t.surface}
                    strokeWidth={isSelected ? 2.5 : 2}
                    opacity={hasSelection && !isSelected ? 0.35 : 1}
                  />
                );
              })
            )}

            {/* Vertical crosshair + tooltip when selected */}
            {tooltipData && (
              <G>
                {/* Vertical crosshair line */}
                <Line
                  x1={tooltipData.cx} y1={paddingTop}
                  x2={tooltipData.cx} y2={baselineY}
                  stroke={isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)'}
                  strokeWidth="1"
                  strokeDasharray="4,3"
                />

                {/* Horizontal guide lines to Y axis per value */}
                {tooltipData.values.map((v, vi) => (
                  <Line
                    key={`hguide-${vi}`}
                    x1={yLabelWidth} y1={v.cy}
                    x2={tooltipData.cx} y2={v.cy}
                    stroke={v.color}
                    strokeWidth="1"
                    strokeDasharray="3,3"
                    opacity={0.4}
                  />
                ))}

                {/* Tooltip background */}
                <Rect
                  x={tooltipData.tooltipX}
                  y={tooltipData.tooltipY}
                  width={tooltipData.tooltipW}
                  height={tooltipData.tooltipH}
                  rx={8} ry={8}
                  fill={tooltipData.tooltipBg}
                  stroke={tooltipData.tooltipBorder}
                  strokeWidth="1"
                />

                {/* Tooltip date */}
                <SvgText
                  x={tooltipData.tooltipX + tooltipData.tooltipPad}
                  y={tooltipData.tooltipY + 16}
                  fontSize="10" fontWeight="600"
                  fill={t.textMuted}
                  fontFamily={FONT_FAMILY}
                >
                  {tooltipData.dateStr}
                </SvgText>

                {/* Tooltip values */}
                {tooltipData.values.map((v, vi) => (
                  <G key={`tv-${vi}`}>
                    {/* Color dot */}
                    <Circle
                      cx={tooltipData.tooltipX + tooltipData.tooltipPad + 5}
                      cy={tooltipData.tooltipY + 28 + vi * tooltipData.lineH + 4}
                      r={3.5}
                      fill={v.color}
                    />
                    {/* Label */}
                    <SvgText
                      x={tooltipData.tooltipX + tooltipData.tooltipPad + 14}
                      y={tooltipData.tooltipY + 28 + vi * tooltipData.lineH + 8}
                      fontSize="11" fontWeight="600"
                      fill={t.textSecondary}
                      fontFamily={FONT_FAMILY}
                    >
                      {v.label}
                    </SvgText>
                    {/* Value */}
                    <SvgText
                      x={tooltipData.tooltipX + tooltipData.tooltipW - tooltipData.tooltipPad}
                      y={tooltipData.tooltipY + 28 + vi * tooltipData.lineH + 8}
                      fontSize="12" fontWeight="800"
                      fill={t.textPrimary}
                      textAnchor="end"
                      fontFamily={FONT_FAMILY}
                    >
                      {typeof v.value === 'number' ? v.value.toFixed(1) : v.value}
                    </SvgText>
                  </G>
                ))}
              </G>
            )}
          </Svg>

          {/* Native touch targets overlaid on each data point */}
          {dataPoints.map((_, i) => {
            const cx = xPos(i);
            // Use the topmost dot position as the center of the hit area
            const minCy = Math.min(...datasets.map((ds) => yPos(ds.values[i])));
            const maxCy = Math.max(...datasets.map((ds) => yPos(ds.values[i])));
            const centerY = (minCy + maxCy) / 2;
            const hitH = Math.max(HIT_SIZE, maxCy - minCy + HIT_SIZE);

            return (
              <TouchableOpacity
                key={`hit-${i}`}
                onPress={() => handleDotPress(i)}
                activeOpacity={0.7}
                style={{
                  position: 'absolute',
                  left: cx - HIT_SIZE / 2,
                  top: centerY - hitH / 2,
                  width: HIT_SIZE,
                  height: hitH,
                }}
              />
            );
          })}

          {/* Tap-away area: if a tooltip is showing, tapping the background dismisses it */}
          {selectedIndex !== null && (
            <TouchableOpacity
              activeOpacity={1}
              onPress={() => setSelectedIndex(null)}
              style={{
                position: 'absolute', left: 0, top: 0,
                width: totalWidth, height: totalHeight,
                zIndex: -1,
              }}
            />
          )}
        </View>
      </ScrollView>
    </GlassSurface>
  );
};

const cStyles = StyleSheet.create({
  chartCard: {
    borderRadius: RADIUS.lg, padding: 16, marginBottom: 20, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.14, shadowRadius: 10, elevation: 5,
  },
  gradientTint: { ...StyleSheet.absoluteFillObject, borderRadius: RADIUS.lg },
  chartTitleWrap: { alignItems: 'center', marginBottom: 10 },
  legendRow: { flexDirection: 'row', justifyContent: 'center', marginBottom: 14, gap: 20 },
  legendItem: { flexDirection: 'row', alignItems: 'center' },
  legendDot: { width: 10, height: 10, borderRadius: 5, marginRight: 6 },
  legendText: { fontSize: 12, fontWeight: '600' },
});

const TrendSummary = ({ history, speedUnit, speedUnitLabel }: TrendSummaryProps) => {
  const { t } = useTheme();
  const summary = summarizeHistory(history);

  if (!summary.totalTests) return null;

  const firstSample = history[0]?.download ?? 0;
  const lastSample = history[history.length - 1]?.download ?? 0;
  const trendLabel = lastSample > firstSample * 1.08
    ? 'Improving'
    : lastSample < firstSample * 0.92
      ? 'Slower lately'
      : 'Stable';

  const cards = [
    {
      label: 'Avg Download',
      value: `${formatSpeedValue(summary.avgDownload, speedUnit as any, 1)} ${speedUnitLabel}`,
    },
    {
      label: 'Avg Ping',
      value: `${Math.round(summary.avgPing)} ms`,
    },
    {
      label: 'Trend',
      value: trendLabel,
    },
    {
      label: 'Traffic',
      value: formatBytes(summary.totalDataUsedBytes),
    },
  ];

  return (
    <View style={[styles.summaryGrid, { overflow: 'visible' }]}>
      {cards.map((card) => (
        <GlassSurface key={card.label} style={styles.summaryCard} radius={RADIUS.lg} tintColor={t.accent}>
          <Text style={[styles.summaryLabel, { color: t.textMuted }]}>{card.label}</Text>
          <Text style={[styles.summaryValue, { color: t.textPrimary }]}>{card.value}</Text>
        </GlassSurface>
      ))}
    </View>
  );
};

// ── Main Screen ─────────────────────────────────────────────────────────────
const GraphScreen = () => {
  const { t } = useTheme();
  const { settings } = useAppSettings();
  const isDark = t.mode === 'dark';
  const [allHistory, setAllHistory] = useState<HistoryItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [timeFilter, setTimeFilter] = useState('month');
  const contentFade = useRef(new Animated.Value(0)).current;
  const speedUnitLabel = getSpeedUnitLabel(settings.speedUnit as any);

  const loadSpeedHistory = useCallback(async () => {
    const history = await SpeedTestService.getHistory();
    setAllHistory(history);
  }, []);

  useEffect(() => {
    loadSpeedHistory();
    Animated.timing(contentFade, { toValue: 1, duration: 300, useNativeDriver: false }).start();
  }, [contentFade, loadSpeedHistory]);

  useFocusEffect(useCallback(() => {
    loadSpeedHistory();
  }, [loadSpeedHistory]));

  const onRefresh = async () => { setRefreshing(true); await loadSpeedHistory(); setRefreshing(false); };

  const getFilteredData = useCallback((): HistoryItem[] => {
    if (allHistory.length === 0) return [];
    const now = new Date();
    let cutoff: Date;
    switch (timeFilter) {
      case 'day': cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000); break;
      case 'week': cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); break;
      case 'month': default: cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); break;
    }
    const filtered = allHistory.filter((item) => new Date(item.date) >= cutoff);
    return [...filtered].reverse();
  }, [allHistory, timeFilter]);

  const formatXLabel = useCallback((dateString: string): string => {
    const date = new Date(dateString);
    const hours = date.getHours().toString().padStart(2, '0');
    const mins = date.getMinutes().toString().padStart(2, '0');
    if (timeFilter === 'day') return `${hours}:${mins}`;
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    if (timeFilter === 'week') return `${month}/${day} ${hours}:${mins}`;
    return `${month}/${day}`;
  }, [timeFilter]);

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
        <TrendSummary
          history={data}
          speedUnit={settings.speedUnit as any}
          speedUnitLabel={speedUnitLabel}
        />
        <InteractiveChart
          chartId="speed"
          dataPoints={data}
          datasets={[
            {
              values: data.map((d) => convertSpeedFromMbps(d.download || 0, settings.speedUnit as any)),
              color: COLORS.accent,
              label: 'Download',
            },
            {
              values: data.map((d) => convertSpeedFromMbps(d.upload || 0, settings.speedUnit as any)),
              color: t.uploadLine,
              label: 'Upload',
            },
          ]}
          yAxisSuffix=""
          title={`Download & Upload Speed (${speedUnitLabel})`}
          legends={[
            { color: COLORS.accent, label: 'Download' },
            { color: t.uploadLine, label: 'Upload' },
          ]}
          areaGradients={[
            { color: COLORS.accent },
            { color: t.uploadLine },
          ]}
          formatXLabel={formatXLabel}
          isDark={isDark}
          t={t}
        />
        {settings.showPing && (
          <InteractiveChart
            chartId="ping"
            dataPoints={data}
            datasets={[{ values: data.map((d) => d.ping || 0), color: COLORS.success, label: 'Ping' }]}
            yAxisSuffix=""
            title="Ping / Latency (ms)"
            legends={[{ color: COLORS.success, label: 'Ping' }]}
            areaGradients={[{ color: COLORS.success }]}
            formatXLabel={formatXLabel}
            isDark={isDark}
            t={t}
          />
        )}
      </>
    );
  };

  return (
    <Animated.View style={[styles.container, { opacity: contentFade }]}>
      <View style={[styles.filterRow, { borderBottomColor: t.separator }]}>
        {TIME_FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[
              styles.filterButton,
              { borderColor: t.glassBorderAccent, backgroundColor: t.glass },
              timeFilter === f.key && [styles.filterButtonActive, { backgroundColor: t.accent, borderColor: t.accent }],
            ]}
            onPress={() => setTimeFilter(f.key)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.filterButtonText,
                { fontFamily: FONT_FAMILY, color: t.accent },
                timeFilter === f.key && styles.filterButtonTextActive,
              ]}
            >
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.accent} colors={[t.accent]} />}
        showsVerticalScrollIndicator={false}
      >
        {renderCharts()}
      </ScrollView>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  filterRow: {
    flexDirection: 'row', justifyContent: 'center',
    paddingVertical: 14, paddingHorizontal: 16, gap: 10, borderBottomWidth: 1,
  },
  filterButton: {
    paddingHorizontal: 22, paddingVertical: 8, borderRadius: RADIUS.pill,
    borderWidth: 1.5, backgroundColor: 'transparent',
  },
  filterButtonActive: {},
  filterButtonText: { 
    fontSize: 13, 
    fontWeight: '700', 
    letterSpacing: 0.3,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1.5,
  },
  filterButtonTextActive: { color: COLORS.black },

  content: { flex: 1 },
  contentContainer: { padding: 16, paddingBottom: 30 },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 18,
  },
  summaryCard: {
    width: '48.5%',
    borderRadius: RADIUS.lg,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  summaryLabel: {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '700',
    marginBottom: 6,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '800',
  },

  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 80 },
  emptyTitle: { fontSize: 18, fontWeight: '800', marginTop: 16, letterSpacing: 0.5 },
  emptySubtitle: { fontSize: 14, textAlign: 'center', marginTop: 8 },
});

export default GraphScreen;

import React, { useCallback, useEffect, useState } from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import LiquidGlass from './LiquidGlass';
import { getBackgroundHistory } from '../services/BackgroundTestService';
import { convertSpeedFromMbps, getSpeedUnitLabel } from '../utils/measurements';
import { RADIUS, useTheme } from '../utils/theme';

type BackgroundHistoryItem = {
  date: string;
  download: number;
  ping?: number;
};

const screenWidth = Dimensions.get('window').width;
const DAY_MS = 24 * 60 * 60 * 1000;

const buildLinePath = (points: { x: number; y: number }[]) => {
  if (!points.length) return '';
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x},${point.y}`).join(' ');
};

const formatHour = (dateString: string) => {
  const date = new Date(dateString);
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
};

const BackgroundHistoryGraph = ({ speedUnit }: { speedUnit: any }) => {
  const { t } = useTheme();
  const [history, setHistory] = useState<BackgroundHistoryItem[]>([]);
  const speedUnitLabel = getSpeedUnitLabel(speedUnit);

  const loadHistory = useCallback(async () => {
    const cutoff = Date.now() - DAY_MS;
    const stored = await getBackgroundHistory();
    const recent = stored
      .filter((item: BackgroundHistoryItem) => new Date(item.date).getTime() >= cutoff)
      .reverse();
    setHistory(recent);
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useFocusEffect(useCallback(() => {
    loadHistory();
  }, [loadHistory]));

  const width = Math.max(screenWidth - 64, history.length * 36);
  const height = 190;
  const left = 42;
  const right = 12;
  const top = 18;
  const bottom = 34;
  const chartWidth = width - left - right;
  const chartHeight = height - top - bottom;
  const values = history.map((item) => convertSpeedFromMbps(item.download || 0, speedUnit));
  const maxValue = Math.max(10, ...values);
  const points = values.map((value, index) => ({
    x: left + (history.length <= 1 ? chartWidth / 2 : (index / (history.length - 1)) * chartWidth),
    y: top + chartHeight - (value / maxValue) * chartHeight,
  }));
  const path = buildLinePath(points);
  const average = values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 0;

  return (
    <LiquidGlass style={styles.card} borderRadius={RADIUS.lg} contentStyle={styles.content}>
      <View style={styles.headerRow}>
        <View>
          <Text style={[styles.title, { color: t.textPrimary }]}>Background Monitoring</Text>
          <Text style={[styles.subtitle, { color: t.textMuted }]}>Last 24 hours</Text>
        </View>
        <View style={styles.metricBlock}>
          <Text style={[styles.metricValue, { color: t.textPrimary }]}>{average.toFixed(1)}</Text>
          <Text style={[styles.metricLabel, { color: t.textMuted }]}>{speedUnitLabel} avg</Text>
        </View>
      </View>

      {history.length < 2 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyTitle, { color: t.textSecondary }]}>No background trend yet</Text>
          <Text style={[styles.emptySubtitle, { color: t.textMuted }]}>
            Enable continuous monitoring to collect low-impact background samples.
          </Text>
        </View>
      ) : (
        <Svg width={width} height={height}>
          {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
            const y = top + chartHeight - fraction * chartHeight;
            const label = Math.round(maxValue * fraction);
            return (
              <React.Fragment key={fraction}>
                <Line x1={left} y1={y} x2={width - right} y2={y} stroke={t.gridLine} strokeWidth="1" strokeDasharray="4,4" />
                <SvgText x={left - 8} y={y + 4} fontSize="10" fontWeight="600" fill={t.axisLabel} textAnchor="end">
                  {label}
                </SvgText>
              </React.Fragment>
            );
          })}

          <Path d={path} fill="none" stroke={t.accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          {points.map((point, index) => (
            <Circle key={`${point.x}-${index}`} cx={point.x} cy={point.y} r={3.5} fill={t.accent} stroke={t.surface} strokeWidth="2" />
          ))}
          {history.map((item, index) => {
            if (index % Math.max(1, Math.ceil(history.length / 5)) !== 0 && index !== history.length - 1) {
              return null;
            }

            const point = points[index];
            return (
              <SvgText key={item.date} x={point.x} y={height - 10} fontSize="10" fill={t.axisLabelSub} textAnchor="middle">
                {formatHour(item.date)}
              </SvgText>
            );
          })}
        </Svg>
      )}
    </LiquidGlass>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: RADIUS.lg,
    marginBottom: 20,
    overflow: 'hidden',
  },
  content: {
    padding: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 3,
  },
  metricBlock: {
    alignItems: 'flex-end',
  },
  metricValue: {
    fontSize: 20,
    fontWeight: '900',
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  empty: {
    minHeight: 130,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
});

export default BackgroundHistoryGraph;

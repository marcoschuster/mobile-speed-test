import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Dimensions } from 'react-native';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';
import LiquidGlass from './LiquidGlass';
import { RADIUS, useTheme } from '../utils/theme';
import { convertSpeedFromMbps, getSpeedUnitLabel } from '../utils/measurements';
import { type HistoryItem } from '../utils/history';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = 24;
const MIN_TESTS = 20;

interface HeatmapCell {
  day: number;
  hour: number;
  avgSpeed: number;
  count: number;
}

interface TimeOfDayHeatmapProps {
  history: HistoryItem[];
  speedUnit: any;
}

const TimeOfDayHeatmap = ({ history, speedUnit }: TimeOfDayHeatmapProps) => {
  const { t } = useTheme();
  const [selectedCell, setSelectedCell] = useState<HeatmapCell | null>(null);
  const speedUnitLabel = getSpeedUnitLabel(speedUnit);

  // Aggregate data by day of week and hour
  const heatmapData = useMemo(() => {
    const grid: Map<string, { sum: number; count: number }> = new Map();

    history.forEach((item) => {
      const date = new Date(item.date);
      const day = date.getDay(); // 0 = Sunday, 6 = Saturday
      const hour = date.getHours();
      const speed = item.download || 0;

      const key = `${day}-${hour}`;
      const existing = grid.get(key) || { sum: 0, count: 0 };
      grid.set(key, { sum: existing.sum + speed, count: existing.count + 1 });
    });

    const cells: HeatmapCell[] = [];
    for (let day = 0; day < 7; day++) {
      for (let hour = 0; hour < HOURS; hour++) {
        const key = `${day}-${hour}`;
        const data = grid.get(key);
        cells.push({
          day,
          hour,
          avgSpeed: data ? data.sum / data.count : 0,
          count: data?.count || 0,
        });
      }
    }

    return cells;
  }, [history]);

  // Find slowest time period
  const slowestPeriod = useMemo(() => {
    const hourAverages: number[] = new Array(HOURS).fill(0);
    const hourCounts: number[] = new Array(HOURS).fill(0);

    heatmapData.forEach((cell) => {
      if (cell.count > 0) {
        hourAverages[cell.hour] += cell.avgSpeed * cell.count;
        hourCounts[cell.hour] += cell.count;
      }
    });

    const avgByHour = hourAverages.map((sum, i) => 
      hourCounts[i] > 0 ? sum / hourCounts[i] : 0
    );

    // Find slowest 3-hour window
    let minAvg = Infinity;
    let startHour = 0;
    for (let i = 0; i < HOURS; i++) {
      const windowAvg = (avgByHour[i] + avgByHour[(i + 1) % HOURS] + avgByHour[(i + 2) % HOURS]) / 3;
      if (windowAvg < minAvg && windowAvg > 0) {
        minAvg = windowAvg;
        startHour = i;
      }
    }

    if (minAvg === Infinity) return null;

    const endHour = (startHour + 2) % HOURS;
    const formatHour = (h: number) => {
      if (h === 0) return '12am';
      if (h === 12) return '12pm';
      return h > 12 ? `${h - 12}pm` : `${h}am`;
    };

    return {
      start: formatHour(startHour),
      end: formatHour(endHour),
      avg: minAvg.toFixed(1),
    };
  }, [heatmapData]);

  // Color scale based on speed
  const getColor = (speed: number): string => {
    if (speed >= 200) return '#166534'; // dark green
    if (speed >= 100) return '#22c55e'; // light green
    if (speed >= 50) return '#eab308'; // yellow
    if (speed >= 20) return '#f97316'; // orange
    return '#ef4444'; // red
  };

  const totalTests = history.length;

  if (totalTests < MIN_TESTS) {
    return (
      <LiquidGlass style={styles.card} borderRadius={RADIUS.lg} contentStyle={styles.content}>
        <View style={styles.headerRow}>
          <Text style={[styles.title, { color: t.textPrimary }]}>Time of Day Performance</Text>
        </View>
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyTitle, { color: t.textSecondary }]}>Need more data</Text>
          <Text style={[styles.emptySubtitle, { color: t.textMuted }]}>
            Run at least {MIN_TESTS} speed tests to see your performance patterns by time of day
          </Text>
        </View>
      </LiquidGlass>
    );
  }

  const screenWidth = Dimensions.get('window').width;
  const cellSize = (screenWidth - 64) / 24;
  const rowHeight = cellSize + 8;
  const labelWidth = 32;
  const chartWidth = cellSize * 24;
  const chartHeight = rowHeight * 7;

  const handleCellPress = (cell: HeatmapCell) => {
    setSelectedCell(cell);
    const dayName = DAYS[cell.day];
    const hourStr = cell.hour === 0 ? '12am' : cell.hour === 12 ? '12pm' : cell.hour > 12 ? `${cell.hour - 12}pm` : `${cell.hour}am`;
    const avgSpeed = convertSpeedFromMbps(cell.avgSpeed, speedUnit).toFixed(1);
    
    Alert.alert(
      `${dayName}s ${hourStr}`,
      `Avg ${avgSpeed} ${speedUnitLabel} (${cell.count} test${cell.count !== 1 ? 's' : ''})`,
      [{ text: 'OK', onPress: () => setSelectedCell(null) }]
    );
  };

  return (
    <LiquidGlass style={styles.card} borderRadius={RADIUS.lg} contentStyle={styles.content}>
      <View style={styles.headerRow}>
        <View>
          <Text style={[styles.title, { color: t.textPrimary }]}>Time of Day Performance</Text>
          {slowestPeriod && (
            <Text style={[styles.insight, { color: t.textMuted }]}>
              Your ISP is slowest: {slowestPeriod.start}-{slowestPeriod.end} (avg {slowestPeriod.avg} Mbps)
            </Text>
          )}
        </View>
      </View>

      <View style={styles.chartContainer}>
        <Svg width={labelWidth + chartWidth} height={chartHeight + 20}>
          {/* Day labels */}
          {DAYS.map((day, i) => (
            <SvgText
              key={day}
              x={labelWidth - 4}
              y={i * rowHeight + cellSize / 2 + 4}
              fontSize="10"
              fontWeight="600"
              fill={t.axisLabel}
              textAnchor="end"
            >
              {day}
            </SvgText>
          ))}

          {/* Hour labels */}
          {[0, 6, 12, 18].map((hour) => (
            <SvgText
              key={hour}
              x={labelWidth + hour * cellSize + cellSize / 2}
              y={chartHeight + 14}
              fontSize="9"
              fontWeight="600"
              fill={t.axisLabelSub}
              textAnchor="middle"
            >
              {hour === 0 ? '12a' : hour === 12 ? '12p' : hour > 12 ? `${hour - 12}p` : `${hour}a`}
            </SvgText>
          ))}

          {/* Heatmap cells */}
          {heatmapData.map((cell) => {
            const x = labelWidth + cell.hour * cellSize;
            const y = cell.day * rowHeight;
            const color = cell.count > 0 ? getColor(cell.avgSpeed) : t.gridLine;
            const isSelected = selectedCell?.day === cell.day && selectedCell?.hour === cell.hour;

            return (
              <Rect
                key={`${cell.day}-${cell.hour}`}
                x={x}
                y={y}
                width={cellSize - 1}
                height={cellSize - 1}
                rx={2}
                fill={color}
                opacity={cell.count > 0 ? 1 : 0.3}
                stroke={isSelected ? t.accent : 'none'}
                strokeWidth={isSelected ? 2 : 0}
              />
            );
          })}
        </Svg>

        {/* Touch overlay for cells */}
        <View style={[styles.touchOverlay, { width: chartWidth, height: chartHeight, marginLeft: labelWidth }]}>
          {heatmapData.map((cell) => (
            <TouchableOpacity
              key={`touch-${cell.day}-${cell.hour}`}
              style={{
                position: 'absolute',
                left: cell.hour * cellSize,
                top: cell.day * rowHeight,
                width: cellSize,
                height: cellSize,
              }}
              onPress={() => handleCellPress(cell)}
              activeOpacity={0.7}
            />
          ))}
        </View>
      </View>

      {/* Legend */}
      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendBox, { backgroundColor: '#166534' }]} />
          <Text style={[styles.legendText, { color: t.textSecondary }]}>200+</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendBox, { backgroundColor: '#22c55e' }]} />
          <Text style={[styles.legendText, { color: t.textSecondary }]}>100+</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendBox, { backgroundColor: '#eab308' }]} />
          <Text style={[styles.legendText, { color: t.textSecondary }]}>50+</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendBox, { backgroundColor: '#f97316' }]} />
          <Text style={[styles.legendText, { color: t.textSecondary }]}>20+</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendBox, { backgroundColor: '#ef4444' }]} />
          <Text style={[styles.legendText, { color: t.textSecondary }]}>&lt;20</Text>
        </View>
      </View>
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
    marginBottom: 14,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
  },
  insight: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  emptyContainer: {
    minHeight: 120,
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
  chartContainer: {
    position: 'relative',
    marginVertical: 12,
  },
  touchOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 8,
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendBox: {
    width: 12,
    height: 12,
    borderRadius: 2,
  },
  legendText: {
    fontSize: 10,
    fontWeight: '600',
  },
});

export default TimeOfDayHeatmap;

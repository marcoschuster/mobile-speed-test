import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Dimensions, Modal, ScrollView } from 'react-native';
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
  backgroundHistory: HistoryItem[];
  speedUnit: any;
}

const TimeOfDayHeatmap = ({ history, backgroundHistory, speedUnit }: TimeOfDayHeatmapProps) => {
  const { t } = useTheme();
  const [selectedCell, setSelectedCell] = useState<HeatmapCell | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [currentWeekOffset, setCurrentWeekOffset] = useState(0);
  const speedUnitLabel = getSpeedUnitLabel(speedUnit);

  // Merge regular and background history
  const allHistory = useMemo(() => {
    return [...history, ...backgroundHistory];
  }, [history, backgroundHistory]);

  // Get unique weeks from data
  const weekRanges = useMemo(() => {
    if (allHistory.length === 0) return [];
    
    const dates = allHistory.map(item => new Date(item.date).getTime());
    const minDate = Math.min(...dates);
    const maxDate = Math.max(...dates);
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    
    const weeks = [];
    let currentWeekStart = minDate;
    while (currentWeekStart <= maxDate) {
      weeks.push({
        start: currentWeekStart,
        end: currentWeekStart + weekMs,
      });
      currentWeekStart += weekMs;
    }
    
    return weeks;
  }, [allHistory]);

  // Aggregate data by day of week and hour for selected week
  const heatmapData = useMemo(() => {
    const grid: Map<string, { sum: number; count: number }> = new Map();
    
    let filteredHistory = allHistory;
    if (weekRanges.length > 0) {
      const weekIndex = Math.min(currentWeekOffset, weekRanges.length - 1);
      const week = weekRanges[weekIndex];
      filteredHistory = allHistory.filter(item => {
        const itemDate = new Date(item.date).getTime();
        return itemDate >= week.start && itemDate < week.end;
      });
    }

    filteredHistory.forEach((item) => {
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
  }, [allHistory, currentWeekOffset, weekRanges]);

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

  const totalTests = allHistory.length;

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

  // Expanded view dimensions
  const expandedCellSize = (screenWidth - 80) / 24;
  const expandedRowHeight = expandedCellSize + 12;
  const expandedLabelWidth = 50;
  const expandedChartWidth = expandedCellSize * 24;
  const expandedChartHeight = expandedRowHeight * 7;

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
    <>
      <LiquidGlass style={styles.card} borderRadius={RADIUS.lg} contentStyle={styles.content}>
        <TouchableOpacity 
          onPress={() => setIsExpanded(true)} 
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.headerTouchable}
        >
          <View style={styles.headerRow}>
            <View>
              <Text style={[styles.title, { color: t.textPrimary }]}>Time of Day Performance</Text>
              {slowestPeriod && (
                <Text style={[styles.insight, { color: t.textMuted }]}>
                  Your ISP is slowest: {slowestPeriod.start}-{slowestPeriod.end} (avg {slowestPeriod.avg} Mbps)
                </Text>
              )}
            </View>
            <Text style={[styles.tapHint, { color: t.accent }]}>Tap to expand →</Text>
          </View>
        </TouchableOpacity>

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

          {/* Hour labels - 0h to 24h */}
          {[0, 4, 8, 12, 16, 20, 24].map((hour) => (
            <SvgText
              key={hour}
              x={labelWidth + (hour === 24 ? 23.5 : hour) * cellSize + cellSize / 2}
              y={chartHeight + 14}
              fontSize="9"
              fontWeight="600"
              fill={t.axisLabelSub}
              textAnchor="middle"
            >
              {hour}h
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

        {/* Week navigation */}
        {weekRanges.length > 1 && (
          <View style={styles.weekNav}>
            <TouchableOpacity
              style={[styles.weekNavButton, currentWeekOffset === 0 && styles.weekNavButtonDisabled]}
              onPress={() => setCurrentWeekOffset(Math.max(0, currentWeekOffset - 1))}
              disabled={currentWeekOffset === 0}
            >
              <Text style={[styles.weekNavButtonText, { color: currentWeekOffset === 0 ? t.textMuted : t.accent }]}>←</Text>
            </TouchableOpacity>
            <Text style={[styles.weekLabel, { color: t.textSecondary }]}>
              Week {currentWeekOffset + 1} of {weekRanges.length}
            </Text>
            <TouchableOpacity
              style={[styles.weekNavButton, currentWeekOffset === weekRanges.length - 1 && styles.weekNavButtonDisabled]}
              onPress={() => setCurrentWeekOffset(Math.min(weekRanges.length - 1, currentWeekOffset + 1))}
              disabled={currentWeekOffset === weekRanges.length - 1}
            >
              <Text style={[styles.weekNavButtonText, { color: currentWeekOffset === weekRanges.length - 1 ? t.textMuted : t.accent }]}>→</Text>
            </TouchableOpacity>
          </View>
        )}

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

      {/* Expanded Modal */}
      <Modal
        visible={isExpanded}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setIsExpanded(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.8)' }]}>
          <View style={[styles.modalContent, { backgroundColor: t.background }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: t.textPrimary }]}>Time of Day Performance</Text>
              <TouchableOpacity onPress={() => setIsExpanded(false)} style={styles.closeButton}>
                <Text style={[styles.closeButtonText, { color: t.accent }]}>✕</Text>
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalScroll}>
              <View style={styles.expandedChartContainer}>
                <Svg width={expandedLabelWidth + expandedChartWidth} height={expandedChartHeight + 30}>
                  {/* Day labels */}
                  {DAYS.map((day, i) => (
                    <SvgText
                      key={day}
                      x={expandedLabelWidth - 8}
                      y={i * expandedRowHeight + expandedCellSize / 2 + 4}
                      fontSize="14"
                      fontWeight="700"
                      fill={t.axisLabel}
                      textAnchor="end"
                    >
                      {day}
                    </SvgText>
                  ))}

                  {/* Hour labels - 0h to 24h */}
                  {[0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24].map((hour) => (
                    <SvgText
                      key={hour}
                      x={expandedLabelWidth + (hour === 24 ? 23.5 : hour) * expandedCellSize + expandedCellSize / 2}
                      y={expandedChartHeight + 20}
                      fontSize="11"
                      fontWeight="700"
                      fill={t.axisLabelSub}
                      textAnchor="middle"
                    >
                      {hour}h
                    </SvgText>
                  ))}

                  {/* Heatmap cells */}
                  {heatmapData.map((cell) => {
                    const x = expandedLabelWidth + cell.hour * expandedCellSize;
                    const y = cell.day * expandedRowHeight;
                    const color = cell.count > 0 ? getColor(cell.avgSpeed) : t.gridLine;
                    const isSelected = selectedCell?.day === cell.day && selectedCell?.hour === cell.hour;

                    return (
                      <Rect
                        key={`expanded-${cell.day}-${cell.hour}`}
                        x={x}
                        y={y}
                        width={expandedCellSize - 2}
                        height={expandedCellSize - 2}
                        rx={3}
                        fill={color}
                        opacity={cell.count > 0 ? 1 : 0.3}
                        stroke={isSelected ? t.accent : 'none'}
                        strokeWidth={isSelected ? 3 : 0}
                      />
                    );
                  })}
                </Svg>

                {/* Touch overlay for expanded cells */}
                <View style={[styles.touchOverlay, { width: expandedChartWidth, height: expandedChartHeight, marginLeft: expandedLabelWidth }]}>
                  {heatmapData.map((cell) => (
                    <TouchableOpacity
                      key={`expanded-touch-${cell.day}-${cell.hour}`}
                      style={{
                        position: 'absolute',
                        left: cell.hour * expandedCellSize,
                        top: cell.day * expandedRowHeight,
                        width: expandedCellSize,
                        height: expandedCellSize,
                      }}
                      onPress={() => handleCellPress(cell)}
                      activeOpacity={0.7}
                    />
                  ))}
                </View>
              </View>

              {/* Week navigation in expanded view */}
              {weekRanges.length > 1 && (
                <View style={styles.weekNav}>
                  <TouchableOpacity
                    style={[styles.weekNavButton, currentWeekOffset === 0 && styles.weekNavButtonDisabled]}
                    onPress={() => setCurrentWeekOffset(Math.max(0, currentWeekOffset - 1))}
                    disabled={currentWeekOffset === 0}
                  >
                    <Text style={[styles.weekNavButtonText, { color: currentWeekOffset === 0 ? t.textMuted : t.accent }]}>← Previous Week</Text>
                  </TouchableOpacity>
                  <Text style={[styles.weekLabel, { color: t.textSecondary }]}>
                    Week {currentWeekOffset + 1} of {weekRanges.length}
                  </Text>
                  <TouchableOpacity
                    style={[styles.weekNavButton, currentWeekOffset === weekRanges.length - 1 && styles.weekNavButtonDisabled]}
                    onPress={() => setCurrentWeekOffset(Math.min(weekRanges.length - 1, currentWeekOffset + 1))}
                    disabled={currentWeekOffset === weekRanges.length - 1}
                  >
                    <Text style={[styles.weekNavButtonText, { color: currentWeekOffset === weekRanges.length - 1 ? t.textMuted : t.accent }]}>Next Week →</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Legend */}
              <View style={styles.legendRow}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendBox, { backgroundColor: '#166534' }]} />
                  <Text style={[styles.legendText, { color: t.textSecondary }]}>200+ Mbps</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendBox, { backgroundColor: '#22c55e' }]} />
                  <Text style={[styles.legendText, { color: t.textSecondary }]}>100+ Mbps</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendBox, { backgroundColor: '#eab308' }]} />
                  <Text style={[styles.legendText, { color: t.textSecondary }]}>50+ Mbps</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendBox, { backgroundColor: '#f97316' }]} />
                  <Text style={[styles.legendText, { color: t.textSecondary }]}>20+ Mbps</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendBox, { backgroundColor: '#ef4444' }]} />
                  <Text style={[styles.legendText, { color: t.textSecondary }]}>&lt;20 Mbps</Text>
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTouchable: {
    width: '100%',
  },
  tapHint: {
    fontSize: 11,
    fontWeight: '600',
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
  weekNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingHorizontal: 8,
  },
  weekNavButton: {
    padding: 8,
  },
  weekNavButtonDisabled: {
    opacity: 0.3,
  },
  weekNavButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  weekLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '95%',
    maxHeight: '90%',
    borderRadius: RADIUS.xl,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    fontSize: 24,
    fontWeight: '700',
  },
  modalScroll: {
    flex: 1,
  },
  expandedChartContainer: {
    position: 'relative',
    marginVertical: 16,
  },
});

export default TimeOfDayHeatmap;

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView, Pressable, PanResponder, useWindowDimensions } from 'react-native';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';
import LiquidGlass from './LiquidGlass';
import { RADIUS, useTheme } from '../utils/theme';
import { convertSpeedFromMbps, getSpeedUnitLabel } from '../utils/measurements';
import { type HistoryItem } from '../utils/history';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = 24;
const MIN_TESTS = 20;
const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const MAX_HORIZONTAL_ZOOM = 2;

interface HeatmapCell {
  day: number;
  hour: number;
  avgSpeed: number;
  count: number;
}

interface TimeOfDayHeatmapProps {
  history: HistoryItem[] | null | undefined;
  backgroundHistory: HistoryItem[] | null | undefined;
  speedUnit: any;
}

const clampZoom = (value: number, maxZoom = MAX_ZOOM) => Math.max(MIN_ZOOM, Math.min(maxZoom, value));

const getTouchDistance = (touches: Array<{ pageX: number; pageY: number }>) => {
  if (touches.length < 2) return 0;
  const [first, second] = touches;
  return Math.hypot(first.pageX - second.pageX, first.pageY - second.pageY);
};

const formatHourLabel = (hour: number) => {
  return `${hour}:00`;
};

const TimeOfDayHeatmap = ({ history, backgroundHistory, speedUnit }: TimeOfDayHeatmapProps) => {
  const { t } = useTheme();
  const { width: viewportWidth, height: viewportHeight } = useWindowDimensions();
  const [selectedCell, setSelectedCell] = useState<HeatmapCell | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [currentWeekOffset, setCurrentWeekOffset] = useState(0);
  const [heatmapZoom, setHeatmapZoom] = useState(1);
  const [isHeatmapRotated, setIsHeatmapRotated] = useState(false);
  const [isPinchingHeatmap, setIsPinchingHeatmap] = useState(false);
  const pinchStartDistance = useRef(0);
  const pinchStartZoom = useRef(1);
  const heatmapZoomRef = useRef(1);
  const pendingZoomRef = useRef(1);
  const zoomFrameRef = useRef<number | null>(null);
  const speedUnitLabel = getSpeedUnitLabel(speedUnit);
  const isLandscape = viewportWidth > viewportHeight || isHeatmapRotated;
  const maxHeatmapZoom = isLandscape ? MAX_HORIZONTAL_ZOOM : MAX_ZOOM;

  useEffect(() => {
    setHeatmapZoom((current) => clampZoom(current, maxHeatmapZoom));
  }, [maxHeatmapZoom]);

  useEffect(() => {
    heatmapZoomRef.current = heatmapZoom;
    pendingZoomRef.current = heatmapZoom;
  }, [heatmapZoom]);

  useEffect(() => () => {
    if (zoomFrameRef.current !== null) {
      cancelAnimationFrame(zoomFrameRef.current);
    }
  }, []);

  const scheduleZoomUpdate = (nextZoom: number) => {
    const clampedZoom = clampZoom(nextZoom, maxHeatmapZoom);
    if (Math.abs(clampedZoom - pendingZoomRef.current) < 0.01) return;

    pendingZoomRef.current = clampedZoom;
    if (zoomFrameRef.current !== null) return;

    zoomFrameRef.current = requestAnimationFrame(() => {
      zoomFrameRef.current = null;
      const scheduledZoom = pendingZoomRef.current;
      if (Math.abs(scheduledZoom - heatmapZoomRef.current) < 0.01) return;
      heatmapZoomRef.current = scheduledZoom;
      setHeatmapZoom(scheduledZoom);
    });
  };

  // Merge regular and background history
  const allHistory = useMemo(() => {
    const speedHistory = Array.isArray(history) ? history : [];
    const bgHistory = Array.isArray(backgroundHistory) ? backgroundHistory : [];
    return [...speedHistory, ...bgHistory];
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

    if (!allHistory || allHistory.length === 0) {
      return [];
    }

    let filteredHistory = allHistory;
    if (weekRanges.length > 0) {
      const weekIndex = Math.min(currentWeekOffset, weekRanges.length - 1);
      const week = weekRanges[weekIndex];
      filteredHistory = allHistory.filter(item => {
        if (!item?.date) return false;
        const itemDate = new Date(item.date).getTime();
        return itemDate >= week.start && itemDate < week.end;
      });
    }

    const safeFilteredHistory = Array.isArray(filteredHistory) ? filteredHistory : [];
    safeFilteredHistory.forEach((item) => {
      if (!item?.date) return;
      const date = new Date(item.date);
      const day = date.getDay(); // 0 = Sunday, 6 = Saturday
      const hour = date.getHours();
      const speed = item.download || 0;

      // Shift hour from 0-23 to 1-24
      const displayHour = hour === 0 ? 24 : hour;
      const key = `${day}-${displayHour}`;
      const existing = grid.get(key) || { sum: 0, count: 0 };
      grid.set(key, { sum: existing.sum + speed, count: existing.count + 1 });
    });

    const cells: HeatmapCell[] = [];
    for (let day = 0; day < 7; day++) {
      for (let hour = 1; hour <= HOURS; hour++) {
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
    const hourAverages: number[] = new Array(HOURS + 1).fill(0);
    const hourCounts: number[] = new Array(HOURS + 1).fill(0);

    const safeHeatmapData = Array.isArray(heatmapData) ? heatmapData : [];
    safeHeatmapData.forEach((cell) => {
      if (cell.count > 0) {
        hourAverages[cell.hour] += cell.avgSpeed * cell.count;
        hourCounts[cell.hour] += cell.count;
      }
    });

    const avgByHour = hourAverages.map((sum, i) =>
      hourCounts[i] > 0 ? sum / hourCounts[i] : 0
    );

    // Find slowest 3-hour window (1-24 range)
    let minAvg = Infinity;
    let startHour = 1;
    for (let i = 1; i <= HOURS; i++) {
      const next1 = i === HOURS ? 1 : i + 1;
      const next2 = i === HOURS - 1 ? 1 : i === HOURS ? 2 : i + 2;
      const windowAvg = (avgByHour[i] + avgByHour[next1] + avgByHour[next2]) / 3;
      if (windowAvg < minAvg && windowAvg > 0) {
        minAvg = windowAvg;
        startHour = i;
      }
    }

    if (minAvg === Infinity) return null;

    const endHour = startHour === HOURS - 1 ? 24 : startHour === HOURS ? 1 : startHour + 2;
    const formatHour = (h: number) => `${h}:00`;

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

  const pinchResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponderCapture: (event) => event.nativeEvent.touches.length >= 2,
    onStartShouldSetPanResponder: (event) => event.nativeEvent.touches.length >= 2,
    onMoveShouldSetPanResponderCapture: (event) => event.nativeEvent.touches.length >= 2,
    onMoveShouldSetPanResponder: (event) => event.nativeEvent.touches.length >= 2,
    onPanResponderGrant: (event) => {
      setIsPinchingHeatmap(true);
      pinchStartDistance.current = getTouchDistance(event.nativeEvent.touches);
      pinchStartZoom.current = heatmapZoomRef.current;
    },
    onPanResponderMove: (event) => {
      const distance = getTouchDistance(event.nativeEvent.touches);
      if (pinchStartDistance.current <= 0 || distance <= 0) return;
      scheduleZoomUpdate(pinchStartZoom.current * (distance / pinchStartDistance.current));
    },
    onPanResponderRelease: () => {
      setIsPinchingHeatmap(false);
      pinchStartDistance.current = 0;
      pinchStartZoom.current = pendingZoomRef.current;
      setHeatmapZoom(pendingZoomRef.current);
    },
    onPanResponderTerminate: () => {
      setIsPinchingHeatmap(false);
      pinchStartDistance.current = 0;
      pinchStartZoom.current = pendingZoomRef.current;
      setHeatmapZoom(pendingZoomRef.current);
    },
  }), [maxHeatmapZoom]);

  const adjustZoom = (delta: number) => {
    setHeatmapZoom((current) => clampZoom(Number((current + delta).toFixed(2)), maxHeatmapZoom));
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

  const screenWidth = viewportWidth;
  const cellSize = (screenWidth - 64) / 24;
  const rowHeight = cellSize + 8;
  const labelWidth = 32;
  const chartWidth = cellSize * 24;
  const chartHeight = rowHeight * 7;

  // Expanded view dimensions
  const heatmapViewportWidth = isHeatmapRotated ? viewportHeight : viewportWidth;
  const expandedViewportWidth = isLandscape ? heatmapViewportWidth * 0.86 : heatmapViewportWidth * 0.92;
  const expandedCellSize = ((expandedViewportWidth - 60) / 24) * heatmapZoom;
  const expandedRowHeight = expandedCellSize + 12;
  const expandedLabelWidth = 50;
  const expandedChartWidth = expandedCellSize * 24;
  const expandedChartHeight = expandedRowHeight * 7;
  const modalWidth = isHeatmapRotated ? viewportHeight * 0.92 : viewportWidth * 0.98;
  const modalHeight = isHeatmapRotated ? viewportWidth * 0.96 : viewportHeight * 0.88;

  const handleCellPress = (cell: HeatmapCell) => {
    setSelectedCell(cell);
  };

  const handleCellPressAt = (
    locationX: number,
    locationY: number,
    targetCellSize: number,
    targetRowHeight: number,
  ) => {
    const hourIndex = Math.floor(locationX / targetCellSize);
    const hour = Math.max(1, Math.min(HOURS, hourIndex + 1));
    const day = Math.max(0, Math.min(DAYS.length - 1, Math.floor(locationY / targetRowHeight)));
    const cell = heatmapData.find((item) => item.day === day && item.hour === hour);
    if (cell) handleCellPress(cell);
  };

  const selectedCellInfo = selectedCell ? {
    day: DAYS[selectedCell.day],
    hour: formatHourLabel(selectedCell.hour),
    avg: convertSpeedFromMbps(selectedCell.avgSpeed, speedUnit).toFixed(1),
    count: selectedCell.count,
  } : null;

  return (
    <>
      <LiquidGlass style={styles.card} borderRadius={RADIUS.lg} contentStyle={styles.content}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: t.textPrimary }]}>Time of Day Performance</Text>
            {slowestPeriod && (
              <Text style={[styles.insight, { color: t.textMuted }]}>
                Your ISP is slowest: {slowestPeriod.start}-{slowestPeriod.end} (avg {slowestPeriod.avg} Mbps)
              </Text>
            )}
          </View>
          <View style={styles.headerRightColumn}>
            {selectedCellInfo && (
              <View pointerEvents="none" style={[styles.cellInfoPanel, styles.headerCellInfoPanel, { backgroundColor: t.surfaceElevated || t.glassStrong, borderColor: t.glassBorderStrong || t.axisLine }]}>
                <Text style={[styles.cellInfoTitle, { color: t.textPrimary }]}>{selectedCellInfo.day} {selectedCellInfo.hour}</Text>
                <Text style={[styles.cellInfoValue, { color: t.accent }]}>{selectedCellInfo.avg} {speedUnitLabel}</Text>
                <Text style={[styles.cellInfoMeta, { color: t.textMuted }]}>{selectedCellInfo.count} test{selectedCellInfo.count !== 1 ? 's' : ''}</Text>
              </View>
            )}
            <TouchableOpacity
              onPress={() => setIsExpanded(true)}
              hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
              style={styles.expandButton}
            >
              <Text style={[styles.tapHint, { color: t.accent }]}>Tap to expand →</Text>
            </TouchableOpacity>
          </View>
        </View>

      <View style={styles.chartContainer}>
        <View style={[styles.heatmapBox, { width: labelWidth + chartWidth, height: chartHeight + 20 }]}>
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

          {/* Hour labels - 1h to 23h */}
          {[1, 5, 9, 13, 17, 21].map((hour) => (
            <SvgText
              key={hour}
              x={labelWidth + (hour - 1) * cellSize + cellSize / 2}
              y={chartHeight + 14}
              fontSize="9"
              fontWeight="600"
              fill={t.axisLabelSub}
              textAnchor="middle"
              letterSpacing="-0.5"
            >
              {`${hour}h`}
            </SvgText>
          ))}

          {/* Heatmap cells */}
          {heatmapData.map((cell) => {
            const x = labelWidth + (cell.hour - 1) * cellSize;
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
        <View style={[styles.touchOverlay, { width: chartWidth, height: chartHeight, left: labelWidth }]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={(event) => {
              handleCellPressAt(event.nativeEvent.locationX, event.nativeEvent.locationY, cellSize, rowHeight);
            }}
          />
        </View>
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
          <View
            style={[
              styles.modalContent,
              {
                backgroundColor: t.bg || t.background,
                width: modalWidth,
                height: modalHeight,
                maxHeight: modalHeight,
                transform: isHeatmapRotated ? [{ rotate: '90deg' }] : [],
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: t.textPrimary }]}>Time of Day Performance</Text>
              {selectedCellInfo && (
                <View pointerEvents="none" style={[styles.cellInfoPanel, styles.modalHeaderInfoPanel, { backgroundColor: t.surfaceElevated || t.glassStrong, borderColor: t.glassBorderStrong || t.axisLine }]}>
                  <Text style={[styles.cellInfoTitle, { color: t.textPrimary }]}>{selectedCellInfo.day} {selectedCellInfo.hour}</Text>
                  <Text style={[styles.cellInfoValue, { color: t.accent }]}>{selectedCellInfo.avg} {speedUnitLabel}</Text>
                  <Text style={[styles.cellInfoMeta, { color: t.textMuted }]}>{selectedCellInfo.count} test{selectedCellInfo.count !== 1 ? 's' : ''}</Text>
                </View>
              )}
              <TouchableOpacity onPress={() => setIsExpanded(false)} style={styles.closeButton}>
                <Text style={[styles.closeButtonText, { color: t.accent }]}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView 
              style={styles.modalScroll}
              contentContainerStyle={styles.modalScrollContent}
              showsVerticalScrollIndicator={true}
              scrollEnabled={!isPinchingHeatmap}
            >
              <ScrollView
                horizontal
                style={styles.expandedHorizontalScroll}
                contentContainerStyle={styles.expandedHorizontalContent}
                showsHorizontalScrollIndicator={true}
                scrollEnabled={!isPinchingHeatmap}
              >
                <View
                  style={[
                    styles.expandedChartWrapper,
                    { width: expandedLabelWidth + expandedChartWidth, minHeight: expandedChartHeight + 30 },
                  ]}
                  {...pinchResponder.panHandlers}
                >
                  <Svg width={expandedLabelWidth + expandedChartWidth} height={expandedChartHeight + 30}>
                    {/* Day labels */}
                    {DAYS.map((day, i) => (
                      <SvgText
                        key={day}
                        x={expandedLabelWidth - 8}
                        y={i * expandedRowHeight + expandedCellSize / 2 + 4}
                        fontSize={Math.min(14 * heatmapZoom, 22)}
                        fontWeight="700"
                        fill={t.axisLabel}
                        textAnchor="end"
                      >
                        {day}
                      </SvgText>
                    ))}

                    {/* Hour labels - 1h to 23h */}
                    {[1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23].map((hour) => (
                      <SvgText
                        key={hour}
                        x={expandedLabelWidth + (hour - 1) * expandedCellSize + expandedCellSize / 2}
                        y={expandedChartHeight + 20}
                        fontSize={Math.min(11 * heatmapZoom, 18)}
                        fontWeight="700"
                        fill={t.axisLabelSub}
                        textAnchor="middle"
                        letterSpacing="-0.5"
                      >
                        {`${hour}h`}
                      </SvgText>
                    ))}

                    {/* Heatmap cells */}
                    {heatmapData.map((cell) => {
                      const x = expandedLabelWidth + (cell.hour - 1) * expandedCellSize;
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
                  <View style={[styles.touchOverlay, { width: expandedChartWidth, height: expandedChartHeight, left: expandedLabelWidth }]}>
                    <Pressable
                      style={StyleSheet.absoluteFill}
                      onPress={(event) => {
                        handleCellPressAt(
                          event.nativeEvent.locationX,
                          event.nativeEvent.locationY,
                          expandedCellSize,
                          expandedRowHeight,
                        );
                      }}
                    />
                  </View>
                </View>
              </ScrollView>

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

            <View style={styles.modalActions}>
              <View style={[styles.bottomZoomRow, { borderColor: t.glassBorderStrong || t.axisLine, backgroundColor: t.glassSoft || 'rgba(255,255,255,0.06)' }]}>
                <TouchableOpacity
                  style={styles.bottomZoomButton}
                  onPress={() => adjustZoom(-0.25)}
                  disabled={heatmapZoom <= MIN_ZOOM}
                >
                  <Text style={[styles.zoomButtonText, { color: heatmapZoom <= MIN_ZOOM ? t.textMuted : t.accent }]}>−</Text>
                </TouchableOpacity>
                <Text style={[styles.zoomLabel, { color: t.textSecondary }]}>
                  {heatmapZoom.toFixed(2).replace(/\.00$/, '')}x
                </Text>
                <TouchableOpacity
                  style={styles.bottomZoomButton}
                  onPress={() => adjustZoom(0.25)}
                  disabled={heatmapZoom >= maxHeatmapZoom}
                >
                  <Text style={[styles.zoomButtonText, { color: heatmapZoom >= maxHeatmapZoom ? t.textMuted : t.accent }]}>+</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={[styles.rotateButton, { borderColor: t.glassBorderStrong || t.axisLine, backgroundColor: t.glassSoft || 'rgba(255,255,255,0.06)' }]}
                onPress={() => {
                  setIsHeatmapRotated((value) => !value);
                }}
              >
                <Text style={[styles.rotateButtonText, { color: t.accent }]}>
                  {isHeatmapRotated ? 'Normal view' : 'Rotate view'}
                </Text>
              </TouchableOpacity>
            </View>
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
    alignItems: 'flex-start',
    gap: 10,
  },
  headerRightColumn: {
    alignItems: 'flex-end',
    gap: 6,
  },
  expandButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
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
    alignItems: 'center',
  },
  heatmapBox: {
    position: 'relative',
  },
  touchOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 3,
  },
  cellInfoPanel: {
    zIndex: 4,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingVertical: 7,
    paddingHorizontal: 9,
    minWidth: 104,
  },
  headerCellInfoPanel: {
    maxWidth: 128,
  },
  modalHeaderInfoPanel: {
    flexShrink: 1,
    marginLeft: 14,
    marginRight: 10,
    maxWidth: 280,
    minWidth: 180,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  cellInfoTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  cellInfoValue: {
    marginTop: 4,
    fontSize: 18,
    fontWeight: '900',
  },
  cellInfoMeta: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: '700',
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
    borderRadius: RADIUS.xl,
    padding: 20,
    alignItems: 'center',
  },
  modalHeader: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    flexShrink: 1,
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
  zoomButtonText: {
    fontSize: 20,
    lineHeight: 22,
    fontWeight: '900',
  },
  zoomLabel: {
    minWidth: 44,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '800',
  },
  modalScroll: {
    width: '100%',
    flex: 1,
  },
  modalScrollContent: {
    alignItems: 'center',
    paddingBottom: 20,
  },
  expandedHorizontalScroll: {
    width: '100%',
  },
  expandedHorizontalContent: {
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  expandedChartWrapper: {
    position: 'relative',
    alignItems: 'center',
    paddingVertical: 20,
    width: '100%',
  },
  expandedChartContainer: {
    marginVertical: 16,
  },
  modalActions: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingTop: 10,
  },
  bottomZoomRow: {
    minHeight: 42,
    minWidth: 150,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  bottomZoomButton: {
    width: 38,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rotateButton: {
    minHeight: 42,
    minWidth: 150,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  rotateButtonText: {
    fontSize: 13,
    fontWeight: '800',
  },
});

export default TimeOfDayHeatmap;

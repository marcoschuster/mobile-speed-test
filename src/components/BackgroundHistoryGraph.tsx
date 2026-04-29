import React, { useCallback, useEffect, useState } from 'react';
import { Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import LiquidGlass from './LiquidGlass';
import { getBackgroundHistory } from '../services/BackgroundTestService';
import SoundEngine from '../services/SoundEngine';
import { convertSpeedFromMbps, formatPing, getSpeedUnitLabel } from '../utils/measurements';
import { RADIUS, useTheme } from '../utils/theme';

type BackgroundHistoryItem = {
  date: string;
  download: number;
  upload?: number;
  ping?: number;
};

type Point = {
  x: number;
  y: number;
};

const screenWidth = Dimensions.get('window').width;
const DAY_MS = 24 * 60 * 60 * 1000;
const HIT_SIZE = 40;

const buildLinePath = (points: Point[]) => {
  if (!points.length) return '';
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x},${point.y}`).join(' ');
};

const formatHour = (dateString: string) => {
  const date = new Date(dateString);
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
};

const formatTooltipDate = (dateString: string) => {
  const date = new Date(dateString);
  const month = date.toLocaleString('default', { month: 'short' });
  const day = date.getDate();
  return `${month} ${day}, ${formatHour(dateString)}`;
};

const average = (values: number[]) => {
  const valid = values.filter((value) => Number.isFinite(value) && value > 0);
  if (!valid.length) return 0;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
};

const BackgroundHistoryGraph = ({ speedUnit }: { speedUnit: any }) => {
  const { t } = useTheme();
  const [history, setHistory] = useState<BackgroundHistoryItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const speedUnitLabel = getSpeedUnitLabel(speedUnit);
  const uploadColor = t.uploadLine || '#4FC3F7';

  const loadHistory = useCallback(async () => {
    const cutoff = Date.now() - DAY_MS;
    const stored = await getBackgroundHistory();
    const sourceHistory = Array.isArray(stored) ? stored : [];
    const recent = sourceHistory
      .filter((item: BackgroundHistoryItem) => new Date(item.date).getTime() >= cutoff)
      .reverse();
    setHistory(recent);
    setSelectedIndex((current) => (
      current !== null && current >= recent.length ? null : current
    ));
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useFocusEffect(useCallback(() => {
    loadHistory();
  }, [loadHistory]));

  const width = Math.max(screenWidth - 64, history.length * 44);
  const height = 210;
  const left = 42;
  const right = 14;
  const top = 18;
  const bottom = 38;
  const chartWidth = width - left - right;
  const chartHeight = height - top - bottom;
  const downloadValues = history.map((item) => convertSpeedFromMbps(item.download || 0, speedUnit));
  const uploadValues = history.map((item) => convertSpeedFromMbps(item.upload || 0, speedUnit));
  const maxValue = Math.max(10, ...downloadValues, ...uploadValues);
  const xForIndex = (index: number) => (
    left + (history.length <= 1 ? chartWidth / 2 : (index / (history.length - 1)) * chartWidth)
  );
  const yForValue = (value: number) => top + chartHeight - (value / maxValue) * chartHeight;
  const downloadPoints = downloadValues.map((value, index) => ({
    x: xForIndex(index),
    y: yForValue(value),
  }));
  const uploadPoints = uploadValues.map((value, index) => ({
    x: xForIndex(index),
    y: yForValue(value),
  }));
  const downloadPath = buildLinePath(downloadPoints);
  const uploadPath = buildLinePath(uploadPoints);
  const downloadAverage = average(downloadValues);
  const uploadAverage = average(uploadValues);

  const handlePointPress = (index: number) => {
    if (selectedIndex !== index) {
      SoundEngine.playGraphPing();
    }
    setSelectedIndex(selectedIndex === index ? null : index);
  };

  const selectedItem = selectedIndex !== null ? history[selectedIndex] : null;
  const tooltip = selectedItem && selectedIndex !== null ? (() => {
    const x = xForIndex(selectedIndex);
    const downloadY = yForValue(downloadValues[selectedIndex] || 0);
    const uploadY = yForValue(uploadValues[selectedIndex] || 0);
    const tooltipWidth = 148;
    const tooltipHeight = 82;
    const minY = Math.min(downloadY, uploadY);
    const maxY = Math.max(downloadY, uploadY);
    let tooltipY = minY - tooltipHeight - 10;
    if (tooltipY < 2) {
      tooltipY = maxY + 12;
    }
    let tooltipX = x - tooltipWidth / 2;
    if (tooltipX < left) tooltipX = left;
    if (tooltipX + tooltipWidth > width - right) tooltipX = width - right - tooltipWidth;

    return {
      x,
      downloadY,
      uploadY,
      tooltipX,
      tooltipY,
      tooltipWidth,
      tooltipHeight,
      date: formatTooltipDate(selectedItem.date),
      download: downloadValues[selectedIndex] || 0,
      upload: uploadValues[selectedIndex] || 0,
      ping: selectedItem.ping,
    };
  })() : null;

  return (
    <LiquidGlass style={styles.card} borderRadius={RADIUS.lg} contentStyle={styles.content}>
      <View style={styles.headerRow}>
        <View>
          <Text style={[styles.title, { color: t.textPrimary }]}>Background Monitoring</Text>
          <Text style={[styles.subtitle, { color: t.textMuted }]}>Last 24 hours</Text>
        </View>
        <View style={styles.metricRow}>
          <View style={styles.metricBlock}>
            <Text style={[styles.metricValue, { color: t.textPrimary }]}>{downloadAverage.toFixed(1)}</Text>
            <Text style={[styles.metricLabel, { color: t.textMuted }]}>down avg</Text>
          </View>
          <View style={styles.metricBlock}>
            <Text style={[styles.metricValue, { color: t.textPrimary }]}>{uploadAverage.toFixed(1)}</Text>
            <Text style={[styles.metricLabel, { color: t.textMuted }]}>up avg</Text>
          </View>
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
        <>
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: t.accent }]} />
              <Text style={[styles.legendText, { color: t.textMuted }]}>Download</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: uploadColor }]} />
              <Text style={[styles.legendText, { color: t.textMuted }]}>Upload</Text>
            </View>
            <Text style={[styles.unitLabel, { color: t.textMuted }]}>{speedUnitLabel}</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ width, height }}>
              <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
                {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
                  const y = top + chartHeight - fraction * chartHeight;
                  const label = Math.round(maxValue * fraction);
                  return (
                    <G key={fraction}>
                      <Line x1={left} y1={y} x2={width - right} y2={y} stroke={t.gridLine} strokeWidth="1" strokeDasharray="4,4" />
                      <SvgText x={left - 8} y={y + 4} fontSize="10" fontWeight="600" fill={t.axisLabel} textAnchor="end">
                        {label}
                      </SvgText>
                    </G>
                  );
                })}

                <Path d={downloadPath} fill="none" stroke={t.accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                <Path d={uploadPath} fill="none" stroke={uploadColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

                {[downloadPoints, uploadPoints].map((points, pointSetIndex) => (
                  <G key={pointSetIndex}>
                    {points.map((point, index) => {
                      const isSelected = selectedIndex === index;
                      return (
                        <Circle
                          key={`${pointSetIndex}-${point.x}-${index}`}
                          cx={point.x}
                          cy={point.y}
                          r={isSelected ? 5 : 3.5}
                          fill={pointSetIndex === 0 ? t.accent : uploadColor}
                          stroke={isSelected ? t.textPrimary : t.surface}
                          strokeWidth={isSelected ? 2.5 : 2}
                          opacity={selectedIndex !== null && !isSelected ? 0.35 : 1}
                        />
                      );
                    })}
                  </G>
                ))}

                {history.map((item, index) => {
                  if (index % Math.max(1, Math.ceil(history.length / 5)) !== 0 && index !== history.length - 1) {
                    return null;
                  }

                  const point = downloadPoints[index];
                  return (
                    <SvgText key={item.date} x={point.x} y={height - 10} fontSize="10" fill={t.axisLabelSub} textAnchor="middle">
                      {formatHour(item.date)}
                    </SvgText>
                  );
                })}

                {tooltip ? (
                  <G>
                    <Line
                      x1={tooltip.x}
                      y1={top}
                      x2={tooltip.x}
                      y2={top + chartHeight}
                      stroke={t.axisLine}
                      strokeWidth="1"
                      strokeDasharray="4,3"
                    />
                    <Line x1={left} y1={tooltip.downloadY} x2={tooltip.x} y2={tooltip.downloadY} stroke={t.accent} strokeWidth="1" strokeDasharray="3,3" opacity={0.45} />
                    <Line x1={left} y1={tooltip.uploadY} x2={tooltip.x} y2={tooltip.uploadY} stroke={uploadColor} strokeWidth="1" strokeDasharray="3,3" opacity={0.45} />
                    <Rect
                      x={tooltip.tooltipX}
                      y={tooltip.tooltipY}
                      width={tooltip.tooltipWidth}
                      height={tooltip.tooltipHeight}
                      rx={8}
                      ry={8}
                      fill={t.surfaceElevated}
                      stroke={t.glassBorderStrong || t.axisLine}
                      strokeWidth="1"
                    />
                    <SvgText x={tooltip.tooltipX + 10} y={tooltip.tooltipY + 16} fontSize="10" fontWeight="700" fill={t.textMuted}>
                      {tooltip.date}
                    </SvgText>
                    <Circle cx={tooltip.tooltipX + 14} cy={tooltip.tooltipY + 34} r={3.5} fill={t.accent} />
                    <SvgText x={tooltip.tooltipX + 24} y={tooltip.tooltipY + 38} fontSize="11" fontWeight="700" fill={t.textSecondary}>
                      Down
                    </SvgText>
                    <SvgText x={tooltip.tooltipX + tooltip.tooltipWidth - 10} y={tooltip.tooltipY + 38} fontSize="12" fontWeight="900" fill={t.textPrimary} textAnchor="end">
                      {tooltip.download.toFixed(1)}
                    </SvgText>
                    <Circle cx={tooltip.tooltipX + 14} cy={tooltip.tooltipY + 52} r={3.5} fill={uploadColor} />
                    <SvgText x={tooltip.tooltipX + 24} y={tooltip.tooltipY + 56} fontSize="11" fontWeight="700" fill={t.textSecondary}>
                      Up
                    </SvgText>
                    <SvgText x={tooltip.tooltipX + tooltip.tooltipWidth - 10} y={tooltip.tooltipY + 56} fontSize="12" fontWeight="900" fill={t.textPrimary} textAnchor="end">
                      {tooltip.upload.toFixed(1)}
                    </SvgText>
                    <SvgText x={tooltip.tooltipX + 10} y={tooltip.tooltipY + 74} fontSize="10" fontWeight="700" fill={t.textMuted}>
                      Ping {formatPing(tooltip.ping || 0)}
                    </SvgText>
                  </G>
                ) : null}
              </Svg>

              {history.map((_, index) => {
                const x = xForIndex(index);
                const minY = Math.min(downloadPoints[index].y, uploadPoints[index].y);
                const maxY = Math.max(downloadPoints[index].y, uploadPoints[index].y);
                const hitHeight = Math.max(HIT_SIZE, maxY - minY + HIT_SIZE);
                return (
                  <TouchableOpacity
                    key={`hit-${index}`}
                    onPress={() => handlePointPress(index)}
                    activeOpacity={0.7}
                    style={[
                      styles.hitTarget,
                      {
                        left: x - HIT_SIZE / 2,
                        top: ((minY + maxY) / 2) - hitHeight / 2,
                        height: hitHeight,
                      },
                    ]}
                  />
                );
              })}
            </View>
          </ScrollView>
        </>
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
    gap: 12,
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
  metricRow: {
    flexDirection: 'row',
    gap: 14,
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
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 6,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  legendText: {
    fontSize: 11,
    fontWeight: '700',
  },
  unitLabel: {
    marginLeft: 'auto',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  hitTarget: {
    position: 'absolute',
    width: HIT_SIZE,
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

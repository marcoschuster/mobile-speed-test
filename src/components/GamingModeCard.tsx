import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import LiquidGlass from './LiquidGlass';
import { useTheme, withAlpha } from '../utils/theme';

type GamingResult = {
  grade: string;
  games: string;
  summary: string;
  avgLatency: number;
  jitter: number;
  packetLoss: number;
  maxLatencySpike: number;
};

const getGradeColor = (grade: string, t: any) => {
  if (grade === 'S' || grade === 'A+') return t.success;
  if (grade === 'A' || grade === 'B') return t.accent;
  if (grade === 'C' || grade === 'D') return '#FF9830';
  return t.danger;
};

const GamingModeCard = ({ result }: { result: GamingResult | null }) => {
  const { t } = useTheme();

  if (!result) return null;

  const accentColor = getGradeColor(result.grade, t);

  return (
    <LiquidGlass style={styles.card} contentStyle={styles.content}>
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: t.textMuted }]}>Gaming Readiness</Text>
        <View style={[styles.gradePill, { backgroundColor: withAlpha(accentColor, 0.16), borderColor: withAlpha(accentColor, 0.34) }]}>
          <Text style={[styles.gradeText, { color: accentColor }]}>{result.grade}</Text>
        </View>
      </View>
      <Text style={[styles.games, { color: t.textPrimary }]}>{result.games}</Text>
      <Text style={[styles.summary, { color: t.textSecondary }]}>{result.summary}</Text>
      <View style={styles.metricsRow}>
        <View style={styles.metric}>
          <Text style={[styles.metricLabel, { color: t.textMuted }]}>Avg</Text>
          <Text style={[styles.metricValue, { color: t.textPrimary }]}>{result.avgLatency.toFixed(1)}ms</Text>
        </View>
        <View style={styles.metric}>
          <Text style={[styles.metricLabel, { color: t.textMuted }]}>Jitter</Text>
          <Text style={[styles.metricValue, { color: t.textPrimary }]}>{result.jitter.toFixed(1)}ms</Text>
        </View>
        <View style={styles.metric}>
          <Text style={[styles.metricLabel, { color: t.textMuted }]}>Loss</Text>
          <Text style={[styles.metricValue, { color: t.textPrimary }]}>{result.packetLoss.toFixed(2)}%</Text>
        </View>
        <View style={styles.metric}>
          <Text style={[styles.metricLabel, { color: t.textMuted }]}>Spike</Text>
          <Text style={[styles.metricValue, { color: t.textPrimary }]}>{result.maxLatencySpike.toFixed(1)}ms</Text>
        </View>
      </View>
    </LiquidGlass>
  );
};

const styles = StyleSheet.create({
  card: {
    width: '100%',
  },
  content: {
    padding: 18,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },
  title: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  gradePill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  gradeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  games: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 6,
  },
  summary: {
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 14,
  },
  metricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metric: {
    minWidth: '22%',
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 15,
    fontWeight: '800',
  },
});

export default GamingModeCard;

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import LiquidGlass from './LiquidGlass';
import { useTheme, withAlpha } from '../utils/theme';

type VideoService = {
  name: string;
  tier: string;
  supported: boolean;
  emphasis?: boolean;
  color: string;
  textColor: string;
};

type ProbeMetrics = {
  timeToFirstFrameMs: number | null;
  rebufferCount: number;
};

export type VideoStreamingAssessment = {
  grade?: string;
  quality: string;
  playbackQuality?: string;
  bandwidthQualityCap?: string;
  canStream4K: boolean;
  canStreamHd?: boolean;
  canStreamSd?: boolean;
  canStreamNetflix4KHDR: boolean;
  services: VideoService[];
  summary: string;
  measuredDownloadMbps: number;
  sustainableProfile?: ProbeMetrics | null;
  compatibilityLimited?: boolean;
  completedInMs?: number;
};

const formatTtf = (value: number | null | undefined) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 'n/a';
  }

  return `${(value / 1000).toFixed(1)}s`;
};

const getGradeColor = (grade: string | undefined, t: any) => {
  if (grade === 'S' || grade === 'A+') return t.success;
  if (grade === 'A' || grade === 'B') return t.accent;
  if (grade === 'C' || grade === 'D') return '#FF9830';
  return t.danger;
};

const VideoQualityCard = ({ result }: { result: VideoStreamingAssessment | null }) => {
  const { t } = useTheme();

  if (!result) {
    return null;
  }

  const headline = result.canStream4K
    ? '4K streaming looks supported'
    : result.canStreamHd
      ? 'HD streaming looks supported'
      : result.canStreamSd
        ? 'SD streaming looks supported'
        : 'Streaming is not stable on this result';
  const accentColor = result.grade
    ? getGradeColor(result.grade, t)
    : result.canStream4K || result.canStreamHd
      ? t.success
      : result.canStreamSd
        ? t.accent
        : t.danger;

  return (
    <LiquidGlass style={styles.card} contentStyle={styles.content}>
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: t.textMuted }]}>Video Streaming</Text>
        <View
          style={[
            styles.qualityPill,
            {
              backgroundColor: withAlpha(accentColor, 0.16),
              borderColor: withAlpha(accentColor, 0.34),
            },
          ]}
        >
          <Text style={[styles.qualityPillText, { color: accentColor }]}>{result.grade || result.quality}</Text>
        </View>
      </View>

      <Text style={[styles.headline, { color: t.textPrimary }]}>{headline}</Text>
      {result.grade ? (
        <Text style={[styles.gradeDetail, { color: t.textMuted }]}>
          Grade {result.grade} • Max stable profile: {result.quality}
        </Text>
      ) : null}
      <Text style={[styles.summary, { color: t.textSecondary }]}>{result.summary}</Text>

      {result.playbackQuality && result.bandwidthQualityCap && result.playbackQuality !== result.quality ? (
        <Text style={[styles.limitNote, { color: t.textMuted }]}>
          Playback probe reached {result.playbackQuality}; bandwidth capped the final rating at {result.quality}.
        </Text>
      ) : null}

      <View style={styles.metricsRow}>
        <View style={styles.metric}>
          <Text style={[styles.metricLabel, { color: t.textMuted }]}>TTF</Text>
          <Text style={[styles.metricValue, { color: t.textPrimary }]}>
            {formatTtf(result.sustainableProfile?.timeToFirstFrameMs)}
          </Text>
        </View>
        <View style={styles.metric}>
          <Text style={[styles.metricLabel, { color: t.textMuted }]}>Rebuffers</Text>
          <Text style={[styles.metricValue, { color: t.textPrimary }]}>
            {result.sustainableProfile?.rebufferCount ?? 'n/a'}
          </Text>
        </View>
        <View style={styles.metric}>
          <Text style={[styles.metricLabel, { color: t.textMuted }]}>Bandwidth</Text>
          <Text style={[styles.metricValue, { color: t.textPrimary }]}>
            {result.measuredDownloadMbps.toFixed(1)} Mbps
          </Text>
        </View>
      </View>

      <View style={styles.logoRow}>
        {result.services.map((service) => (
          <View
            key={service.name}
            style={[
              styles.logoBadge,
              {
                backgroundColor: service.supported
                  ? service.color
                  : withAlpha(t.textMuted, 0.12),
                borderColor: service.supported
                  ? withAlpha(service.color, 0.86)
                  : withAlpha(t.textMuted, 0.2),
                opacity: service.supported ? 1 : 0.62,
              },
            ]}
          >
            <Text
              style={[
                styles.logoName,
                { color: service.supported ? service.textColor : t.textSecondary },
              ]}
            >
              {service.name}
            </Text>
            <Text
              style={[
                styles.logoTier,
                { color: service.supported ? service.textColor : t.textMuted },
              ]}
            >
              {service.tier}
            </Text>
          </View>
        ))}
      </View>

      {result.compatibilityLimited ? (
        <Text style={[styles.footnote, { color: t.textMuted }]}>
          High-tier fallback used measured bandwidth because the top probe format was decoder-limited on this device.
        </Text>
      ) : null}
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
  qualityPill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  qualityPillText: {
    fontSize: 12,
    fontWeight: '800',
  },
  headline: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 6,
  },
  summary: {
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 10,
  },
  gradeDetail: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '700',
    marginTop: -2,
    marginBottom: 8,
  },
  limitNote: {
    fontSize: 11,
    lineHeight: 17,
    marginBottom: 14,
  },
  metricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 14,
  },
  metric: {
    minWidth: '28%',
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
  logoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  logoBadge: {
    minWidth: '46%',
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 2,
  },
  logoName: {
    fontSize: 13,
    fontWeight: '800',
  },
  logoTier: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  footnote: {
    marginTop: 12,
    fontSize: 11,
    lineHeight: 17,
  },
});

export default VideoQualityCard;

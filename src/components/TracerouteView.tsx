import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import LiquidGlass from './LiquidGlass';
import { useTheme, withAlpha } from '../utils/theme';

type Hop = {
  hop: number;
  ip: string;
  rtt: number | null;
  timeout?: boolean;
};

type Props = {
  targetHost: string | null;
  hops: Hop[];
  loading: boolean;
  error: string | null;
  warning?: { hop: number; message: string } | null;
  cached?: boolean;
};

const TracerouteView = ({ targetHost, hops, loading, error, warning, cached = false }: Props) => {
  const { t } = useTheme();
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    if (loading || hops.length) {
      setExpanded(true);
    }
  }, [loading, hops.length, targetHost]);

  const visible = loading || Boolean(error) || hops.length > 0;
  const title = useMemo(() => (
    targetHost ? `Route to ${targetHost}` : 'Route diagnosis'
  ), [targetHost]);

  if (!visible) {
    return null;
  }

  return (
    <LiquidGlass style={styles.card} contentStyle={styles.content}>
      <Pressable onPress={() => setExpanded((value) => !value)} style={styles.header}>
        <View style={styles.headerTextWrap}>
          <Text style={[styles.title, { color: t.textPrimary }]}>{title}</Text>
          <Text style={[styles.subtitle, { color: t.textSecondary }]}>
            {loading
              ? 'Tracing route...'
              : cached
                ? 'Cached result from the last 10 minutes'
                : `${hops.length} hops captured`}
          </Text>
        </View>
        <Text style={[styles.chevron, { color: t.textMuted }]}>{expanded ? '−' : '+'}</Text>
      </Pressable>

      {expanded ? (
        <View style={styles.body}>
          {warning ? (
            <View style={[styles.warningPill, { backgroundColor: withAlpha(t.warning, 0.16), borderColor: withAlpha(t.warning, 0.34) }]}>
              <Text style={[styles.warningText, { color: t.warning }]}>{warning.message}</Text>
            </View>
          ) : null}

          {error ? (
            <Text style={[styles.errorText, { color: t.textSecondary }]}>{error}</Text>
          ) : null}

          {hops.map((hop) => {
            const highlighted = warning?.hop === hop.hop;
            return (
              <View
                key={`${hop.hop}-${hop.ip}-${hop.rtt ?? 'timeout'}`}
                style={[
                  styles.hopRow,
                  { borderBottomColor: t.separator },
                  highlighted && { backgroundColor: withAlpha(t.warning, 0.08) },
                ]}
              >
                <Text style={[styles.hopNumber, { color: t.textMuted }]}>{hop.hop}</Text>
                <Text style={[styles.hopIp, { color: highlighted ? t.textPrimary : t.textSecondary }]} numberOfLines={1}>
                  {hop.ip || '*'}
                </Text>
                <Text style={[styles.hopLatency, { color: highlighted ? t.warning : t.textPrimary }]}>
                  {typeof hop.rtt === 'number' ? `${hop.rtt.toFixed(1)} ms` : 'Timeout'}
                </Text>
              </View>
            );
          })}
        </View>
      ) : null}
    </LiquidGlass>
  );
};

const styles = StyleSheet.create({
  card: {
    marginTop: 16,
  },
  content: {
    padding: 18,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTextWrap: {
    flex: 1,
    paddingRight: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 4,
  },
  chevron: {
    fontSize: 24,
    fontWeight: '400',
    lineHeight: 24,
  },
  body: {
    marginTop: 14,
  },
  warningPill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  warningText: {
    fontSize: 12,
    fontWeight: '700',
  },
  errorText: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 10,
  },
  hopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  hopNumber: {
    width: 24,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  hopIp: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  hopLatency: {
    fontSize: 12,
    fontWeight: '700',
  },
});

export default TracerouteView;

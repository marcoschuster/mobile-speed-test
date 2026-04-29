import React, { useMemo } from 'react';
import { Platform, StyleSheet, Text } from 'react-native';
import LiquidGlass from './LiquidGlass';
import { useTheme } from '../utils/theme';

type Props = {
  networkType?: string | null;
  carrierName?: string | null;
  rsrp?: number | null;
  rsrq?: number | null;
  band?: string | null;
  earfcn?: number | null;
  cellId?: string | null;
};

const getSignalQuality = (rsrp?: number | null) => {
  if (typeof rsrp !== 'number') return 'Unknown';
  if (rsrp > -80) return 'Excellent';
  if (rsrp >= -90) return 'Good';
  if (rsrp >= -100) return 'Fair';
  return 'Poor';
};

const CellularInfoCard = ({ networkType, carrierName, rsrp, rsrq, band, earfcn, cellId }: Props) => {
  const { t } = useTheme();
  const quality = useMemo(() => getSignalQuality(rsrp), [rsrp]);

  if (Platform.OS !== 'android' || !networkType) {
    return null;
  }

  const headline = [
    networkType,
    band ? `Band ${band}` : null,
    typeof rsrp === 'number' ? `Signal: ${rsrp}dBm ${quality}` : null,
  ].filter(Boolean).join(' | ');

  const detailLine = [
    carrierName || null,
    typeof rsrq === 'number' ? `RSRQ ${rsrq}dB` : null,
    typeof earfcn === 'number' ? `EARFCN ${earfcn}` : null,
    cellId ? `Cell ${cellId}` : null,
  ].filter(Boolean).join(' • ');

  return (
    <LiquidGlass style={styles.card} contentStyle={styles.content}>
      <Text style={[styles.title, { color: t.textMuted }]}>Cellular Radio</Text>
      <Text style={[styles.value, { color: t.textPrimary }]}>{headline}</Text>
      <Text style={[styles.subtitle, { color: t.textSecondary }]}>
        {detailLine || 'Serving-cell details unavailable on this device.'}
      </Text>
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
  title: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  value: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 20,
  },
});

export default CellularInfoCard;

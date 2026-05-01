import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import LiquidGlass from '../components/LiquidGlass';
import {
  groupNetworksByBand,
  isLocationEnabled,
  isWiFiScannerAvailable,
  scanWiFiNetworks,
  type WiFiBand,
  type WiFiNetwork,
} from '../services/WiFiScannerService';
import { RADIUS, useTheme, withAlpha } from '../utils/theme';

type ChannelStats = {
  channel: number;
  count: number;
  strongestRssi: number;
  hasCurrent: boolean;
  networks: WiFiNetwork[];
};

type WiFiAnalyzerScreenProps = {
  onBack?: () => void;
};

const BAND_ORDER: WiFiBand[] = ['2.4GHz', '5GHz', '6GHz'];

const getChannelStats = (networks: WiFiNetwork[]) => {
  const byChannel = new Map<number, ChannelStats>();

  networks.forEach((network) => {
    const existing = byChannel.get(network.channel) || {
      channel: network.channel,
      count: 0,
      strongestRssi: -100,
      hasCurrent: false,
      networks: [],
    };

    existing.count += 1;
    existing.strongestRssi = Math.max(existing.strongestRssi, network.rssi);
    existing.hasCurrent = existing.hasCurrent || network.isCurrent;
    existing.networks.push(network);
    byChannel.set(network.channel, existing);
  });

  return [...byChannel.values()].sort((left, right) => left.channel - right.channel);
};

const getCongestionLabel = (count: number) => {
  if (count >= 7) return 'Heavy';
  if (count >= 4) return 'Busy';
  if (count >= 2) return 'Moderate';
  return 'Clear';
};

const getRecommendedChannel = (stats: ChannelStats[], band: WiFiBand) => {
  if (!stats.length) return null;

  const current = stats.find((channel) => channel.hasCurrent);
  const candidates = band === '2.4GHz'
    ? [1, 6, 11]
    : stats.map((channel) => channel.channel);

  const scored = candidates.map((channel) => {
    const exact = stats.find((item) => item.channel === channel);
    if (band !== '2.4GHz') {
      return { channel, score: exact?.count ?? 0 };
    }

    const overlapScore = stats.reduce((sum, item) => (
      sum + Math.max(0, 5 - Math.abs(item.channel - channel)) * item.count
    ), 0);
    return { channel, score: overlapScore };
  }).sort((left, right) => left.score - right.score || left.channel - right.channel);

  if (!current) {
    return `Best ${band} channel: ${scored[0]?.channel ?? 'n/a'}`;
  }

  const alternatives = scored
    .filter((item) => item.channel !== current.channel)
    .slice(0, 2)
    .map((item) => item.channel);

  if (current.count >= 4 && alternatives.length) {
    return `Channel ${current.channel} is congested. Try Channel ${alternatives.join(' or ')}`;
  }

  if (alternatives.length && scored[0]?.channel !== current.channel) {
    return `Channel ${current.channel} has ${current.count} network${current.count === 1 ? '' : 's'}. Best alternative: Channel ${scored[0].channel}`;
  }

  return `Channel ${current.channel} looks ${getCongestionLabel(current.count).toLowerCase()}`;
};

const WiFiAnalyzerScreen = ({ onBack }: WiFiAnalyzerScreenProps) => {
  const { t } = useTheme();
  const [networks, setNetworks] = useState<WiFiNetwork[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const grouped = useMemo(() => groupNetworksByBand(networks), [networks]);

  const scan = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const locationEnabled = await isLocationEnabled();
      if (!locationEnabled) {
        setError('Location services (GPS) are disabled. Android requires Location to be ON for WiFi scanning to return results.');
        // Still try to scan, maybe it works on some devices
      }

      const result = await scanWiFiNetworks();
      setNetworks(result.networks);
      
      if (result.networks.length === 0) {
        if (!locationEnabled) {
          setError('No WiFi networks found. WiFi scanning is blocked because Location services are disabled.');
        } else {
          setError('No WiFi networks found. Make sure WiFi is enabled and the app has permissions.');
        }
      }
    } catch (scanError: any) {
      setError(scanError?.message || 'Could not scan WiFi networks.');
      setNetworks([]);
    } finally {
      setLoading(false);
    }
  }, []);


  const currentNetwork = networks.find((network) => network.isCurrent);

  useEffect(() => {
    if (Platform.OS === 'android' && isWiFiScannerAvailable()) {
      void scan();
    }
  }, [scan]);

  if (Platform.OS === 'ios') {
    return (
      <View style={[styles.container, { backgroundColor: t.bg }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Text style={[styles.backText, { color: t.accent }]}>Back</Text>
          </TouchableOpacity>
          <Text style={[styles.title, { color: t.textPrimary }]}>WiFi Diagnostics</Text>
        </View>
        <LiquidGlass style={styles.emptyCard} borderRadius={RADIUS.lg} contentStyle={styles.emptyContent}>
          <Text style={[styles.emptyTitle, { color: t.textPrimary }]}>Not available on iOS</Text>
          <Text style={[styles.emptyText, { color: t.textMuted }]}>
            iOS does not expose nearby WiFi scan results to apps.
          </Text>
        </LiquidGlass>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: t.bg }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={[styles.backText, { color: t.accent }]}>Back</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: t.textPrimary }]}>WiFi Diagnostics</Text>
        <TouchableOpacity onPress={scan} style={[styles.scanButton, { borderColor: t.accent }]} disabled={loading}>
          <Text style={[styles.scanText, { color: t.accent }]}>{loading ? 'Scanning' : 'Scan'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {!isWiFiScannerAvailable() ? (
          <LiquidGlass style={styles.emptyCard} borderRadius={RADIUS.lg} contentStyle={styles.emptyContent}>
            <Text style={[styles.emptyTitle, { color: t.textPrimary }]}>Rebuild required</Text>
            <Text style={[styles.emptyText, { color: t.textMuted }]}>
              The WiFi scanner native module is not in this Android build yet.
            </Text>
          </LiquidGlass>
        ) : null}

        <LiquidGlass style={styles.summaryCard} borderRadius={RADIUS.lg} contentStyle={styles.summaryContent}>
          <View>
            <Text style={[styles.summaryLabel, { color: t.textMuted }]}>Networks found</Text>
            <Text style={[styles.summaryValue, { color: t.textPrimary }]}>{networks.length}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryRight}>
            <Text style={[styles.summaryLabel, { color: t.textMuted }]}>Current</Text>
            <Text style={[styles.currentText, { color: currentNetwork ? t.accent : t.textSecondary }]}>
              {currentNetwork?.ssid || 'Unknown'}
            </Text>
          </View>
        </LiquidGlass>

        {error ? (
          <Text style={[styles.errorText, { color: t.textMuted }]}>{error}</Text>
        ) : null}

        {loading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={t.accent} />
            <Text style={[styles.loadingText, { color: t.textMuted }]}>Scanning nearby WiFi...</Text>
          </View>
        ) : null}

        {BAND_ORDER.map((band) => {
          const bandNetworks = grouped[band];
          const stats = getChannelStats(bandNetworks);
          const maxCount = Math.max(1, ...stats.map((channel) => channel.count));
          const recommendation = getRecommendedChannel(stats, band);

          return (
            <LiquidGlass key={band} style={styles.bandCard} borderRadius={RADIUS.lg} contentStyle={styles.bandContent}>
              <View style={styles.bandHeader}>
                <Text style={[styles.bandTitle, { color: t.textPrimary }]}>{band}</Text>
                <Text style={[styles.bandCount, { color: t.textMuted }]}>{bandNetworks.length} network{bandNetworks.length === 1 ? '' : 's'}</Text>
              </View>

              {stats.length ? (
                <View style={styles.chart}>
                  {stats.map((channel) => {
                    const barHeight = 24 + (channel.count / maxCount) * 112;
                    return (
                      <View key={`${band}-${channel.channel}`} style={styles.channelColumn}>
                        <View style={styles.barTrack}>
                          <View
                            style={[
                              styles.bar,
                              {
                                height: barHeight,
                                backgroundColor: channel.hasCurrent ? t.accent : withAlpha(t.accent, 0.45),
                                borderColor: channel.hasCurrent ? t.textPrimary : 'transparent',
                              },
                            ]}
                          />
                        </View>
                        <Text style={[styles.channelLabel, { color: channel.hasCurrent ? t.accent : t.textSecondary }]}>
                          {channel.channel}
                        </Text>
                        <Text style={[styles.channelCount, { color: t.textMuted }]}>{channel.count}</Text>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <Text style={[styles.noBandText, { color: t.textMuted }]}>No {band} networks found.</Text>
              )}

              {recommendation ? (
                <View style={[styles.recommendationBox, { borderColor: t.glassBorderAccent, backgroundColor: t.accentTintCard }]}>
                  <Text style={[styles.recommendationText, { color: t.textPrimary }]}>{recommendation}</Text>
                </View>
              ) : null}

              {stats.map((channel) => (
                <View key={`${band}-${channel.channel}-details`} style={styles.channelDetail}>
                  <Text style={[styles.channelDetailTitle, { color: channel.hasCurrent ? t.accent : t.textPrimary }]}>
                    Channel {channel.channel} · {getCongestionLabel(channel.count)}
                  </Text>
                  <Text style={[styles.channelDetailMeta, { color: t.textMuted }]}>
                    {channel.networks
                      .slice()
                      .sort((left, right) => right.rssi - left.rssi)
                      .slice(0, 3)
                      .map((network) => `${network.isCurrent ? 'Current: ' : ''}${network.ssid} (${network.rssi} dBm)`)
                      .join(' · ')}
                  </Text>
                </View>
              ))}
            </LiquidGlass>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    minHeight: 76,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    minWidth: 54,
    paddingVertical: 8,
  },
  backText: {
    fontSize: 14,
    fontWeight: '900',
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: '900',
  },
  scanButton: {
    minWidth: 74,
    borderWidth: 1,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
  },
  scanText: {
    fontSize: 12,
    fontWeight: '900',
  },
  content: {
    padding: 16,
    paddingBottom: 36,
    gap: 14,
  },
  emptyCard: {
    borderRadius: RADIUS.lg,
  },
  emptyContent: {
    padding: 18,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '900',
  },
  emptyText: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
  summaryCard: {
    borderRadius: RADIUS.lg,
  },
  summaryContent: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  summaryValue: {
    marginTop: 3,
    fontSize: 28,
    fontWeight: '900',
  },
  summaryDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  summaryRight: {
    flex: 1,
  },
  currentText: {
    marginTop: 4,
    fontSize: 15,
    fontWeight: '900',
  },
  errorText: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: '700',
  },
  bandCard: {
    borderRadius: RADIUS.lg,
  },
  bandContent: {
    padding: 16,
  },
  bandHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  bandTitle: {
    fontSize: 17,
    fontWeight: '900',
  },
  bandCount: {
    fontSize: 12,
    fontWeight: '800',
  },
  chart: {
    minHeight: 174,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 9,
    paddingTop: 8,
    paddingBottom: 6,
  },
  channelColumn: {
    minWidth: 26,
    flex: 1,
    alignItems: 'center',
  },
  barTrack: {
    height: 140,
    width: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  bar: {
    width: '82%',
    borderRadius: 6,
    borderWidth: 1,
  },
  channelLabel: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: '900',
  },
  channelCount: {
    marginTop: 1,
    fontSize: 10,
    fontWeight: '700',
  },
  noBandText: {
    fontSize: 13,
    fontWeight: '700',
    paddingVertical: 16,
  },
  recommendationBox: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  recommendationText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '900',
  },
  channelDetail: {
    marginTop: 12,
  },
  channelDetailTitle: {
    fontSize: 12,
    fontWeight: '900',
  },
  channelDetailMeta: {
    marginTop: 3,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '600',
  },
});

export default WiFiAnalyzerScreen;

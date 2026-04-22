import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../utils/theme';
import LiquidGlass from './LiquidGlass';
import CDNPerformanceService from '../services/CDNPerformanceService';

interface CDNResult {
  cdn: string;
  latency: number | null;
  error?: boolean;
}

interface CDNGridProps {
  showInsight?: boolean;
}

const CDNGrid: React.FC<CDNGridProps> = ({ showInsight = true }) => {
  const { t } = useTheme();
  const [results, setResults] = useState<CDNResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [insight, setInsight] = useState<string | null>(null);

  useEffect(() => {
    const testCDNs = async () => {
      try {
        setLoading(true);
        const cdnResults = await CDNPerformanceService.testAllCDNs();
        setResults(cdnResults);
        setInsight(CDNPerformanceService.getInsight(cdnResults));
      } catch (e) {
        console.log('CDN test failed:', e.message);
      } finally {
        setLoading(false);
      }
    };

    testCDNs();
  }, []);

  const getLatencyColor = (latency: number | null) => {
    if (latency === null) return '#666';
    if (latency < 20) return '#00C48C'; // Green
    if (latency < 50) return '#FACC15'; // Yellow
    return '#F44336'; // Red
  };

  const CDNCard: React.FC<{ result: CDNResult }> = ({ result }) => {
    const color = getLatencyColor(result.latency);
    
    return (
      <LiquidGlass
        style={styles.cdnCard}
        contentStyle={styles.cdnCardContent}
      >
        <Text style={[styles.cdnName, { color: t.textPrimary }]}>{result.cdn}</Text>
        {result.error ? (
          <Text style={[styles.cdnLatency, { color: t.textMuted }]}>Failed</Text>
        ) : (
          <Text style={[styles.cdnLatency, { color }]}>
            {result.latency}ms
          </Text>
        )}
        <View
          style={[
            styles.indicator,
            { backgroundColor: `${color}22`, borderColor: color },
          ]}
        />
      </LiquidGlass>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: t.textMuted }]}>CDN Performance</Text>
      {loading ? (
        <Text style={[styles.loading, { color: t.textSecondary }]}>Testing...</Text>
      ) : (
        <View style={styles.grid}>
          {results.slice(0, 6).map((result, index) => (
            <CDNCard key={index} result={result} />
          ))}
        </View>
      )}
      {showInsight && insight && !loading && (
        <Text style={[styles.insight, { color: t.textSecondary }]}>
          {insight}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 24,
  },
  title: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  loading: {
    fontSize: 13,
    fontWeight: '500',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  cdnCard: {
    width: '50%',
    paddingHorizontal: 6,
    paddingBottom: 12,
  },
  cdnCardContent: {
    padding: 12,
    minHeight: 80,
    justifyContent: 'space-between',
  },
  cdnName: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  cdnLatency: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  indicator: {
    height: 3,
    borderRadius: 2,
    borderWidth: 1,
  },
  insight: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 8,
    fontStyle: 'italic',
  },
});

export default CDNGrid;

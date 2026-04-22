import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, Dimensions } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { useTheme } from '../utils/theme';
import LiquidGlass from './LiquidGlass';
import SpeedTestService from '../services/SpeedTestService';

interface ScalingResult {
  threads: number;
  mbps: number;
  error?: boolean;
}

interface ScalingCurveProps {
  onThrottlingDetected?: (result: any) => void;
}

const ScalingCurve: React.FC<ScalingCurveProps> = ({ onThrottlingDetected }) => {
  const { t } = useTheme();
  const [results, setResults] = useState<ScalingResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [throttlingResult, setThrottlingResult] = useState<any>(null);

  const runScalingTest = async () => {
    try {
      setLoading(true);
      setResults([]);
      setThrottlingResult(null);

      const scalingResults = await SpeedTestService.runScalingTest();
      setResults(scalingResults);

      const throttling = SpeedTestService.detectThrottling(scalingResults);
      setThrottlingResult(throttling);
      if (onThrottlingDetected && throttling) {
        onThrottlingDetected(throttling);
      }
    } catch (e) {
      console.log('Scaling test failed:', e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runScalingTest();
  }, []);

  const screenWidth = Dimensions.get('window').width;

  const chartData = {
    labels: results.map(r => r.threads.toString()),
    datasets: [
      {
        data: results.map(r => r.mbps),
        color: (opacity = 1) => t.textPrimary,
        strokeWidth: 2,
      },
    ],
  };

  const chartConfig = {
    backgroundColor: 'transparent',
    backgroundGradientFrom: 'transparent',
    backgroundGradientTo: 'transparent',
    decimalPlaces: 1,
    color: (opacity = 1) => t.textPrimary,
    labelColor: (opacity = 1) => t.textSecondary,
    style: {
      borderRadius: 16,
    },
    propsForDots: {
      r: '4',
      strokeWidth: '2',
      stroke: t.textPrimary,
    },
    propsForLabels: {
      fontSize: 10,
    },
  };

  return (
    <LiquidGlass style={styles.container} contentStyle={styles.content}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: t.textPrimary }]}>Connection Scaling</Text>
        <Text
          style={[styles.runButton, { color: t.textSecondary }]}
          onPress={runScalingTest}
        >
          {loading ? 'Testing...' : 'Re-run'}
        </Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: t.textSecondary }]}>
            Testing connection scaling...
          </Text>
        </View>
      ) : results.length > 0 ? (
        <>
          <View style={styles.chartContainer}>
            <LineChart
              data={chartData}
              width={screenWidth - 100}
              height={200}
              chartConfig={chartConfig}
              bezier
              style={styles.chart}
            />
          </View>

          {throttlingResult && (
            <View
              style={[
                styles.throttlingAlert,
                {
                  backgroundColor: throttlingResult.throttling
                    ? `${t.danger}22`
                    : `${t.success}22`,
                  borderColor: throttlingResult.throttling
                    ? t.danger
                    : t.success,
                },
              ]}
            >
              <Text
                style={[
                  styles.throttlingText,
                  {
                    color: throttlingResult.throttling
                      ? t.danger
                      : t.success,
                  },
                ]}
              >
                {throttlingResult.message}
              </Text>
            </View>
          )}

          <View style={styles.legend}>
            <Text style={[styles.legendText, { color: t.textSecondary }]}>
              Tests download speed with 1, 4, 8, and 16 parallel connections.
              If 16x is not significantly faster than 4x, ISP may be throttling per-connection.
            </Text>
          </View>
        </>
      ) : (
        <Text style={[styles.errorText, { color: t.textMuted }]}>
          No results available
        </Text>
      )}
    </LiquidGlass>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 24,
  },
  content: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
  },
  runButton: {
    fontSize: 12,
    fontWeight: '600',
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 13,
    fontWeight: '500',
  },
  chartContainer: {
    alignItems: 'center',
    marginVertical: 16,
  },
  chart: {
    borderRadius: 16,
  },
  throttlingAlert: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
  },
  throttlingText: {
    fontSize: 11,
    fontWeight: '600',
  },
  legend: {
    marginTop: 8,
  },
  legendText: {
    fontSize: 10,
    fontWeight: '500',
    lineHeight: 14,
  },
  errorText: {
    fontSize: 12,
    fontWeight: '500',
    paddingVertical: 20,
  },
});

export default ScalingCurve;

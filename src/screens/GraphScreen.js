import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import Svg, { Line, Polyline, Circle, Text as SvgText, G } from 'react-native-svg';
import SpeedTestService from '../services/SpeedTestService';

const screenWidth = Dimensions.get('window').width;

const TIME_FILTERS = [
  { key: 'day', label: '1 Day' },
  { key: 'week', label: '1 Week' },
  { key: 'month', label: '1 Month' },
];

const GraphScreen = () => {
  const [allHistory, setAllHistory] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [timeFilter, setTimeFilter] = useState('month');

  useEffect(() => {
    loadSpeedHistory();
  }, []);

  const loadSpeedHistory = async () => {
    const history = await SpeedTestService.getHistory();
    setAllHistory(history);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadSpeedHistory();
    setRefreshing(false);
  };

  const getFilteredData = useCallback(() => {
    if (allHistory.length === 0) return [];

    const now = new Date();
    let cutoff;

    switch (timeFilter) {
      case 'day':
        cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'week':
        cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
      default:
        cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
    }

    const filtered = allHistory.filter((item) => new Date(item.date) >= cutoff);
    // Reverse so oldest is first (left side of chart)
    return [...filtered].reverse();
  }, [allHistory, timeFilter]);

  const formatXLabel = (dateString) => {
    const date = new Date(dateString);
    const hours = date.getHours().toString().padStart(2, '0');
    const mins = date.getMinutes().toString().padStart(2, '0');

    if (timeFilter === 'day') {
      return `${hours}:${mins}`;
    }

    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');

    if (timeFilter === 'week') {
      return `${month}/${day} ${hours}:${mins}`;
    }

    return `${month}/${day}`;
  };

  // Compute nice integer tick values for a given max
  const getNiceTicks = (maxVal, tickCount = 5) => {
    if (maxVal <= 0) maxVal = 10;
    const rawStep = maxVal / tickCount;
    const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const residual = rawStep / magnitude;

    let niceStep;
    if (residual <= 1.5) niceStep = 1 * magnitude;
    else if (residual <= 3) niceStep = 2 * magnitude;
    else if (residual <= 7) niceStep = 5 * magnitude;
    else niceStep = 10 * magnitude;

    // Ensure step is at least 1
    niceStep = Math.max(1, Math.round(niceStep));

    const niceMax = Math.ceil(maxVal / niceStep) * niceStep;
    const ticks = [];
    for (let v = 0; v <= niceMax; v += niceStep) {
      ticks.push(Math.round(v));
    }
    return { ticks, max: niceMax };
  };

  const renderCustomChart = ({ dataPoints, datasets, yAxisSuffix, title, legends }) => {
    if (dataPoints.length === 0) return null;

    // Chart dimensions
    const yLabelWidth = 55;
    const xLabelHeight = 50;
    const paddingTop = 16;
    const paddingRight = 16;
    const paddingBottom = 8;
    const chartAreaWidth = Math.max(screenWidth - 32 - yLabelWidth - paddingRight, dataPoints.length * 60);
    const chartHeight = 220;
    const totalWidth = yLabelWidth + chartAreaWidth + paddingRight;
    const totalHeight = paddingTop + chartHeight + xLabelHeight + paddingBottom;

    // Compute y-axis max across all datasets
    let globalMax = 0;
    datasets.forEach((ds) => {
      ds.values.forEach((v) => {
        if (v > globalMax) globalMax = v;
      });
    });

    const { ticks, max: yMax } = getNiceTicks(globalMax);

    // Mapping functions
    const xPos = (index) => {
      if (dataPoints.length === 1) return yLabelWidth + chartAreaWidth / 2;
      return yLabelWidth + (index / (dataPoints.length - 1)) * chartAreaWidth;
    };
    const yPos = (value) => {
      return paddingTop + chartHeight - (value / yMax) * chartHeight;
    };

    // Determine which x labels to show
    const maxXLabels = 6;
    const step = Math.max(1, Math.ceil(dataPoints.length / maxXLabels));

    return (
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>{title}</Text>
        <View style={styles.legendRow}>
          {legends.map((leg, i) => (
            <View key={i} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: leg.color }]} />
              <Text style={styles.legendText}>{leg.label}</Text>
            </View>
          ))}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={true}>
          <Svg width={totalWidth} height={totalHeight}>
            {/* Y-axis gridlines and labels */}
            {ticks.map((tick, i) => {
              const y = yPos(tick);
              return (
                <G key={`ytick-${i}`}>
                  <Line
                    x1={yLabelWidth}
                    y1={y}
                    x2={yLabelWidth + chartAreaWidth}
                    y2={y}
                    stroke="#e0e0e0"
                    strokeWidth="1"
                    strokeDasharray={tick === 0 ? '' : '4,3'}
                  />
                  <SvgText
                    x={yLabelWidth - 6}
                    y={y + 4}
                    fontSize="11"
                    fill="#666"
                    textAnchor="end"
                  >
                    {tick}{yAxisSuffix}
                  </SvgText>
                </G>
              );
            })}

            {/* Y axis line */}
            <Line
              x1={yLabelWidth}
              y1={paddingTop}
              x2={yLabelWidth}
              y2={paddingTop + chartHeight}
              stroke="#999"
              strokeWidth="1.5"
            />

            {/* X axis line */}
            <Line
              x1={yLabelWidth}
              y1={paddingTop + chartHeight}
              x2={yLabelWidth + chartAreaWidth}
              y2={paddingTop + chartHeight}
              stroke="#999"
              strokeWidth="1.5"
            />

            {/* X-axis labels */}
            {dataPoints.map((item, i) => {
              if (i % step !== 0 && i !== dataPoints.length - 1) return null;
              const x = xPos(i);
              const label = formatXLabel(item.date);
              const parts = label.split(' ');
              return (
                <G key={`xlabel-${i}`}>
                  {/* Tick mark */}
                  <Line
                    x1={x}
                    y1={paddingTop + chartHeight}
                    x2={x}
                    y2={paddingTop + chartHeight + 5}
                    stroke="#999"
                    strokeWidth="1"
                  />
                  <SvgText
                    x={x}
                    y={paddingTop + chartHeight + 18}
                    fontSize="10"
                    fill="#666"
                    textAnchor="middle"
                  >
                    {parts[0]}
                  </SvgText>
                  {parts[1] && (
                    <SvgText
                      x={x}
                      y={paddingTop + chartHeight + 31}
                      fontSize="10"
                      fill="#999"
                      textAnchor="middle"
                    >
                      {parts[1]}
                    </SvgText>
                  )}
                </G>
              );
            })}

            {/* Dataset lines and dots */}
            {datasets.map((ds, dsIndex) => {
              // Build polyline points string
              const points = ds.values
                .map((val, i) => `${xPos(i)},${yPos(val)}`)
                .join(' ');

              return (
                <G key={`ds-${dsIndex}`}>
                  <Polyline
                    points={points}
                    fill="none"
                    stroke={ds.color}
                    strokeWidth="2.5"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                  {ds.values.map((val, i) => (
                    <Circle
                      key={`dot-${dsIndex}-${i}`}
                      cx={xPos(i)}
                      cy={yPos(val)}
                      r="3.5"
                      fill={ds.color}
                      stroke="#fff"
                      strokeWidth="1.5"
                    />
                  ))}
                </G>
              );
            })}
          </Svg>
        </ScrollView>
      </View>
    );
  };

  const renderCharts = () => {
    const data = getFilteredData();

    if (allHistory.length === 0) {
      return (
        <View style={styles.noDataContainer}>
          <Text style={styles.noDataText}>No speed data available</Text>
          <Text style={styles.noDataSubtext}>Run speed tests to see graphs here</Text>
        </View>
      );
    }

    if (data.length === 0) {
      return (
        <View style={styles.noDataContainer}>
          <Text style={styles.noDataText}>No data for this time period</Text>
          <Text style={styles.noDataSubtext}>Try selecting a longer time range</Text>
        </View>
      );
    }

    return (
      <>
        {renderCustomChart({
          dataPoints: data,
          datasets: [
            {
              values: data.map((d) => d.download),
              color: '#f5c542',
              label: 'Download',
            },
            {
              values: data.map((d) => d.upload),
              color: '#4a90d9',
              label: 'Upload',
            },
          ],
          yAxisSuffix: '',
          title: 'Download & Upload Speed (Mbps)',
          legends: [
            { color: '#f5c542', label: 'Download (Mbps)' },
            { color: '#4a90d9', label: 'Upload (Mbps)' },
          ],
        })}

        {renderCustomChart({
          dataPoints: data,
          datasets: [
            {
              values: data.map((d) => d.ping),
              color: '#28a745',
              label: 'Ping',
            },
          ],
          yAxisSuffix: '',
          title: 'Ping / Latency (ms)',
          legends: [{ color: '#28a745', label: 'Ping (ms)' }],
        })}
      </>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Speed Graphs</Text>
      </View>

      {/* Time filter buttons */}
      <View style={styles.filterRow}>
        {TIME_FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[
              styles.filterButton,
              timeFilter === f.key && styles.filterButtonActive,
            ]}
            onPress={() => setTimeFilter(f.key)}
          >
            <Text
              style={[
                styles.filterButtonText,
                timeFilter === f.key && styles.filterButtonTextActive,
              ]}
            >
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {renderCharts()}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 10,
  },
  filterButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  filterButtonActive: {
    backgroundColor: '#667eea',
    borderColor: '#667eea',
  },
  filterButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
  filterButtonTextActive: {
    color: '#fff',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 30,
  },
  chartCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  chartTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 12,
    gap: 20,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 6,
  },
  legendText: {
    fontSize: 12,
    color: '#6c757d',
  },
  noDataContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 100,
  },
  noDataText: {
    fontSize: 16,
    color: '#6c757d',
    fontStyle: 'italic',
    textAlign: 'center',
    marginBottom: 8,
  },
  noDataSubtext: {
    fontSize: 14,
    color: '#adb5bd',
    textAlign: 'center',
  },
});

export default GraphScreen;

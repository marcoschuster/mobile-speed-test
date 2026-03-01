import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import SpeedTestService from '../services/SpeedTestService';

const GraphScreen = () => {
  const [speedHistory, setSpeedHistory] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadSpeedHistory();
  }, []);

  const loadSpeedHistory = async () => {
    // This would load from storage or service
    const history = await SpeedTestService.getHistory();
    setSpeedHistory(history);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadSpeedHistory();
    setRefreshing(false);
  };

  const renderSpeedGraph = () => {
    if (speedHistory.length === 0) {
      return (
        <View style={styles.noDataContainer}>
          <Text style={styles.noDataText}>No speed data available</Text>
          <Text style={styles.noDataSubtext}>Run speed tests to see graphs here</Text>
        </View>
      );
    }

    const latestTest = speedHistory[0];
    const maxSpeed = Math.max(latestTest.download, latestTest.upload, 100);

    return (
      <View style={styles.graphContainer}>
        <Text style={styles.graphTitle}>Latest Speed Test Results</Text>
        
        <View style={styles.speedBars}>
          <View style={styles.speedBarContainer}>
            <Text style={styles.speedLabel}>Download: {latestTest.download.toFixed(1)} Mbps</Text>
            <View style={styles.speedBarBackground}>
              <View 
                style={[
                  styles.speedBar, 
                  { 
                    width: `${(latestTest.download / maxSpeed) * 100}%`,
                    backgroundColor: '#667eea'
                  }
                ]} 
              />
            </View>
          </View>

          <View style={styles.speedBarContainer}>
            <Text style={styles.speedLabel}>Upload: {latestTest.upload.toFixed(1)} Mbps</Text>
            <View style={styles.speedBarBackground}>
              <View 
                style={[
                  styles.speedBar, 
                  { 
                    width: `${(latestTest.upload / maxSpeed) * 100}%`,
                    backgroundColor: '#764ba2'
                  }
                ]} 
              />
            </View>
          </View>

          <View style={styles.speedBarContainer}>
            <Text style={styles.speedLabel}>Ping: {latestTest.ping} ms</Text>
            <View style={styles.speedBarBackground}>
              <View 
                style={[
                  styles.speedBar, 
                  { 
                    width: `${Math.min((latestTest.ping / 200) * 100, 100)}%`,
                    backgroundColor: '#28a745'
                  }
                ]} 
              />
            </View>
          </View>
        </View>

        <View style={styles.historySection}>
          <Text style={styles.historyTitle}>Recent Tests</Text>
          <FlatList
            data={speedHistory.slice(0, 10)}
            renderItem={({ item }) => (
              <View style={styles.historyItem}>
                <Text style={styles.historyDate}>
                  {new Date(item.date).toLocaleDateString()} {new Date(item.date).toLocaleTimeString()}
                </Text>
                <View style={styles.historyStats}>
                  <Text style={styles.historyStat}>↓ {item.download.toFixed(1)} Mbps</Text>
                  <Text style={styles.historyStat}>↑ {item.upload.toFixed(1)} Mbps</Text>
                  <Text style={styles.historyStat}>Ping: {item.ping} ms</Text>
                </View>
              </View>
            )}
            keyExtractor={(item, index) => index.toString()}
            showsVerticalScrollIndicator={false}
          />
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Speed Graphs</Text>
        <TouchableOpacity style={styles.clearButton} onPress={() => {
          Alert.alert(
            'Clear History',
            'Clear all speed test history?',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Clear',
                style: 'destructive',
                onPress: async () => {
                  await SpeedTestService.clearHistory();
                  setSpeedHistory([]);
                }
              }
            ]
          );
        }}>
          <Text style={styles.clearButtonText}>Clear All</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {renderSpeedGraph()}
      </View>
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
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  clearButton: {
    backgroundColor: '#dc3545',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  clearButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  graphContainer: {
    flex: 1,
    padding: 20,
  },
  graphTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  speedBars: {
    marginBottom: 30,
  },
  speedBarContainer: {
    marginBottom: 15,
  },
  speedLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 5,
  },
  speedBarBackground: {
    height: 20,
    backgroundColor: '#e9ecef',
    borderRadius: 10,
    overflow: 'hidden',
  },
  speedBar: {
    height: '100%',
    borderRadius: 10,
  },
  historySection: {
    flex: 1,
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
  historyItem: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#667eea',
  },
  historyDate: {
    fontSize: 12,
    color: '#6c757d',
    marginBottom: 5,
  },
  historyStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  historyStat: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  noDataContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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

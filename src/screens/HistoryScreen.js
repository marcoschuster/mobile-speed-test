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

const HistoryScreen = () => {
  const [history, setHistory] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    const historyData = await SpeedTestService.getHistory();
    setHistory(historyData);
  };

  const clearHistory = () => {
    Alert.alert(
      'Clear History',
      'Are you sure you want to clear all test history?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            const clearedHistory = await SpeedTestService.clearHistory();
            setHistory(clearedHistory);
          },
        },
      ]
    );
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadHistory();
    setRefreshing(false);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderHistoryItem = ({ item }) => (
    <View style={styles.historyItem}>
      <Text style={styles.historyDate}>{formatDate(item.date)}</Text>
      <View style={styles.historyStats}>
        <View style={styles.historyStat}>
          <Text style={styles.historyStatLabel}>Download</Text>
          <Text style={styles.historyStatValue}>{item.download.toFixed(2)} Mbps</Text>
        </View>
        <View style={styles.historyStat}>
          <Text style={styles.historyStatLabel}>Upload</Text>
          <Text style={styles.historyStatValue}>{item.upload.toFixed(2)} Mbps</Text>
        </View>
        <View style={styles.historyStat}>
          <Text style={styles.historyStatLabel}>Ping</Text>
          <Text style={styles.historyStatValue}>{item.ping} ms</Text>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Test History</Text>
        {history.length > 0 && (
          <TouchableOpacity style={styles.clearButton} onPress={clearHistory}>
            <Text style={styles.clearButtonText}>Clear All</Text>
          </TouchableOpacity>
        )}
      </View>

      {history.length === 0 ? (
        <View style={styles.noHistoryContainer}>
          <Text style={styles.noHistoryText}>No test history available</Text>
          <Text style={styles.noHistorySubtext}>Run a speed test to see your results here</Text>
        </View>
      ) : (
        <FlatList
          data={history}
          renderItem={renderHistoryItem}
          keyExtractor={(item, index) => index.toString()}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
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
  listContainer: {
    padding: 20,
  },
  historyItem: {
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#667eea',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  historyDate: {
    fontSize: 12,
    color: '#6c757d',
    marginBottom: 8,
  },
  historyStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  historyStat: {
    flex: 1,
    alignItems: 'center',
  },
  historyStatLabel: {
    fontSize: 10,
    color: '#6c757d',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  historyStatValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  noHistoryContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  noHistoryText: {
    fontSize: 16,
    color: '#6c757d',
    fontStyle: 'italic',
    textAlign: 'center',
    marginBottom: 8,
  },
  noHistorySubtext: {
    fontSize: 14,
    color: '#adb5bd',
    textAlign: 'center',
  },
});

export default HistoryScreen;

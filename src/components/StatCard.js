import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const StatCard = ({ label, value, peak, unit = 'Mbps' }) => {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>
        {typeof value === 'number' ? value.toFixed(2) : value} {unit}
      </Text>
      <Text style={styles.statPeak}>
        {label === 'Ping' ? 'Best' : 'Peak'}: {typeof peak === 'number' ? peak.toFixed(2) : peak} {unit}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  statCard: {
    backgroundColor: '#f8f9fa',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 5,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    color: '#6c757d',
    fontWeight: '600',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  statPeak: {
    fontSize: 11,
    color: '#6c757d',
  },
});

export default StatCard;

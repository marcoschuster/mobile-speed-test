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
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 4,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  statLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    color: '#6c757d',
    fontWeight: '700',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  statPeak: {
    fontSize: 10,
    color: '#adb5bd',
  },
});

export default StatCard;

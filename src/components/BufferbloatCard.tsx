import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import LinearGradient from 'expo-linear-gradient';
import { useTheme } from '../utils/theme';
import LiquidGlass from './LiquidGlass';

interface NetworkHealthCardProps {
  bufferbloatGrade: string;
  bufferbloatExplanation: string;
  connectionQuality: {
    label: string;
    summary: string;
  };
}

const getGradeColor = (grade: string, theme: any) => {
  switch (grade) {
    case 'S':
      return '#FFD700'; // Gold
    case 'A+':
      return theme.success || '#00C48C';
    case 'A':
      return '#00C48C';
    case 'B':
      return '#4FC3F7';
    case 'C':
      return '#FACC15';
    case 'D':
      return '#FB8C00';
    case 'F':
      return theme.danger || '#F44336';
    default:
      return theme.textMuted || '#666';
  }
};

const NetworkHealthCard: React.FC<NetworkHealthCardProps> = ({
  bufferbloatGrade,
  bufferbloatExplanation,
  connectionQuality,
}) => {
  const { t } = useTheme();
  const gradeColor = getGradeColor(bufferbloatGrade, t);

  return (
    <LiquidGlass style={styles.card} contentStyle={styles.cardContent}>
      <View style={styles.headerRow}>
        <Text style={[styles.titleLabel, { color: t.textMuted }]}>Network Health</Text>
        <View style={[styles.gradeBadge, { backgroundColor: `${gradeColor}22`, borderColor: gradeColor }]}>
          <Text style={[styles.gradeText, { color: gradeColor }]}>{bufferbloatGrade}</Text>
        </View>
      </View>
      <Text style={[styles.qualityValue, { color: t.textPrimary }]}>{connectionQuality.label}</Text>
      <Text style={[styles.qualitySubtitle, { color: t.textSecondary }]}>{connectionQuality.summary}</Text>
      <Text style={[styles.explanation, { color: t.textPrimary }]}>Bufferbloat: {bufferbloatExplanation}</Text>
    </LiquidGlass>
  );
};

const styles = StyleSheet.create({
  card: {
    width: '100%',
  },
  cardContent: {
    padding: 18,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  titleLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  gradeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  gradeText: {
    fontSize: 22,
    fontWeight: '800',
  },
  qualityValue: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 4,
  },
  qualitySubtitle: {
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 12,
  },
  explanation: {
    fontSize: 11,
    fontWeight: '500',
    lineHeight: 16,
  },
});

export default NetworkHealthCard;

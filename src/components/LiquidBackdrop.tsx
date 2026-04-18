import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../utils/theme';

const LiquidBackdrop = () => {
  const { t } = useTheme();

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={[t.backdropStart || '#0a0e27', t.backdropMid || '#1a1f3a', t.backdropEnd || '#2d1b69']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={[t.backdropOrbPrimary || '#8B5CF6', 'transparent']}
        start={{ x: 0.2, y: 0.1 }}
        end={{ x: 0.8, y: 0.9 }}
        style={[styles.orb, styles.primaryOrb]}
      />
      <LinearGradient
        colors={[t.backdropOrbSecondary || '#06B6D4', 'transparent']}
        start={{ x: 0.1, y: 0.1 }}
        end={{ x: 0.9, y: 0.9 }}
        style={[styles.orb, styles.secondaryOrb]}
      />
      <LinearGradient
        colors={[t.backdropOrbNeutral || '#FFFFFF', 'transparent']}
        start={{ x: 0.2, y: 0.2 }}
        end={{ x: 0.8, y: 0.8 }}
        style={[styles.orb, styles.neutralOrb]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  orb: {
    position: 'absolute',
    borderRadius: 999,
  },
  primaryOrb: {
    width: 280,
    height: 280,
    top: -40,
    right: -90,
  },
  secondaryOrb: {
    width: 220,
    height: 220,
    top: '34%',
    left: -80,
  },
  neutralOrb: {
    width: 260,
    height: 260,
    bottom: -90,
    right: '12%',
  },
});

export default LiquidBackdrop;

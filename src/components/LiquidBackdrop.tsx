import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, Animated } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../utils/theme';

const LiquidBackdrop = () => {
  const { t } = useTheme();

  const primaryAnim = useRef(new Animated.Value(0)).current;
  const secondaryAnim = useRef(new Animated.Value(0)).current;
  const neutralAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const primaryLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(primaryAnim, { toValue: 1, duration: 4000, useNativeDriver: true }),
        Animated.timing(primaryAnim, { toValue: 0, duration: 4000, useNativeDriver: true }),
      ])
    );
    primaryLoop.start();

    const secondaryLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(secondaryAnim, { toValue: 1, duration: 5000, useNativeDriver: true }),
        Animated.timing(secondaryAnim, { toValue: 0, duration: 5000, useNativeDriver: true }),
      ])
    );
    secondaryLoop.start();

    const neutralLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(neutralAnim, { toValue: 1, duration: 4500, useNativeDriver: true }),
        Animated.timing(neutralAnim, { toValue: 0, duration: 4500, useNativeDriver: true }),
      ])
    );
    neutralLoop.start();

    return () => {
      primaryLoop.stop();
      secondaryLoop.stop();
      neutralLoop.stop();
    };
  }, []);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={[t.backdropStart || '#0a0e27', t.backdropMid || '#1a1f3a', t.backdropEnd || '#2d1b69']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Animated.View
        style={[
          styles.orb,
          styles.primaryOrb,
          {
            opacity: primaryAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.5] }),
            transform: [
              { scale: primaryAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.1] }) },
              { translateX: primaryAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 20] }) },
            ],
          },
        ]}
      >
        <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill}>
          <LinearGradient
            colors={[t.backdropOrbPrimary || '#8B5CF6', 'transparent']}
            start={{ x: 0.2, y: 0.1 }}
            end={{ x: 0.8, y: 0.9 }}
            style={StyleSheet.absoluteFill}
          />
        </BlurView>
      </Animated.View>
      <Animated.View
        style={[
          styles.orb,
          styles.secondaryOrb,
          {
            opacity: secondaryAnim.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.45] }),
            transform: [
              { scale: secondaryAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.15] }) },
              { translateY: secondaryAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -15] }) },
            ],
          },
        ]}
      >
        <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill}>
          <LinearGradient
            colors={[t.backdropOrbSecondary || '#06B6D4', 'transparent']}
            start={{ x: 0.1, y: 0.1 }}
            end={{ x: 0.9, y: 0.9 }}
            style={StyleSheet.absoluteFill}
          />
        </BlurView>
      </Animated.View>
      <Animated.View
        style={[
          styles.orb,
          styles.neutralOrb,
          {
            opacity: neutralAnim.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0.4] }),
            transform: [
              { scale: neutralAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) },
              { translateX: neutralAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -15] }) },
            ],
          },
        ]}
      >
        <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill}>
          <LinearGradient
            colors={[t.backdropOrbNeutral || '#FFFFFF', 'transparent']}
            start={{ x: 0.2, y: 0.2 }}
            end={{ x: 0.8, y: 0.8 }}
            style={StyleSheet.absoluteFill}
          />
        </BlurView>
      </Animated.View>
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

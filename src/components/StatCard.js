import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, Platform } from 'react-native';
import Svg, { Path, Circle as SvgCircle } from 'react-native-svg';
import { COLORS, RADIUS, useTheme } from '../utils/theme';

const CARD_WIDTH = (Dimensions.get('window').width - 56) / 3;

const DownloadIcon = ({ size = 14, color = COLORS.accent }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M12 4v12m0 0l-5-5m5 5l5-5M5 20h14" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </Svg>
);
const UploadIcon = ({ size = 14, color = COLORS.accent }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M12 20V8m0 0l-5 5m5-5l5 5M5 4h14" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </Svg>
);
const PingIcon = ({ size = 14, color = COLORS.success }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z" fill={color} />
  </Svg>
);

// ── Spinning yellow loader ──────────────────────────────────────────────────
const SpinningLoader = ({ size = 22, color = COLORS.accent }) => {
  const spinAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 900,
        useNativeDriver: false,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const rotate = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View style={{ transform: [{ rotate }], width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        {/* Track ring */}
        <SvgCircle cx="12" cy="12" r="10" fill="none" stroke={color} strokeWidth="2.5" opacity={0.2} />
        {/* Active arc — 270° gap spinner */}
        <Path
          d="M12 2 A10 10 0 1 1 2 12"
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </Svg>
    </Animated.View>
  );
};

// ── Mini speed line inside a card ───────────────────────────────────────────
const CardSpeedLine = ({ index, color }) => {
  const translateX = useRef(new Animated.Value(-CARD_WIDTH)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const delay = useRef(index * 250 + Math.random() * 200).current;
  const duration = useRef(800 + Math.random() * 400).current;
  const peak = useRef(0.12 + Math.random() * 0.1).current;

  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.timing(translateX, { toValue: CARD_WIDTH * 2, duration, useNativeDriver: false }),
        Animated.sequence([
          Animated.timing(opacity, { toValue: 0.3, duration: duration * 0.3, useNativeDriver: false }),
          Animated.timing(opacity, { toValue: 0, duration: duration * 0.7, useNativeDriver: false }),
        ]),
      ]),
      Animated.timing(translateX, { toValue: -CARD_WIDTH, duration: 0, useNativeDriver: false }),
    ]));
    loop.start();
    return () => loop.stop();
  }, []);

  const top = 10 + index * 22 + Math.random() * 8;

  return (
    <Animated.View style={{
      position: 'absolute', width: CARD_WIDTH * 0.8, height: 1.5,
      backgroundColor: color, left: 0, top, opacity,
      transform: [{ translateX }, { rotate: '-15deg' }],
    }} />
  );
};

const FONT_FAMILY = Platform.OS === 'ios' ? 'System' : 'sans-serif';

const StatCard = ({ label, value, unit = 'Mbps', activePhase }) => {
  const { t } = useTheme();
  const animatedValue = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const isDark = t.mode === 'dark';

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: false }).start();
  }, []);

  // Is this card's stat currently being tested?
  const isActive = (
    (label === 'Download' && activePhase === 'Download') ||
    (label === 'Upload' && activePhase === 'Upload') ||
    (label === 'Ping' && activePhase === 'Ping')
  );

  useEffect(() => {
    if (value > 0 && !isActive) {
      Animated.sequence([
        Animated.timing(animatedValue, { toValue: 1.08, duration: 150, useNativeDriver: false }),
        Animated.spring(animatedValue, { toValue: 1, tension: 200, friction: 10, useNativeDriver: false }),
      ]).start();
    }
  }, [value, isActive]);

  // Pulsing yellow glow when active
  useEffect(() => {
    if (isActive) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, { toValue: 1, duration: 1000, useNativeDriver: false }),
          Animated.timing(glowAnim, { toValue: 0, duration: 1000, useNativeDriver: false }),
        ]),
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      glowAnim.setValue(0);
    }
  }, [isActive]);

  const getIcon = () => {
    switch (label) {
      case 'Download': return <DownloadIcon />;
      case 'Upload':   return <UploadIcon color={t.uploadLine} />;
      case 'Ping':     return <PingIcon />;
      default:         return null;
    }
  };

  const accentColor = label === 'Ping' ? COLORS.success : (label === 'Upload' ? t.uploadLine : COLORS.accent);

  const uniformTint = isDark
    ? 'rgba(245, 196, 0, 0.04)'
    : 'rgba(245, 196, 0, 0.02)';

  // Animated shadow for the pulsing glow
  const glowShadowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.1, 0.5],
  });
  const glowShadowRadius = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [4, 18],
  });

  return (
    <Animated.View
      style={[
        styles.card,
        {
          backgroundColor: t.surface,
          marginHorizontal: 4,
          opacity: fadeAnim,
          transform: [{ translateY: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
          shadowColor: isActive ? COLORS.accent : (isDark ? '#000' : '#888'),
          shadowOpacity: isActive ? glowShadowOpacity : 0.18,
          shadowRadius: isActive ? glowShadowRadius : 10,
        },
      ]}
    >
        {/* Uniform gradient tint overlay */}
        <View style={[styles.gradientTint, { backgroundColor: uniformTint }]} />

        {/* Speed lines — only when actively being tested */}
        {isActive && (
          <View style={styles.speedLinesClip}>
            {[0, 1, 2].map(i => <CardSpeedLine key={i} index={i} color={accentColor} />)}
          </View>
        )}

        <View style={styles.cardContent}>
          <View style={styles.labelRow}>
            {getIcon()}
            <Text style={[styles.label, { color: t.textSecondary, fontFamily: FONT_FAMILY, textShadowColor: 'rgba(0, 0, 0, 0.2)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 1.5 }]}>{label}</Text>
          </View>

          {isActive ? (
            /* Loading state — spinning icon instead of value */
            <View style={styles.loaderWrap}>
              <SpinningLoader size={24} color={accentColor} />
            </View>
          ) : (
            /* Result state — show the value */
            <Animated.Text style={[styles.value, { color: t.textPrimary, fontFamily: FONT_FAMILY, transform: [{ scale: animatedValue }] }]}>
              {typeof value === 'number' ? value.toFixed(2) : value}
              <Text style={[styles.valueUnit, { color: t.textSecondary, textShadowColor: 'rgba(0, 0, 0, 0.2)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 1.5 }]}> {unit}</Text>
            </Animated.Text>
          )}
          <Text style={[styles.peak, { color: t.textMuted, textShadowColor: 'rgba(0, 0, 0, 0.2)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 1.5 }]}>
            {label === 'Ping' ? 'Best' : 'Peak'}
          </Text>
        </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  gradientTint: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: RADIUS.lg,
  },
  speedLinesClip: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    borderRadius: RADIUS.lg,
  },
  cardContent: {
    padding: 12,
    alignItems: 'center',
  },
  labelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 4 },
  label: { fontSize: 10, textTransform: 'uppercase', fontWeight: '700', letterSpacing: 1.2 },
  value: { fontSize: 18, fontWeight: '900', letterSpacing: -0.5 },
  valueUnit: { fontSize: 11, fontWeight: '600' },
  loaderWrap: { height: 28, justifyContent: 'center', alignItems: 'center' },
});

export default StatCard;

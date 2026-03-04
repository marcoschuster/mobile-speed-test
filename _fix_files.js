const fs = require('fs');
const path = require('path');

const files = {};

// ── StatCard.js ─────────────────────────────────────────────────────────────
files['src/components/StatCard.js'] = `import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import Svg, { Path } from 'react-native-svg';
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
        Animated.timing(translateX, { toValue: CARD_WIDTH * 2, duration: duration, useNativeDriver: true }),
        Animated.sequence([
          Animated.timing(opacity, { toValue: peak, duration: duration * 0.3, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: duration * 0.7, useNativeDriver: true }),
        ]),
      ]),
      Animated.timing(translateX, { toValue: -CARD_WIDTH, duration: 0, useNativeDriver: true }),
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

const StatCard = ({ label, value, peak, unit = 'Mbps', activePhase }) => {
  const { t } = useTheme();
  const animatedValue = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, []);

  useEffect(() => {
    if (value > 0) {
      Animated.sequence([
        Animated.timing(animatedValue, { toValue: 1.08, duration: 150, useNativeDriver: true }),
        Animated.spring(animatedValue, { toValue: 1, tension: 200, friction: 10, useNativeDriver: true }),
      ]).start();
    }
  }, [value]);

  const getIcon = () => {
    switch (label) {
      case 'Download': return <DownloadIcon />;
      case 'Upload': return <UploadIcon />;
      case 'Ping': return <PingIcon />;
      default: return null;
    }
  };

  const accentColor = label === 'Ping' ? COLORS.success : COLORS.accent;
  const isDark = t.mode === 'dark';

  // Subtle gradient tint: the accent color at very low opacity
  const gradientBg = label === 'Ping'
    ? (isDark ? 'rgba(0, 196, 140, 0.06)' : 'rgba(0, 196, 140, 0.04)')
    : (isDark ? 'rgba(245, 196, 0, 0.06)' : 'rgba(245, 196, 0, 0.03)');

  // Is this card's stat currently being tested?
  const isActive = (
    (label === 'Download' && activePhase === 'Download') ||
    (label === 'Upload' && activePhase === 'Upload') ||
    (label === 'Ping' && activePhase === 'Ping')
  );

  return (
    <Animated.View
      style={[
        styles.card,
        {
          backgroundColor: t.surface,
          shadowColor: isDark ? '#000' : '#999',
          opacity: fadeAnim,
          transform: [{ translateY: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
        },
      ]}
    >
      {/* Gradient tint overlay */}
      <View style={[styles.gradientTint, { backgroundColor: gradientBg }]} />

      {/* Speed lines — only when this stat is actively being tested */}
      {isActive && (
        <View style={styles.speedLinesClip}>
          {[0, 1, 2].map(i => <CardSpeedLine key={i} index={i} color={accentColor} />)}
        </View>
      )}

      <View style={styles.cardContent}>
        <View style={styles.labelRow}>
          {getIcon()}
          <Text style={[styles.label, { color: t.textSecondary }]}>{label}</Text>
        </View>
        <Animated.Text style={[styles.value, { color: t.textPrimary, transform: [{ scale: animatedValue }] }]}>
          {typeof value === 'number' ? value.toFixed(2) : value}
          <Text style={[styles.valueUnit, { color: t.textSecondary }]}> {unit}</Text>
        </Animated.Text>
        <Text style={[styles.peak, { color: t.textMuted }]}>
          {label === 'Ping' ? 'Best' : 'Peak'}: {typeof peak === 'number' ? peak.toFixed(2) : peak} {unit}
        </Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    flex: 1,
    marginHorizontal: 4,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    // Mild box shadow
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
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
  label: { fontSize: 10, textTransform: 'uppercase', fontWeight: '700', letterSpacing: 1 },
  value: { fontSize: 18, fontWeight: '900', letterSpacing: -0.5, marginBottom: 4 },
  valueUnit: { fontSize: 11, fontWeight: '600' },
  peak: { fontSize: 9, fontWeight: '500' },
});

export default StatCard;
`;

// ── SpeedTestScreen.js — remove background speed lines, pass activePhase to StatCard
files['src/screens/SpeedTestScreen.js'] = fs.readFileSync(path.join(__dirname, 'src/screens/SpeedTestScreen.js'), 'utf8');

// Write StatCard first
Object.entries(files).forEach(([rel, content]) => {
  if (rel !== 'src/screens/SpeedTestScreen.js') {
    fs.writeFileSync(path.join(__dirname, rel), content, 'utf8');
    console.log('Wrote', rel);
  }
});

// Now patch SpeedTestScreen: remove full-screen speed lines, pass activePhase to StatCard
let sst = files['src/screens/SpeedTestScreen.js'];

// 1. Remove the SpeedLine component definition entirely (lines with SpeedLine and NUM_LINES)
sst = sst.replace(/const NUM_LINES = 5;[\s\S]*?<\/Animated\.View>\s*\);\s*\n\};/m, '');

// Actually let me just do targeted replacements:
// Remove the speed lines overlay from the render
const oldSpeedLinesBlock = `      {isTestRunning && (
        <View style={styles.speedLinesContainer} pointerEvents="none">
          {Array.from({ length: NUM_LINES }).map((_, i) => (<SpeedLine key={i} index={i} isRunning={isTestRunning} />))}
        </View>
      )}`;
sst = sst.replace(oldSpeedLinesBlock, '');

// Remove speedLinesContainer style
sst = sst.replace(`  speedLinesContainer: { ...StyleSheet.absoluteFillObject, overflow: 'hidden', zIndex: 1 },\n`, '');

// Pass activePhase (currentType) to each StatCard
sst = sst.replace(
  `<StatCard label="Download" value={downloadSpeed} peak={peaks.download} />`,
  `<StatCard label="Download" value={downloadSpeed} peak={peaks.download} activePhase={currentType} />`
);
sst = sst.replace(
  `<StatCard label="Upload" value={uploadSpeed} peak={peaks.upload} />`,
  `<StatCard label="Upload" value={uploadSpeed} peak={peaks.upload} activePhase={currentType} />`
);
sst = sst.replace(
  `<StatCard label="Ping" value={ping} peak={peaks.ping === 0 ? 'N/A' : peaks.ping} unit="ms" />`,
  `<StatCard label="Ping" value={ping} peak={peaks.ping === 0 ? 'N/A' : peaks.ping} unit="ms" activePhase={currentType} />`
);

fs.writeFileSync(path.join(__dirname, 'src/screens/SpeedTestScreen.js'), sst, 'utf8');
console.log('Wrote src/screens/SpeedTestScreen.js');

// ── HistoryScreen.js — remove accentBar, add box shadow + gradient tint
let hist = fs.readFileSync(path.join(__dirname, 'src/screens/HistoryScreen.js'), 'utf8');

// Remove the accentBar element
hist = hist.replace(`      <View style={styles.accentBar} />\n`, '');

// Remove accentBar style
hist = hist.replace(/\s*accentBar:.*?\n/g, '');

// Update historyItem style: remove flexDirection row (was for the accent bar), add shadow
hist = hist.replace(
  `borderWidth: 1, flexDirection: 'row', ...SHADOWS.cardLight`,
  `shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 4`
);

// Add a gradient tint inside the card — insert right after historyContent opens
hist = hist.replace(
  `      <View style={styles.historyContent}>`,
  `      <View style={[styles.gradientTint, { backgroundColor: t.mode === 'dark' ? 'rgba(245, 196, 0, 0.04)' : 'rgba(245, 196, 0, 0.02)' }]} />
      <View style={styles.historyContent}>`
);

// Add gradientTint style (insert before historyContent style)
hist = hist.replace(
  `  historyContent:`,
  `  gradientTint: { ...StyleSheet.absoluteFillObject, borderRadius: 16 },
  historyContent:`
);

// Update historyItem to use surface bg instead of glass, remove border
hist = hist.replace(
  `backgroundColor: t.glass,
          borderColor: t.glassBorder,
          borderTopColor: t.glassBorderTop,`,
  `backgroundColor: t.surface,`
);

fs.writeFileSync(path.join(__dirname, 'src/screens/HistoryScreen.js'), hist, 'utf8');
console.log('Wrote src/screens/HistoryScreen.js');

// Verify
['src/components/StatCard.js', 'src/screens/SpeedTestScreen.js', 'src/screens/HistoryScreen.js'].forEach(f => {
  const c = fs.readFileSync(path.join(__dirname, f), 'utf8');
  console.log(f, ':', c.length, 'bytes',
    'accentStrip:', c.includes('accentStrip'),
    'accentBar:', c.includes('accentBar'),
    'bgSpeedLines:', c.includes('speedLinesContainer'),
    'activePhase:', c.includes('activePhase'),
    'gradientTint:', c.includes('gradientTint')
  );
});

console.log('All done!');

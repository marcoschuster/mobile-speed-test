import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, TouchableOpacity, Text } from 'react-native';
import Svg, {
  Circle,
  Path,
  Line,
  Text as SvgText,
  Defs,
  LinearGradient,
  RadialGradient,
  Stop,
} from 'react-native-svg';
import { useTheme } from '../utils/theme';
import { COLORS } from '../utils/theme';

// ── Type Definitions ─────────────────────────────────────────────────────────
interface SpeedometerProps {
  speed?: number;
  maxValue?: number;
  label?: string;
  unit?: string;
  needleColor?: string;
  isRunning?: boolean;
  onStart?: () => void;
}

const SIZE = 280;
const CX = SIZE / 2;
const CY = SIZE / 2;
const R = 112;        // main radius
const INNER_R = 96;
const TICK_OUTER = 106;
const TICK_INNER_MAJOR = 86;
const TICK_INNER_MINOR = 92;
const LABEL_R = 72;

const MIN_DEG = 225;
const SWEEP = 270;

const polarToXY = (angleDeg: number, r: number): { x: number; y: number } => {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: CX + r * Math.cos(rad), y: CY - r * Math.sin(rad) };
};

const describeArc = (startAngle: number, endAngle: number, r: number): string => {
  const s = polarToXY(startAngle, r);
  const e = polarToXY(endAngle, r);
  const diff = startAngle - endAngle;
  const largeArc = diff > 180 ? 1 : 0;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${largeArc} 1 ${e.x} ${e.y}`;
};

const getSteps = (maxVal: number): { major: number; minor: number } => {
  if (maxVal <= 100) return { major: 20, minor: 10 };
  if (maxVal <= 200) return { major: 20, minor: 10 };
  if (maxVal <= 500) return { major: 100, minor: 50 };
  if (maxVal <= 1000) return { major: 200, minor: 100 };
  return { major: 300, minor: 150 };
};

const Speedometer = ({
  speed = 0,
  maxValue = 200,
  label = '',
  unit = 'Mbps',
  needleColor,
  isRunning = false,
  onStart,
}: SpeedometerProps) => {
  const { t } = useTheme();
  const needleAnim = useRef(new Animated.Value(MIN_DEG)).current;
  const glowAnim = useRef(new Animated.Value(0.3)).current;

  const speedToAngle = (val: number): number => {
    const clamped = Math.max(0, Math.min(val, maxValue));
    return MIN_DEG - (clamped / maxValue) * SWEEP;
  };

  useEffect(() => {
    Animated.spring(needleAnim, {
      toValue: speedToAngle(speed),
      tension: 30,
      friction: 10,
      useNativeDriver: false,
    }).start();
  }, [speed]);

  useEffect(() => {
    if (isRunning) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, { toValue: 0.6, duration: 1200, useNativeDriver: false }),
          Animated.timing(glowAnim, { toValue: 0.2, duration: 1200, useNativeDriver: false }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      glowAnim.setValue(0);
    }
  }, [isRunning]);

  const { major: MAJOR_STEP, minor: MINOR_STEP } = getSteps(maxValue);

  const ticks: React.ReactNode[] = [];
  for (let v = 0; v <= maxValue; v += MINOR_STEP) {
    const angle = speedToAngle(v);
    const isMajor = v % MAJOR_STEP === 0;
    const outerP = polarToXY(angle, TICK_OUTER);
    const innerP = polarToXY(angle, isMajor ? TICK_INNER_MAJOR : TICK_INNER_MINOR);

    ticks.push(
      <Line
        key={`t${v}`}
        x1={outerP.x} y1={outerP.y}
        x2={innerP.x} y2={innerP.y}
        stroke={isMajor ? t.gaugeLabelMajor : t.gaugeLabelMinor}
        strokeWidth={isMajor ? 2 : 1}
        strokeLinecap="round"
      />
    );

    if (isMajor) {
      const lp = polarToXY(angle, LABEL_R);
      ticks.push(
        <SvgText
          key={`l${v}`}
          x={lp.x} y={lp.y + 4}
          fontSize={maxValue > 500 ? '9' : '11'}
          fontWeight="700"
          fill={t.gaugeLabelMajor}
          textAnchor="middle"
        >
          {v}
        </SvgText>
      );
    }
  }

  const currentAngle = speedToAngle(Math.min(speed, maxValue));
  const coloredArcPath = speed > 0.3 ? describeArc(MIN_DEG, currentAngle, R) : '';

  const needleRotation = needleAnim.interpolate({
    inputRange: [MIN_DEG - SWEEP, MIN_DEG],
    outputRange: ['135deg', '-135deg'],
  });

  const displayValue =
    typeof speed === 'number'
      ? speed < 10
        ? speed.toFixed(1)
        : Math.round(speed).toString()
      : speed;

  // Map old bezel tokens to new theme keys
  const dialOuter = t.mode === 'dark' ? 'rgba(5, 12, 20, 0.82)' : 'rgba(255, 255, 255, 0.82)';
  const bezelTop = t.glassBorderTop;
  const bezelMid = t.glassBorder;
  const bezelBottom = t.glassStrong;
  const bezelShine = t.glassHighlight;
  const dialInnerRing = t.glassStrong;
  const dialRim = t.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.78)';
  const dialFaceCenter = t.surfaceElevated;
  const dialFaceEdge = t.glass;
  const trackArc = t.mode === 'dark' ? 'rgba(255,255,255,0.18)' : 'rgba(113,135,162,0.18)';
  const hubInner = t.mode === 'dark' ? '#04111C' : '#FFFFFF';
  const unitLabel = t.textMuted;
  const resolvedNeedleColor = needleColor || t.accent;

  return (
    <View style={styles.container}>
      {isRunning && (
        <Animated.View style={[styles.outerGlow, { opacity: glowAnim, borderColor: t.accent, shadowColor: t.accent }]} />
      )}

      <View style={styles.startButtonContainer}>
        <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          <Defs>
            <RadialGradient id="dialBg" cx="50%" cy="40%" r="55%">
              <Stop offset="0%" stopColor={dialFaceCenter} />
              <Stop offset="100%" stopColor={dialFaceEdge} />
            </RadialGradient>
            <LinearGradient id="bezelGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={bezelTop || 'rgba(255,255,255,0.3)'} />
              <Stop offset="50%" stopColor={bezelMid || 'rgba(255,255,255,0.1)'} />
              <Stop offset="100%" stopColor={bezelBottom || 'rgba(0,0,0,0.2)'} />
            </LinearGradient>
            <LinearGradient id="arcGlow" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0%" stopColor={t.accent || '#8B5CF6'} stopOpacity={0.9} />
              <Stop offset="100%" stopColor={t.accentDark || '#4c1d95'} stopOpacity={0.6} />
            </LinearGradient>
          </Defs>

          {/* Outer bezel */}
          <Circle cx={CX} cy={CY} r={R + 12} fill={dialOuter || 'rgba(5, 12, 20, 0.82)'} />
          <Circle cx={CX} cy={CY} r={R + 10} fill="url(#bezelGrad)" />
          <Circle cx={CX} cy={CY} r={R + 6} fill={dialInnerRing || 'rgba(255,255,255,0.05)'} />

          {/* Dial face */}
          <Circle cx={CX} cy={CY} r={R + 3} fill={dialRim || 'rgba(255,255,255,0.08)'} />
          <Circle cx={CX} cy={CY} r={R} fill="url(#dialBg)" />

          {/* Track arc (inactive) */}
          <Path
            d={describeArc(MIN_DEG, MIN_DEG - SWEEP, R)}
            fill="none"
            stroke={trackArc || 'rgba(255,255,255,0.18)'}
            strokeWidth="6"
            strokeLinecap="round"
          />

          {/* Active colored arc with glow */}
          {speed > 0.3 && (
            <>
              <Path d={coloredArcPath} fill="none" stroke={t.accentGlow} strokeWidth="14" strokeLinecap="round" />
              <Path d={coloredArcPath} fill="none" stroke="url(#arcGlow)" strokeWidth="6" strokeLinecap="round" />
            </>
          )}

          {ticks}

          {/* Speed readout */}
          <SvgText
            x={CX} y={CY - 20}
            fontSize="36" fontWeight="900"
            fill={t.textPrimary}
            textAnchor="middle"
            letterSpacing="-1"
          >
            {displayValue}
          </SvgText>

          {/* Needle hub */}
          <Circle cx={CX} cy={CY} r={14} fill={t.accentTintSelected} />
          <Circle cx={CX} cy={CY} r={9} fill={resolvedNeedleColor} />
          <Circle cx={CX} cy={CY} r={4.5} fill={hubInner} />
          <Circle cx={CX - 2} cy={CY - 2} r={2.5} fill="rgba(255,255,255,0.3)" />

          {/* Unit + label */}
          <SvgText x={CX} y={CY + 28} fontSize="12" fontWeight="700" fill={unitLabel} textAnchor="middle" letterSpacing="1">
            {unit}
          </SvgText>
          {label ? (
            <SvgText x={CX} y={CY + 44} fontSize="10" fontWeight="800" fill={t.accent} textAnchor="middle" letterSpacing="2" opacity={0.9}>
              {label}
            </SvgText>
          ) : null}
        </Svg>

        {/* Animated needle overlay */}
        {isRunning && (
          <Animated.View style={[styles.needleWrap, { transform: [{ rotate: needleRotation }] }]}>
            <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
              <Path d={`M ${CX - 5} ${CY} L ${CX} ${CY - INNER_R + 2} L ${CX + 5} ${CY} Z`} fill={t.accentGlow} />
              <Path d={`M ${CX - 3} ${CY} L ${CX} ${CY - INNER_R + 5} L ${CX + 3} ${CY} Z`} fill={resolvedNeedleColor} />
              <Path d={`M ${CX - 0.8} ${CY - 10} L ${CX} ${CY - INNER_R + 10} L ${CX + 0.8} ${CY - 10} Z`} fill="rgba(255,255,255,0.25)" />
            </Svg>
          </Animated.View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: SIZE + 24,
    height: SIZE + 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  needleWrap: {
    position: 'absolute',
    width: SIZE,
    height: SIZE,
  },
  outerGlow: {
    position: 'absolute',
    width: SIZE + 24,
    height: SIZE + 24,
    borderRadius: (SIZE + 24) / 2,
    borderWidth: 2,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  startButtonContainer: {
    position: 'relative',
    width: SIZE + 24,
    height: SIZE + 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startTextContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  startText: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 4,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 15,
    shadowOpacity: 0.8,
  },
});

export default Speedometer;

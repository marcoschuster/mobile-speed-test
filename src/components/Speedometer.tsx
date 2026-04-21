import React, { useEffect, useMemo, useRef, useState } from 'react';
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

// ── Type Definitions ─────────────────────────────────────────────────────────
interface SpeedometerProps {
  speed?: number;
  maxValue?: number;
  label?: string;
  unit?: string;
  needleColor?: string;
  isRunning?: boolean;
  onStart?: () => void;
  onStop?: () => void;
}

const SIZE = 280;
const WAVE_RING_SIZE = SIZE + 40;
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

type WaveDescriptor = {
  amplitude: number;
  waveCount: number;
  phase: number;
  rotation: number;
};

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

const createWaveDescriptor = (): WaveDescriptor => ({
  amplitude: 4 + Math.random() * 3.5,
  waveCount: 12 + Math.floor(Math.random() * 4),
  phase: Math.random() * Math.PI * 2,
  rotation: -10 + Math.random() * 20,
});

const describeCurlyWave = ({
  size,
  radius,
  amplitude,
  waveCount,
  phase,
}: {
  size: number;
  radius: number;
  amplitude: number;
  waveCount: number;
  phase: number;
}) => {
  const center = size / 2;
  const segments = 96;
  let path = '';

  for (let index = 0; index <= segments; index += 1) {
    const progress = index / segments;
    const theta = progress * Math.PI * 2 + phase;
    const ripple = Math.sin(theta * waveCount) * amplitude;
    const secondary = Math.sin(theta * (waveCount / 2)) * amplitude * 0.22;
    const distance = radius + ripple + secondary;
    const x = center + Math.cos(theta) * distance;
    const y = center + Math.sin(theta) * distance;
    path += index === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
  }

  return `${path} Z`;
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
  onStop,
}: SpeedometerProps) => {
  const { t } = useTheme();
  const contentFade = useRef(new Animated.Value(0)).current;
  const targetSpeedRef = useRef(speed);
  const inputVelocityRef = useRef(0);
  const lastInputAtRef = useRef(Date.now());
  const lastInputSpeedRef = useRef(speed);
  const displaySpeedRef = useRef(speed);
  const frameRef = useRef<number | null>(null);
  const [displaySpeed, setDisplaySpeed] = useState(speed);
  const waveScales = useRef([
    new Animated.Value(1),
    new Animated.Value(1),
    new Animated.Value(1),
  ]).current;
  const waveOpacities = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;
  const [waveDescriptors, setWaveDescriptors] = useState<WaveDescriptor[]>(() => ([
    createWaveDescriptor(),
    createWaveDescriptor(),
    createWaveDescriptor(),
  ]));

  // Reset animation values to ensure clean state
  useEffect(() => {
    contentFade.setValue(0);
    waveScales.forEach((value) => value.setValue(1));
    waveOpacities.forEach((value) => value.setValue(0));
  }, []);

  useEffect(() => {
    targetSpeedRef.current = Math.max(0, Math.min(speed, maxValue));
    const now = Date.now();
    const elapsed = Math.max(now - lastInputAtRef.current, 1);
    const nextVelocity = (targetSpeedRef.current - lastInputSpeedRef.current) / elapsed;

    inputVelocityRef.current = inputVelocityRef.current * 0.35 + nextVelocity * 0.65;
    lastInputSpeedRef.current = targetSpeedRef.current;
    lastInputAtRef.current = now;

    if (!isRunning) {
      displaySpeedRef.current = targetSpeedRef.current;
      setDisplaySpeed(targetSpeedRef.current);
    }
  }, [isRunning, maxValue, speed]);

  useEffect(() => {
    if (isRunning) {
      Animated.timing(contentFade, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    } else {
      contentFade.setValue(0);
    }
  }, [isRunning]);

  const speedToAngle = (val: number): number => {
    const clamped = Math.max(0, Math.min(val, maxValue));
    return MIN_DEG - (clamped / maxValue) * SWEEP;
  };

  useEffect(() => {
    let active = true;

    const animateFrame = () => {
      if (!active) {
        return;
      }

      const now = Date.now();
      const elapsedSinceInput = Math.max(now - lastInputAtRef.current, 0);
      const horizon = isRunning ? 520 : 180;
      const inertia = Math.max(0, 1 - elapsedSinceInput / horizon);
      const predictedTarget = Math.max(
        0,
        Math.min(
          maxValue,
          targetSpeedRef.current + inputVelocityRef.current * Math.min(elapsedSinceInput, horizon) * inertia,
        ),
      );
      const current = displaySpeedRef.current;
      const delta = predictedTarget - current;
      const catchup = isRunning ? 0.22 : 0.34;
      const minStep = Math.max(0.018, predictedTarget * 0.00085);

      let nextValue = predictedTarget;
      if (Math.abs(delta) > 0.01) {
        let step = delta * catchup;
        if (Math.abs(step) < minStep) {
          step = Math.sign(delta) * minStep;
        }
        const candidate = current + step;
        nextValue = delta > 0
          ? Math.min(candidate, predictedTarget)
          : Math.max(candidate, predictedTarget);
      }

      if (Math.abs(nextValue - displaySpeedRef.current) > 0.001) {
        displaySpeedRef.current = nextValue;
        setDisplaySpeed(nextValue);
      }

      frameRef.current = requestAnimationFrame(animateFrame);
    };

    frameRef.current = requestAnimationFrame(animateFrame);

    return () => {
      active = false;
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [isRunning, maxValue]);

  useEffect(() => {
    let active = true;
    const timeouts: ReturnType<typeof setTimeout>[] = [];

    const animateWave = (index: number) => {
      if (!active) {
        return;
      }

      const startOpacity = 0.12 + Math.random() * 0.12;
      const endScale = 1.1 + Math.random() * 0.22;
      const duration = 1300 + Math.round(Math.random() * 950);
      const pause = 180 + Math.round(Math.random() * 420);

      setWaveDescriptors((previous) => previous.map((descriptor, waveIndex) => (
        waveIndex === index ? createWaveDescriptor() : descriptor
      )));
      waveScales[index].setValue(1);
      waveOpacities[index].setValue(startOpacity);

      Animated.parallel([
        Animated.timing(waveScales[index], {
          toValue: endScale,
          duration,
          useNativeDriver: true,
        }),
        Animated.timing(waveOpacities[index], {
          toValue: 0,
          duration,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (!finished || !active) {
          return;
        }

        const timeout = setTimeout(() => animateWave(index), pause);
        timeouts.push(timeout);
      });
    };

    if (isRunning) {
      waveScales.forEach((value) => value.setValue(1));
      waveOpacities.forEach((value) => value.setValue(0));

      waveScales.forEach((_value, index) => {
        const timeout = setTimeout(() => animateWave(index), index * 280);
        timeouts.push(timeout);
      });
    } else {
      waveScales.forEach((value) => value.setValue(1));
      waveOpacities.forEach((value) => value.setValue(0));
    }

    return () => {
      active = false;
      timeouts.forEach((timeout) => clearTimeout(timeout));
      waveScales.forEach((value) => value.stopAnimation());
      waveOpacities.forEach((value) => value.stopAnimation());
      waveScales.forEach((value) => value.setValue(1));
      waveOpacities.forEach((value) => value.setValue(0));
    };
  }, [isRunning, waveOpacities, waveScales]);

  const ticks = useMemo(() => {
    const { major: MAJOR_STEP, minor: MINOR_STEP } = getSteps(maxValue);
    const nodes: React.ReactNode[] = [];

    for (let v = 0; v <= maxValue; v += MINOR_STEP) {
      const angle = speedToAngle(v);
      const isMajor = v % MAJOR_STEP === 0;
      const outerP = polarToXY(angle, TICK_OUTER);
      const innerP = polarToXY(angle, isMajor ? TICK_INNER_MAJOR : TICK_INNER_MINOR);

      nodes.push(
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
        nodes.push(
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

    return nodes;
  }, [maxValue, t.gaugeLabelMajor, t.gaugeLabelMinor]);

  const currentAngle = speedToAngle(Math.min(displaySpeed, maxValue));
  const coloredArcPath = displaySpeed > 0.3 ? describeArc(MIN_DEG, currentAngle, R) : '';
  const needleRotation = `${90 - currentAngle}deg`;
  const wavePaths = useMemo(
    () => waveDescriptors.map((descriptor) => describeCurlyWave({
      size: WAVE_RING_SIZE,
      radius: WAVE_RING_SIZE / 2 - 18,
      amplitude: descriptor.amplitude,
      waveCount: descriptor.waveCount,
      phase: descriptor.phase,
    })),
    [waveDescriptors],
  );

  const displayValue =
    displaySpeed < 10
      ? displaySpeed.toFixed(1)
      : Math.round(displaySpeed).toString();

  // Map old bezel tokens to new theme keys
  const dialOuter = t.mode === 'dark' ? 'rgba(5, 12, 20, 0.82)' : 'rgba(255, 255, 255, 0.82)';
  const bezelTop = t.glassBorderTop;
  const bezelMid = t.glassBorder;
  const bezelBottom = t.glassStrong;
  const bezelShine = t.glassHighlight;
  const dialInnerRing = t.glassStrong;
  const dialRim = t.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.78)';
  const dialFaceCenter = t.surfaceElevated || (t.mode === 'dark' ? '#1e293b' : '#f1f5f9');
  const dialFaceEdge = t.glass || (t.mode === 'dark' ? '#0f172a' : '#cbd5e1');
  const trackArc = t.mode === 'dark' ? 'rgba(255,255,255,0.18)' : 'rgba(113,135,162,0.18)';
  const hubInner = t.mode === 'dark' ? '#04111C' : '#FFFFFF';
  const unitLabel = t.textMuted;
  const resolvedNeedleColor = needleColor || t.accent;

  return (
    <View style={styles.container}>
      {isRunning ? (
        <View pointerEvents="none" style={styles.waveLayer}>
          {waveScales.map((scale, index) => (
            <Animated.View
              key={index}
              style={[
                styles.waveRing,
                {
                  shadowColor: t.accent,
                  opacity: waveOpacities[index],
                  transform: [
                    { scale },
                    { rotate: `${waveDescriptors[index].rotation}deg` },
                  ],
                },
              ]}
            >
              <Svg width={WAVE_RING_SIZE} height={WAVE_RING_SIZE} viewBox={`0 0 ${WAVE_RING_SIZE} ${WAVE_RING_SIZE}`}>
                <Path
                  d={wavePaths[index]}
                  fill="none"
                  stroke={t.accent}
                  strokeOpacity={0.34}
                  strokeWidth={2.6}
                  strokeLinejoin="round"
                />
                <Path
                  d={wavePaths[index]}
                  fill="none"
                  stroke={t.accentLight || t.accent}
                  strokeOpacity={0.16}
                  strokeWidth={5.6}
                  strokeLinejoin="round"
                />
              </Svg>
            </Animated.View>
          ))}
        </View>
      ) : null}

      <TouchableOpacity onPress={onStart} activeOpacity={0.9} disabled={isRunning} style={styles.startButtonContainer}>
        <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          <Defs>
            <RadialGradient id="dialBg" cx="50%" cy="40%" r="55%">
              <Stop offset="0%" stopColor={dialFaceCenter} />
              <Stop offset="100%" stopColor={dialFaceEdge} />
            </RadialGradient>
            <LinearGradient id="bezelGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={bezelTop || 'rgba(255,255,255,0.4)'} />
              <Stop offset="50%" stopColor={bezelMid || 'rgba(255,255,255,0.1)'} />
              <Stop offset="100%" stopColor={bezelBottom || 'rgba(0,0,0,0.3)'} />
            </LinearGradient>
            <LinearGradient id="arcGlow" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0%" stopColor={resolvedNeedleColor || t.accent || '#8B5CF6'} stopOpacity={0.9} />
              <Stop offset="100%" stopColor={t.accentDark || '#4c1d95'} stopOpacity={0.6} />
            </LinearGradient>
          </Defs>

          {/* 3D silver bezel - thicker at top, thinner at bottom */}
          <Circle cx={CX} cy={CY} r={R + 12} fill={dialOuter || 'rgba(5, 12, 20, 0.82)'} />
          <Circle cx={CX} cy={CY} r={R + 10} fill="url(#bezelGrad)" />
          <Circle cx={CX} cy={CY} r={R + 6} fill={dialInnerRing || 'rgba(255,255,255,0.05)'} />

          {/* Dial face */}
          <Circle cx={CX} cy={CY} r={R + 3} fill={dialRim || 'rgba(255,255,255,0.08)'} />
          <Circle cx={CX} cy={CY} r={R} fill="url(#dialBg)" />

          {/* Gauge content - fades in when running */}
          <Animated.View style={{ opacity: contentFade, position: 'absolute', top: 0, left: 0 }}>
            <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
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
                  <Path d={coloredArcPath} fill="none" stroke={resolvedNeedleColor} strokeWidth="14" strokeLinecap="round" opacity={0.3} />
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
          </Animated.View>
        </Svg>

        {/* START text - only visible when not running */}
        {!isRunning && (
          <View style={styles.startTextContainer}>
            <Text style={[styles.startText, { color: t.accent }]}>START</Text>
          </View>
        )}

        {/* Animated needle overlay */}
        {isRunning && (
          <View style={[styles.needleWrap, { transform: [{ rotate: needleRotation }] }]}>
            <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
              <Path d={`M ${CX - 5} ${CY} L ${CX} ${CY - INNER_R + 2} L ${CX + 5} ${CY} Z`} fill={t.accentGlow} />
              <Path d={`M ${CX - 3} ${CY} L ${CX} ${CY - INNER_R + 5} L ${CX + 3} ${CY} Z`} fill={resolvedNeedleColor} />
              <Path d={`M ${CX - 0.8} ${CY - 10} L ${CX} ${CY - INNER_R + 10} L ${CX + 0.8} ${CY - 10} Z`} fill="rgba(255,255,255,0.25)" />
            </Svg>
          </View>
        )}

        {isRunning && onStop ? (
          <TouchableOpacity
            onPress={onStop}
            activeOpacity={0.82}
            style={[
              styles.stopButton,
              {
                backgroundColor: t.surfaceElevated,
                borderColor: t.glassBorderTop,
                shadowColor: t.accent,
              },
            ]}
          >
            <Text style={[styles.stopButtonText, { color: t.textPrimary }]}>STOP</Text>
          </TouchableOpacity>
        ) : null}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: SIZE + 24,
    height: SIZE + 24,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  needleWrap: {
    position: 'absolute',
    width: SIZE,
    height: SIZE,
  },
  waveLayer: {
    position: 'absolute',
    width: WAVE_RING_SIZE + 32,
    height: WAVE_RING_SIZE + 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waveRing: {
    position: 'absolute',
    width: WAVE_RING_SIZE,
    height: WAVE_RING_SIZE,
    backgroundColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 22,
    elevation: 8,
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
  stopButton: {
    position: 'absolute',
    bottom: 16,
    alignSelf: 'center',
    minWidth: 78,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.24,
    shadowRadius: 18,
    elevation: 10,
  },
  stopButtonText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.8,
  },
});

export default Speedometer;

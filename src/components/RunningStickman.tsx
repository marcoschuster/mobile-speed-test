import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';

interface RunningStickmanProps {
  active?: boolean;
  speed?: number;
  phaseLabel?: string;
  color?: string;
  showLabel?: boolean;
}

interface Point {
  x: number;
  y: number;
}

const STROKE = 3.25;

const HEAD_CENTER = { x: 42, y: 12 };
const SHOULDER = { x: 40, y: 24 };
const HIP = { x: 34, y: 40 };
const GROUND_Y = 64;
const THIGH_LENGTH = 16;
const SHIN_LENGTH = 17;
const UPPER_ARM_LENGTH = 12;
const FOREARM_LENGTH = 13;

const toRadians = (turn: number) => turn * Math.PI * 2;

const orbitingFoot = (phase: number): Point => {
  const angle = toRadians(phase) - Math.PI / 2;
  const swing = Math.sin(angle);
  const x = HIP.x + swing * 18;
  const lift = Math.max(0, Math.cos(angle)) * 10;

  return {
    x,
    y: GROUND_Y - lift + Math.max(0, -swing) * 1.5,
  };
};

const orbitingHand = (phase: number): Point => {
  const angle = toRadians(phase) - Math.PI / 2;
  const swing = Math.sin(angle);
  const rise = Math.max(0, swing);
  const drop = Math.max(0, -swing);

  return {
    x: SHOULDER.x - 1 + swing * 12,
    y: SHOULDER.y + 13 - rise * 6 + drop * 2,
  };
};

const solveJoint = (
  origin: Point,
  target: Point,
  upperLength: number,
  lowerLength: number,
  bendDirection: number,
): Point => {
  const dx = target.x - origin.x;
  const dy = target.y - origin.y;
  const distance = Math.max(0.001, Math.min(Math.hypot(dx, dy), upperLength + lowerLength - 0.001));
  const a = (upperLength * upperLength - lowerLength * lowerLength + distance * distance) / (2 * distance);
  const h = Math.sqrt(Math.max(0, upperLength * upperLength - a * a));
  const midX = origin.x + (a * dx) / distance;
  const midY = origin.y + (a * dy) / distance;
  const perpX = -dy / distance;
  const perpY = dx / distance;

  return {
    x: midX + perpX * h * bendDirection,
    y: midY + perpY * h * bendDirection,
  };
};

const createLimb = (phase: number, isNearSide: boolean) => {
  const foot = orbitingFoot(phase);
  const hand = orbitingHand((phase + 0.5) % 1);

  return {
    hand,
    elbow: solveJoint(SHOULDER, hand, UPPER_ARM_LENGTH, FOREARM_LENGTH, isNearSide ? 0.46 : 0.28),
    foot,
    knee: solveJoint(HIP, foot, THIGH_LENGTH, SHIN_LENGTH, -0.72),
  };
};

const RunningStickman = ({
  active = false,
  speed = 0,
  phaseLabel = 'TESTING',
  color = '#FACC15',
  showLabel = true,
}: RunningStickmanProps) => {
  const [phase, setPhase] = useState(0);
  const frameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const phaseRef = useRef(0);

  // Create a darker shade of the color for far limbs
  const darkColor = useMemo(() => {
    // Simple darkening by reducing lightness
    if (color.startsWith('#')) {
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);
      const darkerR = Math.floor(r * 0.6);
      const darkerG = Math.floor(g * 0.6);
      const darkerB = Math.floor(b * 0.6);
      return `#${darkerR.toString(16).padStart(2, '0')}${darkerG.toString(16).padStart(2, '0')}${darkerB.toString(16).padStart(2, '0')}`;
    }
    return color;
  }, [color]);

  const cadenceDuration = useMemo(() => {
    const clamped = Math.max(0, Math.min(speed, 320));
    return Math.round(680 - (clamped / 320) * 420);
  }, [speed]);

  useEffect(() => {
    phaseRef.current = 0;
    lastTimeRef.current = null;
    setPhase(0);

    if (!active) {
      return;
    }

    const tick = (timestamp: number) => {
      if (lastTimeRef.current == null) {
        lastTimeRef.current = timestamp;
      }

      const delta = timestamp - lastTimeRef.current;
      // Update at 16fps to reduce tearing
      if (delta >= 62) {
        lastTimeRef.current = timestamp;
        phaseRef.current = (phaseRef.current + delta / cadenceDuration) % 1;
        setPhase(phaseRef.current);
      }
      frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);

    return () => {
      if (frameRef.current != null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [active, cadenceDuration]);

  const nearSide = useMemo(() => createLimb(phase, true), [phase]);
  const farSide = useMemo(() => createLimb((phase + 0.5) % 1, false), [phase]);

  return (
    <View style={styles.wrap}>
      <Animated.View style={styles.figureFrame}>
        <Svg width={72} height={68} viewBox="0 0 72 68">
          <Line x1={16} y1={64} x2={56} y2={64} stroke={color} strokeOpacity={0.5} strokeWidth={4} strokeLinecap="round" />

          <Line x1={SHOULDER.x} y1={SHOULDER.y} x2={farSide.elbow.x} y2={farSide.elbow.y} stroke={darkColor} strokeWidth={STROKE - 0.5} strokeLinecap="round" />
          <Line x1={farSide.elbow.x} y1={farSide.elbow.y} x2={farSide.hand.x} y2={farSide.hand.y} stroke={darkColor} strokeWidth={STROKE - 0.5} strokeLinecap="round" />
          <Line x1={HIP.x} y1={HIP.y} x2={farSide.knee.x} y2={farSide.knee.y} stroke={darkColor} strokeWidth={STROKE - 0.3} strokeLinecap="round" />
          <Line x1={farSide.knee.x} y1={farSide.knee.y} x2={farSide.foot.x} y2={farSide.foot.y} stroke={darkColor} strokeWidth={STROKE - 0.3} strokeLinecap="round" />

          <Circle cx={HEAD_CENTER.x} cy={HEAD_CENTER.y} r={6.5} stroke={color} strokeWidth={STROKE} fill="none" />
          <Line x1={HEAD_CENTER.x} y1={18.5} x2={SHOULDER.x} y2={SHOULDER.y} stroke={color} strokeWidth={STROKE} strokeLinecap="round" />
          <Line x1={SHOULDER.x} y1={SHOULDER.y} x2={HIP.x} y2={HIP.y} stroke={color} strokeWidth={STROKE} strokeLinecap="round" />

          <Line x1={SHOULDER.x} y1={SHOULDER.y} x2={nearSide.elbow.x} y2={nearSide.elbow.y} stroke={color} strokeWidth={STROKE} strokeLinecap="round" />
          <Line x1={nearSide.elbow.x} y1={nearSide.elbow.y} x2={nearSide.hand.x} y2={nearSide.hand.y} stroke={color} strokeWidth={STROKE} strokeLinecap="round" />
          <Line x1={HIP.x} y1={HIP.y} x2={nearSide.knee.x} y2={nearSide.knee.y} stroke={color} strokeWidth={STROKE} strokeLinecap="round" />
          <Line x1={nearSide.knee.x} y1={nearSide.knee.y} x2={nearSide.foot.x} y2={nearSide.foot.y} stroke={color} strokeWidth={STROKE} strokeLinecap="round" />
        </Svg>
      </Animated.View>

      {showLabel ? <Text style={[styles.phaseText, { color }]}>{phaseLabel.toUpperCase()}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 88,
    marginBottom: 8,
  },
  figureFrame: {
    width: 72,
    height: 68,
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginBottom: 4,
  },
  phaseText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
});

export default RunningStickman;

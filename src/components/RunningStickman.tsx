import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';

interface RunningStickmanProps {
  active?: boolean;
  speed?: number;
  phaseLabel?: string;
  color?: string;
}

interface Point {
  x: number;
  y: number;
}

const STROKE = 3.25;

const HEAD_CENTER = { x: 38, y: 12 };
const SHOULDER = { x: 37, y: 24 };
const HIP = { x: 34, y: 40 };
const GROUND_Y = 64;
const THIGH_LENGTH = 16;
const SHIN_LENGTH = 17;
const UPPER_ARM_LENGTH = 12;
const FOREARM_LENGTH = 13;

const toRadians = (turn: number) => turn * Math.PI * 2;

const orbitingFoot = (phase: number): Point => {
  const angle = toRadians(phase) - Math.PI / 2;
  const x = HIP.x + Math.sin(angle) * 14;
  const lift = Math.max(0, Math.cos(angle)) * 12;

  return {
    x,
    y: GROUND_Y - lift,
  };
};

const orbitingHand = (phase: number): Point => {
  const angle = toRadians(phase) - Math.PI / 2;

  return {
    x: SHOULDER.x - Math.sin(angle) * 11,
    y: SHOULDER.y + 14 - Math.cos(angle) * 4,
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
  const hand = orbitingHand(phase);

  return {
    hand,
    elbow: solveJoint(SHOULDER, hand, UPPER_ARM_LENGTH, FOREARM_LENGTH, isNearSide ? 0.55 : 0.35),
    foot,
    knee: solveJoint(HIP, foot, THIGH_LENGTH, SHIN_LENGTH, -0.72),
  };
};

const RunningStickman = ({
  active = false,
  speed = 0,
  phaseLabel = 'TESTING',
  color = '#FACC15',
}: RunningStickmanProps) => {
  const bob = useRef(new Animated.Value(0)).current;
  const frameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const phaseRef = useRef(0);
  const [phase, setPhase] = useState(0);

  const cadenceDuration = useMemo(() => {
    const clamped = Math.max(0, Math.min(speed, 320));
    return Math.round(680 - (clamped / 320) * 420);
  }, [speed]);

  useEffect(() => {
    bob.stopAnimation();
    bob.setValue(0);
    phaseRef.current = 0;
    lastTimeRef.current = null;
    setPhase(0);

    if (!active) {
      return;
    }

    const runLoop = Animated.loop(Animated.sequence([
      Animated.timing(bob, {
        toValue: 1,
        duration: cadenceDuration / 2,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(bob, {
        toValue: 0,
        duration: cadenceDuration / 2,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
    ]));

    const tick = (timestamp: number) => {
      if (lastTimeRef.current == null) {
        lastTimeRef.current = timestamp;
      }

      const delta = timestamp - lastTimeRef.current;
      lastTimeRef.current = timestamp;
      phaseRef.current = (phaseRef.current + delta / cadenceDuration) % 1;
      setPhase(phaseRef.current);
      frameRef.current = requestAnimationFrame(tick);
    };

    runLoop.start();
    frameRef.current = requestAnimationFrame(tick);

    return () => {
      if (frameRef.current != null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      runLoop.stop();
      bob.stopAnimation();
    };
  }, [active, bob, cadenceDuration]);

  const bodyTranslateY = bob.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -4],
  });

  const nearSide = createLimb(phase, true);
  const farSide = createLimb((phase + 0.5) % 1, false);

  return (
    <View style={styles.wrap}>
      <Animated.View style={[styles.figureFrame, { transform: [{ translateY: bodyTranslateY }] }]}>
        <Svg width={72} height={68} viewBox="0 0 72 68">
          <Line x1={16} y1={64} x2={56} y2={64} stroke={color} strokeOpacity={0.22} strokeWidth={4} strokeLinecap="round" />

          <Line x1={SHOULDER.x} y1={SHOULDER.y} x2={farSide.elbow.x} y2={farSide.elbow.y} stroke={color} strokeOpacity={0.34} strokeWidth={STROKE - 0.5} strokeLinecap="round" />
          <Line x1={farSide.elbow.x} y1={farSide.elbow.y} x2={farSide.hand.x} y2={farSide.hand.y} stroke={color} strokeOpacity={0.34} strokeWidth={STROKE - 0.5} strokeLinecap="round" />
          <Line x1={HIP.x} y1={HIP.y} x2={farSide.knee.x} y2={farSide.knee.y} stroke={color} strokeOpacity={0.34} strokeWidth={STROKE - 0.3} strokeLinecap="round" />
          <Line x1={farSide.knee.x} y1={farSide.knee.y} x2={farSide.foot.x} y2={farSide.foot.y} stroke={color} strokeOpacity={0.34} strokeWidth={STROKE - 0.3} strokeLinecap="round" />

          <Circle cx={HEAD_CENTER.x} cy={HEAD_CENTER.y} r={6.5} stroke={color} strokeWidth={STROKE} fill="none" />
          <Line x1={HEAD_CENTER.x} y1={18.5} x2={SHOULDER.x} y2={SHOULDER.y} stroke={color} strokeWidth={STROKE} strokeLinecap="round" />
          <Line x1={SHOULDER.x} y1={SHOULDER.y} x2={HIP.x} y2={HIP.y} stroke={color} strokeWidth={STROKE} strokeLinecap="round" />

          <Line x1={SHOULDER.x} y1={SHOULDER.y} x2={nearSide.elbow.x} y2={nearSide.elbow.y} stroke={color} strokeWidth={STROKE} strokeLinecap="round" />
          <Line x1={nearSide.elbow.x} y1={nearSide.elbow.y} x2={nearSide.hand.x} y2={nearSide.hand.y} stroke={color} strokeWidth={STROKE} strokeLinecap="round" />
          <Line x1={HIP.x} y1={HIP.y} x2={nearSide.knee.x} y2={nearSide.knee.y} stroke={color} strokeWidth={STROKE} strokeLinecap="round" />
          <Line x1={nearSide.knee.x} y1={nearSide.knee.y} x2={nearSide.foot.x} y2={nearSide.foot.y} stroke={color} strokeWidth={STROKE} strokeLinecap="round" />
        </Svg>
      </Animated.View>

      <Text style={[styles.phaseText, { color }]}>{phaseLabel.toUpperCase()}</Text>
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

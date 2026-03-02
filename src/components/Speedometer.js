import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import Svg, {
  Circle,
  Path,
  Line,
  G,
  Text as SvgText,
  Defs,
  LinearGradient,
  Stop,
} from 'react-native-svg';

const SIZE = 270;
const CX = SIZE / 2;
const CY = SIZE / 2;
const RADIUS = 108;
const INNER_R = 92;
const TICK_OUTER = 102;
const TICK_INNER_MAJOR = 83;
const TICK_INNER_MINOR = 89;
const LABEL_R = 70;

const MIN_DEG = 225;
const SWEEP = 270;

const polarToXY = (angleDeg, r) => {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: CX + r * Math.cos(rad),
    y: CY - r * Math.sin(rad),
  };
};

const describeArc = (startAngle, endAngle, r) => {
  const s = polarToXY(startAngle, r);
  const e = polarToXY(endAngle, r);
  const diff = startAngle - endAngle;
  const largeArc = diff > 180 ? 1 : 0;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${largeArc} 1 ${e.x} ${e.y}`;
};

// Pick nice major/minor tick steps based on the max value
const getSteps = (maxVal) => {
  if (maxVal <= 100) return { major: 20, minor: 10 };
  if (maxVal <= 200) return { major: 20, minor: 10 };
  if (maxVal <= 500) return { major: 100, minor: 50 };
  if (maxVal <= 1000) return { major: 200, minor: 100 };
  return { major: 300, minor: 150 };  // for 1500
};

const Speedometer = ({
  speed = 0,
  maxValue = 200,
  label = '',
  unit = 'Mbps',
  needleColor = '#667eea',
}) => {
  const needleAnim = useRef(new Animated.Value(MIN_DEG)).current;

  const speedToAngle = (val) => {
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

  const { major: MAJOR_STEP, minor: MINOR_STEP } = getSteps(maxValue);

  // Build ticks
  const ticks = [];
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
        stroke={isMajor ? '#333' : '#bbb'}
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
          fontWeight="600"
          fill="#555"
          textAnchor="middle"
        >
          {v}
        </SvgText>
      );
    }
  }

  // Colored arc
  const currentAngle = speedToAngle(Math.min(speed, maxValue));
  const coloredArcPath = speed > 0.3 ? describeArc(MIN_DEG, currentAngle, RADIUS) : '';

  // Needle rotation
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

  return (
    <View style={styles.container}>
      <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <Defs>
          <LinearGradient id="dialBg" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#f8f9fa" />
            <Stop offset="100%" stopColor="#eef0f3" />
          </LinearGradient>
        </Defs>

        {/* Outer ring shadow */}
        <Circle cx={CX} cy={CY} r={RADIUS + 8} fill="#e8e8e8" />
        <Circle cx={CX} cy={CY} r={RADIUS + 5} fill="#f0f0f0" />

        {/* Dial face */}
        <Circle cx={CX} cy={CY} r={RADIUS + 2} fill="#fff" />
        <Circle cx={CX} cy={CY} r={RADIUS} fill="url(#dialBg)" />

        {/* Track arc */}
        <Path
          d={describeArc(MIN_DEG, MIN_DEG - SWEEP, RADIUS)}
          fill="none"
          stroke="#e0e2e8"
          strokeWidth="6"
          strokeLinecap="round"
        />

        {/* Colored arc */}
        {speed > 0.3 && (
          <Path
            d={coloredArcPath}
            fill="none"
            stroke={needleColor}
            strokeWidth="6"
            strokeLinecap="round"
            opacity={0.7}
          />
        )}

        {/* Ticks + labels */}
        {ticks}

        {/* Speed number — ABOVE the hub */}
        <SvgText
          x={CX}
          y={CY - 22}
          fontSize="30"
          fontWeight="800"
          fill="#222"
          textAnchor="middle"
        >
          {displayValue}
        </SvgText>

        {/* Needle hub — center */}
        <Circle cx={CX} cy={CY} r={8} fill={needleColor} />
        <Circle cx={CX} cy={CY} r={4.5} fill="#fff" />

        {/* Unit + label — BELOW the hub with space */}
        <SvgText
          x={CX}
          y={CY + 26}
          fontSize="12"
          fontWeight="600"
          fill="#999"
          textAnchor="middle"
        >
          {unit}
        </SvgText>
        {label ? (
          <SvgText
            x={CX}
            y={CY + 42}
            fontSize="10"
            fontWeight="700"
            fill={needleColor}
            textAnchor="middle"
            opacity={0.8}
          >
            {label}
          </SvgText>
        ) : null}
      </Svg>

      {/* Animated needle overlay */}
      <Animated.View
        style={[
          styles.needleWrap,
          { transform: [{ rotate: needleRotation }] },
        ]}
      >
        <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          <Path
            d={`M ${CX - 3} ${CY} L ${CX} ${CY - INNER_R + 5} L ${CX + 3} ${CY} Z`}
            fill={needleColor}
          />
          <Path
            d={`M ${CX - 1} ${CY - 8} L ${CX} ${CY - INNER_R + 8} L ${CX + 1} ${CY - 8} Z`}
            fill="#fff"
            opacity={0.3}
          />
        </Svg>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  needleWrap: {
    position: 'absolute',
    width: SIZE,
    height: SIZE,
  },
});

export default Speedometer;

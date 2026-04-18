import React, { ReactNode, useMemo, useRef, useState } from 'react';
import {
  Animated,
  GestureResponderEvent,
  LayoutChangeEvent,
  Pressable,
  PressableProps,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { BlurView } from 'expo-blur';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { useTheme, withAlpha } from '../utils/theme';

export const GLASS = {
  bg: 'rgba(255, 255, 255, 0.08)',
  border: 'rgba(255, 255, 255, 0.2)',
  blur: 40,
  radius: 24,
} as const;

export const LIQUID_COLORS = {
  bgGradient: ['#0a0e27', '#1a1f3a', '#2d1b69'] as const,
  text: '#FFFFFF',
  textMuted: 'rgba(255, 255, 255, 0.7)',
  accent: '#8B5CF6',
  accent2: '#06B6D4',
} as const;

type Ripple = {
  id: number;
  x: number;
  y: number;
  size: number;
  scale: Animated.Value;
  opacity: Animated.Value;
};

interface LiquidGlassProps extends Omit<PressableProps, 'style'> {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  borderRadius?: number;
  blurIntensity?: number;
  glow?: boolean;
}

const LiquidGlass = ({
  children,
  style,
  contentStyle,
  borderRadius = GLASS.radius,
  blurIntensity = GLASS.blur,
  glow = true,
  onPress,
  onPressIn,
  disabled,
  ...rest
}: LiquidGlassProps) => {
  const { t } = useTheme();
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const [layout, setLayout] = useState({ width: 0, height: 0 });
  const rippleId = useRef(0);
  const pressableRef = useRef<View>(null);
  const gradientId = useMemo(() => `liquid-ripple-${Math.random().toString(36).slice(2, 10)}`, []);
  const hazeIdPrimary = useMemo(() => `liquid-haze-primary-${Math.random().toString(36).slice(2, 10)}`, []);
  const hazeIdSecondary = useMemo(() => `liquid-haze-secondary-${Math.random().toString(36).slice(2, 10)}`, []);
  const surfaceTone = t.glass || GLASS.bg;
  const borderTone = t.glassBorderAccent || GLASS.border;
  const blurFallbackColor = t.glassStrong || 'rgba(255, 255, 255, 0.04)';
  const primaryHaze = withAlpha(t.accentLight || t.accent, t.mode === 'dark' ? 0.15 : 0.1);
  const secondaryHaze = withAlpha(t.uploadLine || t.accent, t.mode === 'dark' ? 0.12 : 0.08);
  const neutralWash = withAlpha('#FFFFFF', t.mode === 'dark' ? 0.03 : 0.05);

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setLayout({ width, height });
  };

  const handlePressIn = (event: GestureResponderEvent) => {
    const { locationX, locationY } = event.nativeEvent;

    if (layout.width > 0 && layout.height > 0) {
      const size = Math.max(layout.width, layout.height) * 2;
      const scale = new Animated.Value(0);
      const opacity = new Animated.Value(0.6);
      const id = rippleId.current += 1;

      // Adjust coordinates to account for content padding
      const paddingX = contentStyle?.padding || contentStyle?.paddingHorizontal || 0;
      const paddingY = contentStyle?.padding || contentStyle?.paddingVertical || 0;

      setRipples((prev) => [...prev, { id, x: locationX + paddingX, y: locationY + paddingY, size, scale, opacity }]);

      Animated.parallel([
        Animated.timing(scale, {
          toValue: 3,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setRipples((prev) => prev.filter((ripple) => ripple.id !== id));
      });
    }

    onPressIn?.(event);
  };

  return (
    <Pressable
      {...rest}
      disabled={disabled}
      onPress={onPress}
      onPressIn={handlePressIn}
      onLayout={handleLayout}
      style={({ pressed }) => [
        styles.container,
        {
          borderRadius,
          backgroundColor: surfaceTone,
          borderColor: borderTone,
          shadowColor: t.accentDark || '#000',
          shadowOpacity: t.mode === 'dark' ? 0.24 : 0.16,
          transform: [{ scale: pressed ? 0.985 : 1 }],
        },
        style,
      ]}
      ref={pressableRef as any}
    >
      <BlurView
        intensity={blurIntensity}
        tint="dark"
        style={StyleSheet.absoluteFill}
      >
        <View style={[styles.blurFallback, { backgroundColor: blurFallbackColor }]} />
      </BlurView>

      {glow ? (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <View style={[styles.colorBlob1, { backgroundColor: primaryHaze }]} />
          <View style={[styles.colorBlob2, { backgroundColor: secondaryHaze }]} />
          <View style={[styles.surfaceWash, { backgroundColor: neutralWash }]} />
        </View>
      ) : null}

      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {ripples.map((ripple) => (
          <Animated.View
            key={ripple.id}
            style={[
              styles.rippleWrap,
              {
                width: ripple.size,
                height: ripple.size,
                left: ripple.x - ripple.size / 2,
                top: ripple.y - ripple.size / 2,
                opacity: ripple.opacity,
                transform: [{ scale: ripple.scale }],
              },
            ]}
          >
            <Svg width={ripple.size} height={ripple.size}>
              <Defs>
                <RadialGradient id={gradientId} cx="50%" cy="50%" r="50%">
                  <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.8" />
                  <Stop offset="100%" stopColor={t.accentLight || t.accent} stopOpacity="0" />
                </RadialGradient>
              </Defs>
              <Circle
                cx={ripple.size / 2}
                cy={ripple.size / 2}
                r={ripple.size / 2}
                fill={`url(#${gradientId})`}
              />
            </Svg>
          </Animated.View>
        ))}
      </View>

      <View style={[styles.content, contentStyle]}>{children}</View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    borderWidth: 1,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 8,
  },
  blurFallback: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  colorBlob1: {
    position: 'absolute',
    top: -20,
    right: -20,
    width: 128,
    height: 128,
    borderRadius: 999,
    opacity: 0.2,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 60,
    elevation: 0,
  },
  colorBlob2: {
    position: 'absolute',
    bottom: -10,
    left: -10,
    width: 96,
    height: 96,
    borderRadius: 999,
    opacity: 0.15,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 50,
    elevation: 0,
  },
  surfaceWash: {
    ...StyleSheet.absoluteFillObject,
  },
  content: {
    padding: 20,
  },
  rippleWrap: {
    position: 'absolute',
  },
});

export default LiquidGlass;

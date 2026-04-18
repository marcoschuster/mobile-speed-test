import React, { ReactNode } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { RADIUS, useTheme, withAlpha } from '../utils/theme';

type GlassVariant = 'panel' | 'strong' | 'button' | 'chrome';
type EdgeFade = 'none' | 'top' | 'bottom' | 'both';

interface GlassSurfaceProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  radius?: number;
  variant?: GlassVariant;
  edgeFade?: EdgeFade;
  tintColor?: string;
}

const getVariantBackground = (variant: GlassVariant, t: Record<string, any>) => {
  switch (variant) {
    case 'strong':
      return t.surfaceElevated;
    case 'button':
      return t.glass;
    case 'chrome':
      return t.glassStrong;
    case 'panel':
    default:
      return t.surface;
  }
};

const getVariantBorder = (variant: GlassVariant, t: Record<string, any>) => {
  switch (variant) {
    case 'button':
      return t.glassBorderAccent;
    case 'strong':
      return t.glassBorderStrong;
    case 'chrome':
      return t.glassBorder;
    case 'panel':
    default:
      return t.glassBorder;
  }
};

const getVariantShadow = (variant: GlassVariant) => {
  if (variant === 'button') {
    return {
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.18,
      shadowRadius: 20,
      elevation: 10,
    };
  }

  return {
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.2,
    shadowRadius: 28,
    elevation: 14,
  };
};

const GlassSurface = ({
  children,
  style,
  radius,
  variant = 'panel',
  edgeFade = 'none',
  tintColor,
}: GlassSurfaceProps) => {
  const { t } = useTheme();
  const flattened = StyleSheet.flatten(style) || {};
  const borderRadius = radius ?? flattened.borderRadius ?? RADIUS.lg;
  const primaryTone = withAlpha(tintColor || t.accentLight || t.accent, t.mode === 'dark' ? 0.22 : 0.14);
  const secondaryTone = withAlpha(t.uploadLine || t.accent, t.mode === 'dark' ? 0.16 : 0.1);
  const washTone = withAlpha('#FFFFFF', t.mode === 'dark' ? 0.04 : 0.08);
  const primaryId = `glass-surface-primary-${borderRadius}-${tintColor || t.accent}`;
  const secondaryId = `glass-surface-secondary-${borderRadius}-${t.uploadLine}`;

  return (
    <View
      style={[
        getVariantShadow(variant),
        style,
        {
          overflow: 'hidden',
          borderRadius,
          borderWidth: 1,
          borderColor: getVariantBorder(variant, t),
          backgroundColor: getVariantBackground(variant, t),
          shadowColor: t.glassShadow,
        },
      ]}
    >
      <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
        <Svg width="100%" height="100%" style={StyleSheet.absoluteFillObject}>
          <Defs>
            <RadialGradient id={primaryId} cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor={primaryTone} stopOpacity="1" />
              <Stop offset="100%" stopColor={primaryTone} stopOpacity="0" />
            </RadialGradient>
            <RadialGradient id={secondaryId} cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor={secondaryTone} stopOpacity="1" />
              <Stop offset="100%" stopColor={secondaryTone} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Circle cx="28%" cy="30%" r="44%" fill={`url(#${primaryId})`} />
          <Circle cx="78%" cy="70%" r="34%" fill={`url(#${secondaryId})`} />
        </Svg>
        <View style={[styles.surfaceWash, { backgroundColor: washTone }]} />
      </View>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  surfaceWash: {
    ...StyleSheet.absoluteFillObject,
  },
});

export default GlassSurface;

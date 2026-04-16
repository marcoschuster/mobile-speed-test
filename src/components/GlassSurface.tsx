import React, { ReactNode } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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
  const tintStrength = variant === 'button' ? 0.16 : 0.1;

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
      <LinearGradient
        pointerEvents="none"
        colors={[t.glassHighlight, 'transparent', t.glassGlow]}
        start={{ x: 0.05, y: 0 }}
        end={{ x: 0.95, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      <LinearGradient
        pointerEvents="none"
        colors={[t.glassSoft, 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      {tintColor ? (
        <LinearGradient
          pointerEvents="none"
          colors={[withAlpha(tintColor, tintStrength), 'transparent']}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
      ) : null}
      <View
        pointerEvents="none"
        style={[
          styles.topRim,
          {
            borderTopLeftRadius: borderRadius,
            borderTopRightRadius: borderRadius,
            backgroundColor: t.glassBorderTop,
          },
        ]}
      />
      {(edgeFade === 'top' || edgeFade === 'both') ? (
        <LinearGradient
          pointerEvents="none"
          colors={[t.chromeFadeEdge, 'transparent']}
          style={[styles.edgeFade, styles.edgeFadeTop]}
        />
      ) : null}
      {(edgeFade === 'bottom' || edgeFade === 'both') ? (
        <LinearGradient
          pointerEvents="none"
          colors={['transparent', t.chromeFadeEdge]}
          style={[styles.edgeFade, styles.edgeFadeBottom]}
        />
      ) : null}
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  topRim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
  },
  edgeFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 16,
  },
  edgeFadeTop: {
    top: 0,
  },
  edgeFadeBottom: {
    bottom: 0,
  },
});

export default GlassSurface;

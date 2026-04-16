import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Platform } from 'react-native';
import { COLORS, useTheme } from '../utils/theme';

const FONT_FAMILY = Platform.OS === 'ios' ? 'System' : 'sans-serif';

/**
 * FlashTitle — A 3D-styled title with yellow/black/grey colours
 * and a periodic specular flash sweep that follows the text shape.
 *
 * The flash is a bright copy of the text clipped through a narrow
 * travelling window so only the letters light up — not the background.
 *
 * Props:
 * - text:     string
 * - size:     'large' | 'medium' | 'small'
 * - interval: ms between flashes (default 5000)
 * - style:    additional container styles
 * - center:   boolean — centre the title (default false)
 * - glow:     boolean — add a dim yellow glow behind the text (default false)
 * - disableFlash: boolean — disable the flash animation (default false)
 */
const FlashTitle = ({
  text,
  size = 'medium',
  interval = 5000,
  style,
  center = false,
  glow = false,
  disableFlash = false,
}) => {
  const { t } = useTheme();
  const isDark = t.mode === 'dark';
  const [textWidth, setTextWidth] = React.useState(0);

  const flashPos = useRef(new Animated.Value(0)).current;
  const flashOpacity = useRef(new Animated.Value(0)).current;

  const FLASH_WIDTH = 45; // width of the bright slit

  useEffect(() => {
    if (textWidth === 0 || disableFlash) return;

    const startX = -FLASH_WIDTH;
    const endX = textWidth + FLASH_WIDTH;
    const travel = endX - startX;
    // Duration scales with text length so speed feels consistent
    const duration = Math.max(500, Math.min(900, travel * 2.2));

    const runFlash = () => {
      flashPos.setValue(startX);
      flashOpacity.setValue(0);

      Animated.sequence([
        Animated.delay(interval),
        Animated.parallel([
          Animated.timing(flashPos, {
            toValue: endX,
            duration,
            useNativeDriver: false,
          }),
          // Quick fade-in then hold, fade out near the end
          Animated.sequence([
            Animated.timing(flashOpacity, {
              toValue: 1,
              duration: duration * 0.12,
              useNativeDriver: false,
            }),
            Animated.timing(flashOpacity, {
              toValue: 1,
              duration: duration * 0.65,
              useNativeDriver: false,
            }),
            Animated.timing(flashOpacity, {
              toValue: 0,
              duration: duration * 0.23,
              useNativeDriver: false,
            }),
          ]),
        ]),
      ]).start(() => runFlash());
    };

    runFlash();
    return () => {
      flashPos.stopAnimation();
      flashOpacity.stopAnimation();
    };
  }, [textWidth, interval, disableFlash]);

  const onTextLayout = (e) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && w !== textWidth) setTextWidth(w);
  };

  // Size presets
  const sizeMap = {
    large:  { fontSize: 18, letterSpacing: 2, lineHeight: 26 },
    medium: { fontSize: 15, letterSpacing: 2.5, lineHeight: 21 },
    small:  { fontSize: 13, letterSpacing: 2, lineHeight: 18 },
  };
  const s = sizeMap[size] || sizeMap.medium;

  // 3D text colours — from theme tokens
  const shadowColor = t.flashShadow;
  const highlightColor = t.flashHighlight;
  const highlightOpacity = t.flashHighlightOpacity;
  const flashColor = t.flashColor;

  const textStyle = {
    fontFamily: FONT_FAMILY,
    fontSize: s.fontSize,
    letterSpacing: s.letterSpacing,
    lineHeight: s.lineHeight,
    fontWeight: '900',
  };

  return (
    <View
      style={[
        styles.container,
        center && styles.centered,
        style,
      ]}
    >
      {/* Layer 1: Shadow — offset down-right for cast shadow */}
      <Text
        style={[textStyle, styles.absLayer, { color: shadowColor, left: 1, top: 1.2 }]}
        numberOfLines={1}
      >
        {text}
      </Text>

      {/* Layer 2: Highlight — offset up-left for bevel edge */}
      <Text
        style={[textStyle, styles.absLayer, {
          color: highlightColor,
          opacity: highlightOpacity,
          left: -0.5,
          top: -0.5,
        }]}
        numberOfLines={1}
      >
        {text}
      </Text>

      {/* Layer 3a: Yellow glow halo (only when glow=true) */}
      {glow && (
        <Text
          style={[textStyle, styles.absLayer, {
            color: 'transparent',
            textShadowColor: isDark ? 'rgba(245,196,0,0.5)' : 'rgba(245,196,0,0.7)',
            textShadowOffset: { width: 0, height: 0 },
            textShadowRadius: 14,
            left: 0,
            top: 0,
          }]}
          numberOfLines={1}
        >
          {text}
        </Text>
      )}

      {/* Layer 3b: Main yellow text (determines layout size) */}
      <Text
        style={[textStyle, {
          color: t.accent,
          textShadowColor: isDark ? 'rgba(0,0,0,0.7)' : 'rgba(0, 0, 0, 0.2)',
          textShadowOffset: { width: 0, height: 1 },
          textShadowRadius: 1.5,
        }]}
        numberOfLines={1}
        onLayout={onTextLayout}
      >
        {text}
      </Text>

      {/* Layer 4: Specular flash — narrow clip window travels left→right.
          Inside, the bright text is counter-positioned so it stays aligned
          with the base text. The window reveals a bright slit that sweeps
          across the letter shapes. */}
      {textWidth > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.absLayer,
            {
              left: 0,
              top: 0,
              width: FLASH_WIDTH,
              height: s.lineHeight + 4,
              overflow: 'hidden',
              opacity: flashOpacity,
              transform: [{ translateX: flashPos }],
            },
          ]}
        >
          {/* Inner text — shifted left by flashPos so it stays
              registered with the real text underneath */}
          <Animated.View
            style={{
              width: textWidth + 20,
              transform: [{ translateX: Animated.multiply(flashPos, -1) }],
            }}
          >
            <Text
              style={[textStyle, {
                color: flashColor,
                textShadowColor: t.accent,
                textShadowOffset: { width: 0, height: 0 },
                textShadowRadius: 8,
                width: textWidth + 20,
              }]}
              numberOfLines={1}
            >
              {text}
            </Text>
          </Animated.View>
        </Animated.View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignSelf: 'flex-start',
  },
  centered: {
    alignSelf: 'center',
  },
  absLayer: {
    position: 'absolute',
  },
});

export default FlashTitle;

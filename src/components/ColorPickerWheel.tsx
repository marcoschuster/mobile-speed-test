import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  PanResponder,
  TouchableOpacity,
  Modal,
  Text,
  Easing,
  GestureResponderEvent,
  PanResponderGestureState,
} from 'react-native';
import { COLOR_THEMES, useTheme } from '../utils/theme';
import SoundEngine from '../services/SoundEngine';

// ── Type Definitions ─────────────────────────────────────────────────────────
interface ColorPickerWheelProps {
  visible: boolean;
  onClose: () => void;
  onColorSelect: (colorId: string) => void;
  currentColorId: string;
}

const WHEEL_SIZE = 264;
const WHEEL_RADIUS = WHEEL_SIZE / 2;
const SEGMENT_SIZE = 48;
const POINTER_ANGLE = -90;
const DRAG_DISTANCE_PER_SEGMENT = 95;

const normalizeIndex = (index: number): number => {
  const total = COLOR_THEMES.length;
  return ((index % total) + total) % total;
};

const ColorPickerWheel = ({ visible, onClose, onColorSelect, currentColorId }: ColorPickerWheelProps) => {
  const { t } = useTheme();
  const rotationRef = useRef(0);
  const dragStartRotation = useRef(0);
  const wheelRotation = useRef(new Animated.Value(0)).current;
  const committedIndex = useRef(0);
  const [previewIndex, setPreviewIndex] = useState(0);
  const segmentAngle = 360 / COLOR_THEMES.length;

  const getIndexFromRotation = (rotation: number): number => {
    const nextIndex = normalizeIndex(Math.round(-rotation / segmentAngle));
    return nextIndex;
  };

  const syncPreviewToRotation = (rotation: number): number => {
    const nextIndex = getIndexFromRotation(rotation);
    setPreviewIndex((current) => (current === nextIndex ? current : nextIndex));
    return nextIndex;
  };

  const commitThemeIndex = (index: number): number => {
    const normalized = normalizeIndex(index);
    committedIndex.current = normalized;
    setPreviewIndex(normalized);
    const theme = COLOR_THEMES[normalized];
    if (theme && theme.id !== currentColorId) {
      onColorSelect(theme.id);
    }
    return normalized;
  };

  useEffect(() => {
    const currentIndex = COLOR_THEMES.findIndex((theme) => theme.id === currentColorId);
    if (currentIndex === -1) return;

    committedIndex.current = currentIndex;
    setPreviewIndex(currentIndex);
    const targetRotation = -currentIndex * segmentAngle;
    rotationRef.current = targetRotation;
    wheelRotation.setValue(targetRotation);
  }, [currentColorId, segmentAngle, visible, wheelRotation]);

  const getRotationFromGesture = (gestureState: PanResponderGestureState): number => {
    const dominantDelta = Math.abs(gestureState.dx) >= Math.abs(gestureState.dy)
      ? gestureState.dx
      : -gestureState.dy;

    return dragStartRotation.current + (dominantDelta / DRAG_DISTANCE_PER_SEGMENT) * segmentAngle;
  };

  const handlePanGrant = () => {
    dragStartRotation.current = rotationRef.current;
  };

  const handlePanMove = (gestureState: PanResponderGestureState) => {
    const nextRotation = getRotationFromGesture(gestureState);
    wheelRotation.setValue(nextRotation);
    syncPreviewToRotation(nextRotation);
  };

  const animateToIndex = (index: number, shouldCommit: boolean = true): void => {
    const normalized = normalizeIndex(index);
    const targetRotation = -normalized * segmentAngle;

    Animated.timing(wheelRotation, {
      toValue: targetRotation,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(() => {
      rotationRef.current = targetRotation;
      setPreviewIndex(normalized);
      if (shouldCommit) {
        commitThemeIndex(normalized);
        SoundEngine.playNavTick();
      }
    });
  };

  const handlePanEnd = (gestureState: PanResponderGestureState): void => {
    const nextRotation = getRotationFromGesture(gestureState);
    const nextIndex = getIndexFromRotation(nextRotation);
    animateToIndex(nextIndex);
  };

  const handleSegmentPress = (index: number): void => {
    animateToIndex(index);
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_: GestureResponderEvent, gestureState: PanResponderGestureState) => Math.abs(gestureState.dx) > 6 || Math.abs(gestureState.dy) > 6,
      onPanResponderGrant: handlePanGrant,
      onPanResponderMove: (_: GestureResponderEvent, gestureState: PanResponderGestureState) => handlePanMove(gestureState),
      onPanResponderRelease: (_: GestureResponderEvent, gestureState: PanResponderGestureState) => handlePanEnd(gestureState),
      onPanResponderTerminate: (_: GestureResponderEvent, gestureState: PanResponderGestureState) => handlePanEnd(gestureState),
      onPanResponderTerminationRequest: () => true,
    }),
  ).current;

  const rotationString = wheelRotation.interpolate({
    inputRange: [-720, 720],
    outputRange: ['-720deg', '720deg'],
  });

  const activeTheme = COLOR_THEMES[previewIndex] || COLOR_THEMES[0];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: t.headerBg }]}>
          <Text style={[styles.title, { color: t.textPrimary }]}>Swipe Left, Right, Up, Or Down</Text>
          <Text style={[styles.subtitle, { color: t.textSecondary }]}>
            {activeTheme.name}
          </Text>

          <View style={styles.wheelContainer} {...panResponder.panHandlers}>
            <Animated.View
              style={[styles.wheelWrapper, { backgroundColor: t.surface, transform: [{ rotate: rotationString }] }]}
            >
              {COLOR_THEMES.map((theme, index) => {
                const angle = POINTER_ANGLE + index * segmentAngle;
                const radians = (angle * Math.PI) / 180;
                const orbit = WHEEL_RADIUS - 34;
                const x = WHEEL_RADIUS + orbit * Math.cos(radians) - SEGMENT_SIZE / 2;
                const y = WHEEL_RADIUS + orbit * Math.sin(radians) - SEGMENT_SIZE / 2;

                return (
                  <TouchableOpacity
                    key={theme.id}
                    activeOpacity={0.9}
                    onPress={() => handleSegmentPress(index)}
                    hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
                    style={[
                      styles.colorSegment,
                      {
                        left: x,
                        top: y,
                        backgroundColor: theme.accent,
                        borderColor: theme.id === activeTheme.id ? t.textPrimary : 'rgba(255,255,255,0.18)',
                        transform: [{ scale: theme.id === activeTheme.id ? 1.08 : 1 }],
                      },
                    ]}
                  />
                );
              })}
            </Animated.View>

            <View style={styles.centerPreview}>
              <View style={[styles.centerPreviewSwatch, { backgroundColor: activeTheme.accent, borderColor: t.textPrimary }]} />
            </View>

            <View style={styles.arrowContainer}>
              <View style={[styles.arrow, { borderBottomColor: t.textPrimary }]} />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.closeButton, { backgroundColor: t.surface, borderColor: t.accent }]}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <Text style={[styles.closeText, { color: t.accent }]}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  container: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 20,
    paddingBottom: 40,
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 18,
  },
  wheelContainer: {
    width: WHEEL_SIZE,
    height: WHEEL_SIZE,
    marginBottom: 30,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  wheelWrapper: {
    width: WHEEL_SIZE,
    height: WHEEL_SIZE,
    borderRadius: WHEEL_RADIUS,
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  colorSegment: {
    position: 'absolute',
    width: SEGMENT_SIZE,
    height: SEGMENT_SIZE,
    borderRadius: SEGMENT_SIZE / 2,
    borderWidth: 3,
    zIndex: 2,
  },
  centerPreview: {
    position: 'absolute',
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: 'rgba(0,0,0,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerPreviewSwatch: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 3,
  },
  arrowContainer: {
    position: 'absolute',
    top: -4,
    left: WHEEL_RADIUS,
    transform: [{ translateX: -12 }],
    zIndex: 10,
  },
  arrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 12,
    borderRightWidth: 12,
    borderBottomWidth: 20,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  closeButton: {
    paddingHorizontal: 40,
    paddingVertical: 14,
    borderRadius: 25,
    minWidth: 120,
    alignItems: 'center',
    borderWidth: 1.5,
  },
  closeText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});

export default ColorPickerWheel;

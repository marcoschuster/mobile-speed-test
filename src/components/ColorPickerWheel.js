import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  PanResponder,
  TouchableOpacity,
  Modal,
  Text,
} from 'react-native';
import { COLOR_THEMES } from '../utils/theme';
import { useTheme } from '../utils/theme';
import SoundEngine from '../services/SoundEngine';

const ColorPickerWheel = ({ visible, onClose, onColorSelect, currentColorId }) => {
  const { t } = useTheme();
  const rotationRef = useRef(0);
  const wheelRotation = useRef(new Animated.Value(0)).current;
  const selectedIndex = useRef(0);

  const SEGMENT_ANGLE = 360 / COLOR_THEMES.length;
  const WHEEL_RADIUS = 120;

  // Find current color index
  useEffect(() => {
    const currentIndex = COLOR_THEMES.findIndex(ct => ct.id === currentColorId);
    if (currentIndex !== -1) {
      selectedIndex.current = currentIndex;
      const targetRotation = -currentIndex * SEGMENT_ANGLE;
      rotationRef.current = targetRotation;
      wheelRotation.setValue(targetRotation);
    }
  }, [currentColorId]);

  const handlePanMove = (gestureState) => {
    const { translationX } = gestureState;
    const angle = (translationX / 300) * 360;
    const newRotation = rotationRef.current + angle;
    wheelRotation.setValue(newRotation);
    
    // Calculate current segment
    const segmentIndex = Math.round(-newRotation / SEGMENT_ANGLE);
    const clampedIndex = Math.max(0, Math.min(COLOR_THEMES.length - 1, segmentIndex));
    
    // Update theme dynamically as wheel rotates
    if (clampedIndex !== selectedIndex.current) {
      selectedIndex.current = clampedIndex;
      const theme = COLOR_THEMES[clampedIndex];
      if (theme) {
        onColorSelect(theme.id);
      }
    }
  };

  const handlePanEnd = (gestureState) => {
    const { translationX } = gestureState;
    
    // Calculate snap to nearest segment
    const currentRotation = rotationRef.current + (translationX / 300) * 360;
    const segmentIndex = Math.round(-currentRotation / SEGMENT_ANGLE);
    const clampedIndex = Math.max(0, Math.min(COLOR_THEMES.length - 1, segmentIndex));
    
    const targetRotation = -clampedIndex * SEGMENT_ANGLE;
    
    // Animate to snap position
    Animated.spring(wheelRotation, {
      toValue: targetRotation,
      tension: 100,
      friction: 8,
      useNativeDriver: true,
    }).start(() => {
      rotationRef.current = targetRotation;
      selectedIndex.current = clampedIndex;
      SoundEngine.playNavTick();
    });
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (e, gestureState) => handlePanMove(gestureState),
      onPanResponderRelease: (e, gestureState) => handlePanEnd(gestureState),
    })
  ).current;

  const rotationString = wheelRotation.interpolate({
    inputRange: [0, 360],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Wheel Container */}
          <View style={styles.wheelContainer} {...panResponder.panHandlers}>
            {/* Half-circle wheel */}
            <Animated.View
              style={[
                styles.wheelWrapper,
                { transform: [{ rotate: rotationString }] },
              ]}
            >
              {COLOR_THEMES.map((theme, index) => {
                const startAngle = index * SEGMENT_ANGLE;
                const endAngle = startAngle + SEGMENT_ANGLE;
                const midAngle = startAngle + SEGMENT_ANGLE / 2;
                
                const x = WHEEL_RADIUS + (WHEEL_RADIUS - 30) * Math.cos((midAngle * Math.PI) / 180);
                const y = WHEEL_RADIUS + (WHEEL_RADIUS - 30) * Math.sin((midAngle * Math.PI) / 180);
                
                return (
                  <View
                    key={theme.id}
                    style={[
                      styles.colorSegment,
                      {
                        backgroundColor: theme.accent,
                        left: x - 25,
                        top: y - 25,
                      },
                    ]}
                  />
                );
              })}
            </Animated.View>

            {/* Center arrow indicator */}
            <View style={styles.arrowContainer}>
              <View style={[styles.arrow, { borderTopColor: t.textPrimary }]} />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.closeButton, { backgroundColor: t.surface }]}
            onPress={onClose}
          >
            <Text style={[styles.closeText, { color: t.textPrimary }]}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#141414',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 20,
    paddingBottom: 40,
    alignItems: 'center',
  },
  wheelContainer: {
    width: 240,
    height: 240,
    marginBottom: 30,
    position: 'relative',
  },
  wheelWrapper: {
    width: 240,
    height: 240,
    borderRadius: 120,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#1a1a1a',
  },
  colorSegment: {
    position: 'absolute',
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  arrowContainer: {
    position: 'absolute',
    top: 0,
    left: 120,
    transform: [{ translateX: -12 }],
    zIndex: 10,
  },
  arrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 12,
    borderRightWidth: 12,
    borderTopWidth: 20,
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
  },
  closeText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});

export default ColorPickerWheel;

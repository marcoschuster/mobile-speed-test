import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  PanResponder,
  TouchableOpacity,
  Dimensions,
  Modal,
} from 'react-native';
import Svg, { Path, Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { COLOR_THEMES } from '../utils/theme';
import { useTheme } from '../utils/theme';
import SoundEngine from '../services/SoundEngine';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const ColorPickerWheel = ({ visible, onClose, onColorSelect, currentColorId }) => {
  const { t } = useTheme();
  const [rotation, setRotation] = useState(0);
  const rotationRef = useRef(0);
  const wheelRotation = useRef(new Animated.Value(0)).current;
  const selectedIndex = useRef(0);

  const SEGMENT_ANGLE = 360 / COLOR_THEMES.length;
  const WHEEL_RADIUS = 140;
  const WHEEL_DIAMETER = WHEEL_RADIUS * 2;

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

  const handlePan = Animated.event(
    [{ nativeEvent: { translationX: dx } }],
    {
      useNativeDriver: true,
      listener: ({ nativeEvent }) => {
        const angle = (nativeEvent.translationX / SCREEN_WIDTH) * 360;
        const newRotation = rotationRef.current + angle;
        wheelRotation.setValue(newRotation);
      },
    }
  );

  const handlePanEnd = (gestureState) => {
    const { translationX, velocityX } = gestureState;
    
    // Calculate snap to nearest segment
    const currentRotation = rotationRef.current + translationX / SCREEN_WIDTH * 360;
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
      
      // Select the color
      const selectedTheme = COLOR_THEMES[clampedIndex];
      if (selectedTheme && selectedTheme.id !== currentColorId) {
        SoundEngine.playNavTick();
        onColorSelect(selectedTheme.id);
      }
    });
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: handlePan,
      onPanResponderRelease: (e, gestureState) => handlePanEnd(gestureState),
    })
  ).current;

  // Create wheel segments
  const createWheelSegments = () => {
    const segments = [];
    for (let i = 0; i < COLOR_THEMES.length; i++) {
      const startAngle = i * SEGMENT_ANGLE;
      const endAngle = startAngle + SEGMENT_ANGLE;
      
      const startRad = (startAngle * Math.PI) / 180;
      const endRad = (endAngle * Math.PI) / 180;
      
      const x1 = WHEEL_RADIUS + WHEEL_RADIUS * Math.cos(startRad);
      const y1 = WHEEL_RADIUS + WHEEL_RADIUS * Math.sin(startRad);
      const x2 = WHEEL_RADIUS + WHEEL_RADIUS * Math.cos(endRad);
      const y2 = WHEEL_RADIUS + WHEEL_RADIUS * Math.sin(endRad);
      
      const largeArcFlag = SEGMENT_ANGLE > 180 ? 1 : 0;
      
      const path = `M${WHEEL_RADIUS},${WHEEL_RADIUS} L${x1},${y1} A${WHEEL_RADIUS},${WHEEL_RADIUS} 0 ${largeArcFlag},1 ${x2},${y2} Z`;
      
      segments.push(
        <Path
          key={i}
          d={path}
          fill={COLOR_THEMES[i].accent}
          stroke={t.bg}
          strokeWidth="2"
        />
      );
    }
    return segments;
  };

  const handleColorPress = (index) => {
    SoundEngine.playNavTick();
    const targetRotation = -index * SEGMENT_ANGLE;
    rotationRef.current = targetRotation;
    selectedIndex.current = index;
    
    Animated.spring(wheelRotation, {
      toValue: targetRotation,
      tension: 100,
      friction: 8,
      useNativeDriver: true,
    }).start(() => {
      onColorSelect(COLOR_THEMES[index].id);
    });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={styles.container}>
          <TouchableOpacity
            activeOpacity={1}
            style={styles.wheelContainer}
            {...panResponder.panHandlers}
          >
            {/* Half-circle wheel */}
            <Animated.View
              style={[
                styles.wheelWrapper,
                { transform: [{ rotate: wheelRotation }] },
              ]}
            >
              <Svg width={WHEEL_DIAMETER} height={WHEEL_DIAMETER}>
                <Defs>
                  <LinearGradient id="wheelGradient" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0%" stopColor={t.bg} stopOpacity="0.3" />
                    <Stop offset="100%" stopColor={t.bg} stopOpacity="0.1" />
                  </LinearGradient>
                </Defs>
                {/* Only show top half (wheel of fortune style) */}
                <Circle
                  cx={WHEEL_RADIUS}
                  cy={WHEEL_RADIUS}
                  r={WHEEL_RADIUS}
                  fill={t.bg}
                />
                {createWheelSegments()}
              </Svg>
            </Animated.View>

            {/* Center arrow indicator */}
            <View style={styles.arrowContainer}>
              <View style={[styles.arrow, { borderTopColor: t.textPrimary }]} />
            </View>
          </TouchableOpacity>

          {/* Quick select buttons */}
          <View style={styles.quickSelect}>
            {COLOR_THEMES.map((theme, index) => (
              <TouchableOpacity
                key={theme.id}
                style={[
                  styles.colorButton,
                  { backgroundColor: theme.accent },
                  currentColorId === theme.id && styles.colorButtonActive,
                ]}
                onPress={() => handleColorPress(index)}
                activeOpacity={0.8}
              />
            ))}
          </View>

          <TouchableOpacity
            style={[styles.closeButton, { backgroundColor: t.surface }]}
            onPress={onClose}
          >
            <View style={[styles.closeText, { color: t.textPrimary }]}>Done</View>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
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
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 30,
  },
  wheelWrapper: {
    width: 280,
    height: 280,
    borderRadius: 140,
    overflow: 'hidden',
  },
  arrowContainer: {
    position: 'absolute',
    top: -10,
    alignItems: 'center',
  },
  arrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 15,
    borderRightWidth: 15,
    borderTopWidth: 25,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  quickSelect: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 20,
  },
  colorButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorButtonActive: {
    borderColor: '#FFFFFF',
    borderWidth: 3,
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

import React from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const SpeedCircle = ({ speed, type, isTesting }) => {
  const animatedValue = React.useRef(new Animated.Value(0)).current;
  
  React.useEffect(() => {
    if (isTesting) {
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(animatedValue, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(animatedValue, {
            toValue: 0,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      pulseAnimation.start();
      
      return () => pulseAnimation.stop();
    } else {
      animatedValue.setValue(0);
    }
  }, [isTesting, animatedValue]);

  const scale = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.05],
  });

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.speedCircle,
          {
            transform: [{ scale }],
          },
        ]}
      >
        <LinearGradient
          colors={['#667eea', '#764ba2']}
          style={styles.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.speedContent}>
            <Text style={styles.speedValue}>
              {typeof speed === 'number' ? speed.toFixed(2) : speed}
            </Text>
            <Text style={styles.speedUnit}>Mbps</Text>
            <Text style={styles.speedType}>{type}</Text>
          </View>
        </LinearGradient>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 20,
  },
  speedCircle: {
    width: 200,
    height: 200,
    borderRadius: 100,
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
  },
  gradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  speedContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  speedValue: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
    lineHeight: 40,
  },
  speedUnit: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.8,
    marginTop: -5,
  },
  speedType: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
    marginTop: 8,
  },
});

export default SpeedCircle;

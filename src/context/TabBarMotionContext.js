import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Animated } from 'react-native';

const TabBarMotionContext = createContext(null);

export const TabBarMotionProvider = ({ children }) => {
  const translateY = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const modeRef = useRef('expanded');
  const [mode, setMode] = useState('expanded');

  const setTabBarMode = useCallback((mode) => {
    if (modeRef.current === mode) {
      return;
    }

    modeRef.current = mode;
    setMode(mode);
    const isCompact = mode === 'compact';
    const isHidden = mode === 'hidden';

    Animated.parallel([
      Animated.spring(translateY, {
        toValue: isHidden ? 100 : (isCompact ? 12 : -2),
        tension: 160,
        friction: 22,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: isHidden ? 0.9 : (isCompact ? 0.96 : 1),
        tension: 180,
        friction: 20,
        useNativeDriver: true,
      }),
      Animated.spring(opacity, {
        toValue: isHidden ? 0 : 1,
        tension: 160,
        friction: 22,
        useNativeDriver: true,
      }),
    ]).start();
  }, [scale, translateY, opacity]);

  const value = useMemo(() => ({
    tabBarTranslateY: translateY,
    tabBarScale: scale,
    tabBarOpacity: opacity,
    tabBarMode: mode,
    setTabBarMode,
  }), [mode, scale, opacity, setTabBarMode, translateY]);

  return (
    <TabBarMotionContext.Provider value={value}>
      {children}
    </TabBarMotionContext.Provider>
  );
};

export const useTabBarMotion = () => {
  const context = useContext(TabBarMotionContext);

  if (!context) {
    throw new Error('useTabBarMotion must be used within a TabBarMotionProvider');
  }

  return context;
};

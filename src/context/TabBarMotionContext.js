import React, { createContext, useCallback, useContext, useMemo, useRef } from 'react';
import { Animated } from 'react-native';

const TabBarMotionContext = createContext(null);

export const TabBarMotionProvider = ({ children }) => {
  const translateY = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const modeRef = useRef('expanded');

  const setTabBarMode = useCallback((mode) => {
    if (modeRef.current === mode) {
      return;
    }

    modeRef.current = mode;
    const isCompact = mode === 'compact';

    Animated.parallel([
      Animated.spring(translateY, {
        toValue: isCompact ? 12 : -2,
        tension: 160,
        friction: 22,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: isCompact ? 0.96 : 1,
        tension: 180,
        friction: 20,
        useNativeDriver: true,
      }),
    ]).start();
  }, [scale, translateY]);

  const value = useMemo(() => ({
    tabBarTranslateY: translateY,
    tabBarScale: scale,
    setTabBarMode,
  }), [scale, setTabBarMode, translateY]);

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

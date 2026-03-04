// ─────────────────────────────────────────────────────────────────────────────
// ZOLT — Premium Design System
// Inspired by McLaren, Apple, n8n, landonorris.com
// ─────────────────────────────────────────────────────────────────────────────

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Static palette (never changes) ─────────────────────────────────────────
export const COLORS = {
  accent: '#F5C400',
  accentDark: '#D4A900',
  accentLight: '#FFD633',
  accentGlow: 'rgba(245, 196, 0, 0.35)',
  accentSubtle: 'rgba(245, 196, 0, 0.08)',

  navBar: '#111111',
  navActive: '#F5C400',
  navInactive: '#666666',
  headerBg: '#111111',
  headerText: '#FFFFFF',

  danger: '#FF4444',
  success: '#00C48C',
  warning: '#F5C400',

  white: '#FFFFFF',
  black: '#000000',
};

// ── Theme-aware palettes ────────────────────────────────────────────────────
const DARK = {
  mode: 'dark',
  bg: '#1A1A1A',
  surface: '#242424',
  surfaceElevated: '#2C2C2C',
  glass: 'rgba(36, 36, 36, 0.85)',
  glassBorder: 'rgba(255, 255, 255, 0.08)',
  glassBorderTop: 'rgba(255,255,255,0.12)',
  textPrimary: '#F0F0F0',
  textSecondary: '#999999',
  textMuted: '#888888',
  separator: 'rgba(255, 255, 255, 0.06)',

  // Speedometer
  dialOuter: '#111111',
  bezelTop: '#444444',
  bezelMid: '#222222',
  bezelBottom: '#111111',
  bezelShine: 'rgba(255,255,255,0.12)',
  dialInnerRing: '#181818',
  dialRim: '#222222',
  dialFaceCenter: '#2A2A2A',
  dialFaceEdge: '#1A1A1A',
  trackArc: '#333333',
  tickMajor: '#888888',
  tickMinor: '#444444',
  tickLabel: '#999999',
  hubInner: '#1A1A1A',
  unitLabel: '#777777',

  // Charts
  gridLine: 'rgba(255,255,255,0.05)',
  axisLine: 'rgba(255,255,255,0.1)',
  axisLabel: '#888888',
  axisLabelSub: '#666666',
  uploadLine: '#E0E0E0',

  // Settings controls
  controlBg: '#222222',
  controlBorder: '#333333',
  controlSepLight: 'rgba(255,255,255,0.04)',
  switchTrackOff: '#333333',
  switchThumbOff: '#888888',
  placeholderText: '#555555',

  // Empty state bolt
  emptyBolt: '#333333',
};

const LIGHT = {
  mode: 'light',
  bg: '#F7F7F7',
  surface: '#FFFFFF',
  surfaceElevated: '#F0F0F0',
  glass: 'rgba(255, 255, 255, 0.80)',
  glassBorder: 'rgba(0, 0, 0, 0.06)',
  glassBorderTop: 'rgba(255,255,255,0.7)',
  textPrimary: '#111111',
  textSecondary: '#666666',
  textMuted: '#AAAAAA',
  separator: 'rgba(0, 0, 0, 0.06)',

  // Speedometer — light-mode bezel is reversed: light face, darker border ring
  dialOuter: '#D0D0D0',
  bezelTop: '#E8E8E8',
  bezelMid: '#D0D0D0',
  bezelBottom: '#B8B8B8',
  bezelShine: 'rgba(255,255,255,0.6)',
  dialInnerRing: '#C8C8C8',
  dialRim: '#E0E0E0',
  dialFaceCenter: '#FAFAFA',
  dialFaceEdge: '#F0F0F0',
  trackArc: '#D8D8D8',
  tickMajor: '#555555',
  tickMinor: '#BBBBBB',
  tickLabel: '#666666',
  hubInner: '#FFFFFF',
  unitLabel: '#888888',

  // Charts
  gridLine: 'rgba(0,0,0,0.06)',
  axisLine: 'rgba(0,0,0,0.12)',
  axisLabel: '#999999',
  axisLabelSub: '#BBBBBB',
  uploadLine: '#555555',

  // Settings controls
  controlBg: '#F0F0F0',
  controlBorder: '#DDDDDD',
  controlSepLight: 'rgba(0,0,0,0.04)',
  switchTrackOff: '#DDDDDD',
  switchThumbOff: '#BBBBBB',
  placeholderText: '#BBBBBB',

  // Empty state bolt
  emptyBolt: '#DDDDDD',
};

// ── Shared constants (independent of theme) ─────────────────────────────────
export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 50,
};

export const SHADOWS = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  cardLight: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  glow: {
    shadowColor: '#F5C400',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  button: {
    shadowColor: '#F5C400',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
};

// ── Context ─────────────────────────────────────────────────────────────────
const ThemeContext = createContext({
  t: DARK,
  themeChoice: 'dark',
  setThemeChoice: () => {},
});

export const useTheme = () => useContext(ThemeContext);

const STORAGE_KEY = '@zolt_theme';

export const ThemeProvider = ({ children }) => {
  const systemScheme = useColorScheme(); // 'light' | 'dark' | null
  const [themeChoice, setThemeChoiceState] = useState('dark'); // 'light' | 'dark' | 'system'
  const [loaded, setLoaded] = useState(false);

  // Load stored preference
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((v) => {
      if (v === 'light' || v === 'dark' || v === 'system') {
        setThemeChoiceState(v);
      }
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  const setThemeChoice = (val) => {
    setThemeChoiceState(val);
    AsyncStorage.setItem(STORAGE_KEY, val).catch(() => {});
  };

  // Resolve effective theme
  let effective = themeChoice;
  if (themeChoice === 'system') {
    effective = systemScheme === 'light' ? 'light' : 'dark';
  }
  const t = effective === 'light' ? LIGHT : DARK;

  return (
    <ThemeContext.Provider value={{ t, themeChoice, setThemeChoice }}>
      {loaded ? children : null}
    </ThemeContext.Provider>
  );
};

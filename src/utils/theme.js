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

  danger: '#FF4444',
  success: '#00C48C',
  warning: '#F5C400',

  white: '#FFFFFF',
  black: '#000000',
};

// ── Color Themes (10 themes) ─────────────────────────────────────────────────
export const COLOR_THEMES = [
  { id: 'gold', name: 'Gold', accent: '#F5C400', accentDark: '#D4A900', accentLight: '#FFD633' },
  { id: 'blue', name: 'Ocean Blue', accent: '#2196F3', accentDark: '#1976D2', accentLight: '#42A5F5' },
  { id: 'purple', name: 'Royal Purple', accent: '#9C27B0', accentDark: '#7B1FA2', accentLight: '#BA68C8' },
  { id: 'red', name: 'Crimson Red', accent: '#F44336', accentDark: '#D32F2F', accentLight: '#EF5350' },
  { id: 'green', name: 'Emerald Green', accent: '#4CAF50', accentDark: '#388E3C', accentLight: '#66BB6A' },
  { id: 'orange', name: 'Sunset Orange', accent: '#FF9800', accentDark: '#F57C00', accentLight: '#FFB74D' },
  { id: 'pink', name: 'Hot Pink', accent: '#E91E63', accentDark: '#C2185B', accentLight: '#EC407A' },
  { id: 'teal', name: 'Teal', accent: '#009688', accentDark: '#00796B', accentLight: '#26A69A' },
  { id: 'indigo', name: 'Indigo', accent: '#3F51B5', accentDark: '#303F9F', accentLight: '#5C6BC0' },
  { id: 'cyan', name: 'Cyan', accent: '#00BCD4', accentDark: '#0097A7', accentLight: '#26C6DA' },
];

// ── Theme-aware palettes ────────────────────────────────────────────────────
const DARK = {
  mode: 'dark',
  bg: '#141414',
  surface: '#1E1E1E',
  surfaceElevated: '#282828',
  glass: 'rgba(30, 30, 30, 0.92)',
  glassBorder: 'rgba(255, 255, 255, 0.08)',
  glassBorderTop: 'rgba(255,255,255,0.12)',
  textPrimary: '#F5F5F5',
  textSecondary: '#A8A8A8',       // bumped from #999 → 4.6:1 vs #1E1E1E (AA)
  textMuted: '#8C8C8C',           // bumped from #888 → still distinct, passes AA on surface
  separator: 'rgba(255, 255, 255, 0.07)',

  // Header & Nav
  headerBg: '#111111',
  headerText: '#FFFFFF',
  navBar: '#111111',
  navActive: '#F5C400',
  navInactive: '#666666',

  // Buttons
  buttonText: '#000000',

  // FlashTitle 3D text
  flashShadow: '#000000',
  flashHighlight: '#555555',
  flashHighlightOpacity: 0.12,
  flashColor: '#FFFFFF',

  // Speedometer (modern flat gauge)
  gaugeTrack: '#2A2A2A',
  gaugeTrackStroke: '#333333',
  gaugeLabelMajor: '#A8A8A8',     // WCAG AA
  gaugeLabelMinor: '#707070',
  gaugeCenter: '#181818',

  // Charts
  gridLine: 'rgba(255,255,255,0.06)',
  axisLine: 'rgba(255,255,255,0.12)',
  axisLabel: '#A0A0A0',           // bumped from #888 → readable
  axisLabelSub: '#808080',        // bumped from #666 → readable
  uploadLine: '#4FC3F7',

  // Settings controls
  controlBg: '#1E1E1E',
  controlBorder: '#333333',
  controlSepLight: 'rgba(255,255,255,0.05)',
  switchTrackOff: '#3A3A3A',
  switchThumbOff: '#888888',
  placeholderText: '#606060',

  // Empty state bolt
  emptyBolt: '#333333',
};

const LIGHT = {
  mode: 'light',
  bg: '#FAFAFA',
  surface: '#FFFFFF',
  surfaceElevated: '#F0F0F0',
  glass: 'rgba(255, 255, 255, 0.88)',
  glassBorder: 'rgba(0, 0, 0, 0.06)',
  glassBorderTop: 'rgba(255,255,255,0.7)',
  textPrimary: '#111111',
  textSecondary: '#555555',        // bumped from #666 for AA
  textMuted: '#888888',            // bumped from #AAA → readable on white
  separator: 'rgba(0, 0, 0, 0.07)',

  // Header & Nav
  headerBg: '#FFFFFF',
  headerText: '#111111',
  navBar: '#FFFFFF',
  navActive: '#F5C400',
  navInactive: '#AAAAAA',

  // Buttons
  buttonText: '#FFFFFF',

  // FlashTitle 3D text — light grey sides instead of dark
  flashShadow: '#C8C8C8',
  flashHighlight: '#FFFFFF',
  flashHighlightOpacity: 0.6,
  flashColor: '#FFFBE6',

  // Speedometer (modern flat gauge)
  gaugeTrack: '#E8E8E8',
  gaugeTrackStroke: '#D0D0D0',
  gaugeLabelMajor: '#555555',
  gaugeLabelMinor: '#AAAAAA',
  gaugeCenter: '#FFFFFF',

  // Charts
  gridLine: 'rgba(0,0,0,0.06)',
  axisLine: 'rgba(0,0,0,0.14)',
  axisLabel: '#777777',            // bumped from #999
  axisLabelSub: '#999999',         // bumped from #BBB
  uploadLine: '#2196F3',

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
  colorThemeId: 'gold',
  setThemeChoice: () => {},
  setColorThemeId: () => {},
});

export const useTheme = () => useContext(ThemeContext);

const STORAGE_KEY = '@zolt_theme';
const COLOR_THEME_KEY = '@zolt_color_theme';

export const ThemeProvider = ({ children }) => {
  const systemScheme = useColorScheme(); // 'light' | 'dark' | null
  const [themeChoice, setThemeChoiceState] = useState('dark'); // 'light' | 'dark' | 'system'
  const [colorThemeId, setColorThemeIdState] = useState('gold');
  const [loaded, setLoaded] = useState(false);

  // Load stored preferences
  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(STORAGE_KEY),
      AsyncStorage.getItem(COLOR_THEME_KEY),
    ]).then(([themeVal, colorVal]) => {
      if (themeVal === 'light' || themeVal === 'dark' || themeVal === 'system') {
        setThemeChoiceState(themeVal);
      }
      if (colorVal && COLOR_THEMES.find(ct => ct.id === colorVal)) {
        setColorThemeIdState(colorVal);
      }
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  const setThemeChoice = (val) => {
    setThemeChoiceState(val);
    AsyncStorage.setItem(STORAGE_KEY, val).catch(() => {});
  };

  const setColorThemeId = (val) => {
    setColorThemeIdState(val);
    AsyncStorage.setItem(COLOR_THEME_KEY, val).catch(() => {});
  };

  // Get active color theme
  const activeColorTheme = COLOR_THEMES.find(ct => ct.id === colorThemeId) || COLOR_THEMES[0];

  // Resolve effective theme
  let effective = themeChoice;
  if (themeChoice === 'system') {
    effective = systemScheme === 'light' ? 'light' : 'dark';
  }
  const baseTheme = effective === 'light' ? LIGHT : DARK;

  // Apply color theme to base theme
  const t = {
    ...baseTheme,
    ...activeColorTheme,
    accentGlow: `${activeColorTheme.accent}59`, // 35% opacity
    accentSubtle: `${activeColorTheme.accent}14`, // 8% opacity
  };

  return (
    <ThemeContext.Provider value={{ t, themeChoice, colorThemeId, setThemeChoice, setColorThemeId }}>
      {loaded ? children : null}
    </ThemeContext.Provider>
  );
};

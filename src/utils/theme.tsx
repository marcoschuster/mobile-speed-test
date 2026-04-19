// ─────────────────────────────────────────────────────────────────────────────
// Flash — Premium Design System
// Inspired by McLaren, Apple, n8n, landonorris.com
// ─────────────────────────────────────────────────────────────────────────────

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const withAlpha = (hex: string, alpha: number): string => {
  const normalized = hex.replace('#', '');
  const full = normalized.length === 3
    ? normalized.split('').map((c) => c + c).join('')
    : normalized;

  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

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
} as const;

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
] as const;

// ── Theme-aware palettes ────────────────────────────────────────────────────
const DARK = {
  mode: 'dark',
  bg: '#08111a',
  surface: 'rgba(12, 24, 38, 0.68)',
  surfaceElevated: 'rgba(16, 29, 45, 0.84)',
  glass: 'rgba(11, 22, 35, 0.74)',
  glassStrong: 'rgba(10, 20, 31, 0.88)',
  glassSoft: 'rgba(255, 255, 255, 0.05)',
  glassBorder: 'rgba(255, 255, 255, 0.14)',
  glassBorderStrong: 'rgba(255, 255, 255, 0.24)',
  glassBorderTop: 'rgba(255,255,255,0.34)',
  glassHighlight: 'rgba(255,255,255,0.18)',
  glassGlow: 'rgba(255,255,255,0.05)',
  glassShadow: 'rgba(1, 7, 16, 0.46)',
  backdropStart: '#07101a',
  backdropMid: '#0d1724',
  backdropEnd: '#04070c',
  textPrimary: '#F5F5F5',
  textSecondary: '#B3C0D1',
  textMuted: '#7C8CA0',
  separator: 'rgba(255, 255, 255, 0.10)',

  // Header & Nav
  headerBg: 'rgba(3, 8, 15, 0.92)',
  headerText: '#FFFFFF',
  navBar: 'rgba(3, 8, 15, 0.92)',
  navActive: '#F5C400',
  navInactive: '#75839A',

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
  controlBg: 'rgba(255,255,255,0.08)',
  controlBorder: 'rgba(255,255,255,0.16)',
  controlSepLight: 'rgba(255,255,255,0.08)',
  switchTrackOff: 'rgba(255,255,255,0.16)',
  switchThumbOff: '#B4C0CE',
  placeholderText: '#6F8094',

  // Empty state bolt
  emptyBolt: '#333333',
} as const;

const LIGHT = {
  mode: 'light',
  bg: '#e7f0f8',
  surface: 'rgba(255, 255, 255, 0.62)',
  surfaceElevated: 'rgba(255, 255, 255, 0.82)',
  glass: 'rgba(255, 255, 255, 0.74)',
  glassStrong: 'rgba(255, 255, 255, 0.86)',
  glassSoft: 'rgba(255,255,255,0.46)',
  glassBorder: 'rgba(118, 141, 171, 0.18)',
  glassBorderStrong: 'rgba(118, 141, 171, 0.28)',
  glassBorderTop: 'rgba(255,255,255,0.92)',
  glassHighlight: 'rgba(255,255,255,0.78)',
  glassGlow: 'rgba(255,255,255,0.32)',
  glassShadow: 'rgba(70, 93, 123, 0.18)',
  backdropStart: '#f5fbff',
  backdropMid: '#e7f0f8',
  backdropEnd: '#d6e2ef',
  textPrimary: '#111111',
  textSecondary: '#415066',
  textMuted: '#75839A',
  separator: 'rgba(113, 135, 162, 0.18)',

  // Header & Nav
  headerBg: 'rgba(245, 245, 250, 0.92)',
  headerText: '#111111',
  navBar: 'rgba(245, 245, 250, 0.92)',
  navActive: '#F5C400',
  navInactive: '#8A98AA',

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
  controlBg: 'rgba(255,255,255,0.64)',
  controlBorder: 'rgba(118, 141, 171, 0.18)',
  controlSepLight: 'rgba(118, 141, 171, 0.12)',
  switchTrackOff: 'rgba(118, 141, 171, 0.18)',
  switchThumbOff: '#C7D1DE',
  placeholderText: '#97A6B8',

  // Empty state bolt
  emptyBolt: '#DDDDDD',
} as const;

// ── Shared constants (independent of theme) ─────────────────────────────────
export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 50,
} as const;

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
  // Claymorphism shadows - dual-layer (light + dark) for true clay-like 3D effect
  clay: {
    shadowColor: 'rgba(0, 0, 0, 0.15)',
    shadowOffset: { width: 16, height: 16 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 16,
  },
  clayLight: {
    shadowColor: '#FFFFFF',
    shadowOffset: { width: -16, height: -16 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 16,
  },
  clayInner: {
    shadowColor: 'rgba(0, 0, 0, 0.1)',
    shadowOffset: { width: 10, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  clayInnerLight: {
    shadowColor: '#FFFFFF',
    shadowOffset: { width: -10, height: -10 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  clayButton: {
    shadowColor: '#07101A',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 10,
  },
  clayButtonLight: {
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 0,
  },
  clayCard: {
    shadowColor: '#07101A',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.2,
    shadowRadius: 28,
    elevation: 14,
  },
  clayCardLight: {
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.14,
    shadowRadius: 12,
    elevation: 0,
  },
} as const;

// ── Type Definitions ─────────────────────────────────────────────────────────
type ThemeChoice = 'light' | 'dark' | 'system';
type BaseTheme = typeof DARK | typeof LIGHT;
type ColorTheme = typeof COLOR_THEMES[number];

interface ThemeContextType {
  t: Record<string, any>;
  themeChoice: ThemeChoice;
  colorThemeId: string;
  setThemeChoice: (val: ThemeChoice) => void;
  setColorThemeId: (val: string) => void;
}

// ── Context ─────────────────────────────────────────────────────────────────
const ThemeContext = createContext<ThemeContextType>({
  t: DARK,
  themeChoice: 'dark',
  colorThemeId: 'gold',
  setThemeChoice: () => {},
  setColorThemeId: () => {},
});

export const useTheme = (): ThemeContextType => useContext(ThemeContext);

const STORAGE_KEY = '@flash_theme';
const COLOR_THEME_KEY = '@flash_color_theme';

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider = ({ children }: ThemeProviderProps) => {
  const systemScheme = useColorScheme(); // 'light' | 'dark' | null
  const [themeChoice, setThemeChoiceState] = useState<ThemeChoice>('dark');
  const [colorThemeId, setColorThemeIdState] = useState('gold');
  const [loaded, setLoaded] = useState(false);

  // Load stored preferences
  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(STORAGE_KEY),
      AsyncStorage.getItem(COLOR_THEME_KEY),
    ]).then(([themeVal, colorVal]) => {
      if (themeVal === 'light' || themeVal === 'dark' || themeVal === 'system') {
        setThemeChoiceState(themeVal as ThemeChoice);
      }
      if (colorVal && COLOR_THEMES.find(ct => ct.id === colorVal)) {
        setColorThemeIdState(colorVal);
      }
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  const setThemeChoice = (val: ThemeChoice) => {
    setThemeChoiceState(val);
    AsyncStorage.setItem(STORAGE_KEY, val).catch(() => {});
  };

  const setColorThemeId = (val: string) => {
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
    ...COLORS,
    ...baseTheme,
    ...activeColorTheme,
    navActive: activeColorTheme.accent,
    warning: activeColorTheme.accent,
    accentGlow: withAlpha(activeColorTheme.accent, 0.35),
    accentSubtle: withAlpha(activeColorTheme.accent, 0.08),
    accentTintSoft: withAlpha(activeColorTheme.accent, effective === 'dark' ? 0.03 : 0.015),
    accentTintCard: withAlpha(activeColorTheme.accent, effective === 'dark' ? 0.04 : 0.02),
    accentTintStrong: withAlpha(activeColorTheme.accent, effective === 'dark' ? 0.15 : 0.12),
    accentTintSelected: withAlpha(activeColorTheme.accent, 0.14),
    glassTintSoft: withAlpha(activeColorTheme.accent, effective === 'dark' ? 0.08 : 0.05),
    glassTintStrong: withAlpha(activeColorTheme.accent, effective === 'dark' ? 0.16 : 0.08),
    glassBorderAccent: withAlpha(activeColorTheme.accent, effective === 'dark' ? 0.22 : 0.14),
    backdropOrbPrimary: withAlpha(activeColorTheme.accent, effective === 'dark' ? 0.20 : 0.12),
    backdropOrbSecondary: withAlpha(activeColorTheme.accentLight, effective === 'dark' ? 0.12 : 0.08),
    backdropOrbNeutral: effective === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.44)',
    chromeFadeEdge: withAlpha(activeColorTheme.accentLight, effective === 'dark' ? 0.16 : 0.12),
  };

  return (
    <ThemeContext.Provider value={{ t, themeChoice, colorThemeId, setThemeChoice, setColorThemeId }}>
      {loaded ? children : null}
    </ThemeContext.Provider>
  );
};

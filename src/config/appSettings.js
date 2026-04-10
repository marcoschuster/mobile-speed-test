import AsyncStorage from '@react-native-async-storage/async-storage';

export const APP_SETTINGS_STORAGE_KEY = '@zolt_app_settings';

export const HISTORY_RETENTION_OPTIONS = [
  { label: '30 days', value: 30 },
  { label: '90 days', value: 90 },
  { label: '1 year', value: 365 },
  { label: 'Keep until deleted', value: -1 },
];

export const BACKGROUND_TEST_INTERVALS = [
  { label: 'Every 30 minutes', value: 30 },
  { label: 'Every 1 hour', value: 60 },
  { label: 'Every 3 hours', value: 180 },
  { label: 'Every 6 hours', value: 360 },
  { label: 'Every 12 hours', value: 720 },
  { label: 'Every 24 hours', value: 1440 },
];

export const DEFAULT_APP_SETTINGS = {
  speedUnit: 'mbps',
  showPing: true,
  historyRetentionDays: 90,
  dataDisclosureAccepted: false,
  backgroundTestInterval: null, // null = disabled
};

export const sanitizeAppSettings = (value) => ({
  ...DEFAULT_APP_SETTINGS,
  ...(value || {}),
});

export const loadAppSettings = async () => {
  try {
    const stored = await AsyncStorage.getItem(APP_SETTINGS_STORAGE_KEY);
    if (!stored) return { ...DEFAULT_APP_SETTINGS };
    return sanitizeAppSettings(JSON.parse(stored));
  } catch (error) {
    console.error('Failed to load app settings:', error);
    return { ...DEFAULT_APP_SETTINGS };
  }
};

export const saveAppSettings = async (settings) => {
  const sanitized = sanitizeAppSettings(settings);
  try {
    await AsyncStorage.setItem(APP_SETTINGS_STORAGE_KEY, JSON.stringify(sanitized));
  } catch (error) {
    console.error('Failed to save app settings:', error);
  }
  return sanitized;
};

export const resetAppSettings = async () => {
  try {
    await AsyncStorage.removeItem(APP_SETTINGS_STORAGE_KEY);
  } catch (error) {
    console.error('Failed to reset app settings:', error);
  }
  return { ...DEFAULT_APP_SETTINGS };
};

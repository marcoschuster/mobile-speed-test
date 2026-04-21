import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const APP_SETTINGS = {
  STORAGE_KEY: 'mobile_speed_test_settings',
};

interface Settings {
  speedUnit: 'Mbps' | 'MB/s' | 'kB/s';
  showPing: boolean;
  backgroundTestInterval: number | null;
  backgroundTestIntervalSeconds: number | null;
  dataDisclosureAccepted: boolean;
  historyRetentionDays: number;
  testProvider: string;
}

interface AppSettingsContextType {
  settings: Settings;
  updateSettings: (newSettings: Partial<Settings>) => void;
  resetSettings: () => void;
}

const AppSettingsContext = createContext<AppSettingsContextType | undefined>(undefined);

const DEFAULT_SETTINGS: Settings = {
  speedUnit: 'Mbps',
  showPing: true,
  backgroundTestInterval: null,
  backgroundTestIntervalSeconds: null,
  dataDisclosureAccepted: false,
  historyRetentionDays: 30,
  testProvider: 'ookla',
};

export const AppSettingsProvider = ({ children }: { children: ReactNode }) => {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const savedSettings = await AsyncStorage.getItem(APP_SETTINGS.STORAGE_KEY);
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        setSettings({
          ...DEFAULT_SETTINGS,
          ...parsed,
          backgroundTestIntervalSeconds:
            parsed.backgroundTestIntervalSeconds ??
            (typeof parsed.backgroundTestInterval === 'number'
              ? parsed.backgroundTestInterval * 60
              : null),
        });
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateSettings = async (newSettings: Partial<Settings>) => {
    const updatedSettings = { ...settings, ...newSettings };
    setSettings(updatedSettings);
    try {
      await AsyncStorage.setItem(APP_SETTINGS.STORAGE_KEY, JSON.stringify(updatedSettings));
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  };

  const resetSettings = async () => {
    setSettings(DEFAULT_SETTINGS);
    try {
      await AsyncStorage.removeItem(APP_SETTINGS.STORAGE_KEY);
    } catch (error) {
      console.error('Failed to reset settings:', error);
    }
  };

  if (isLoading) {
    return null;
  }

  return (
    <AppSettingsContext.Provider value={{ settings, updateSettings, resetSettings }}>
      {children}
    </AppSettingsContext.Provider>
  );
};

export const useAppSettings = () => {
  const context = useContext(AppSettingsContext);
  if (context === undefined) {
    throw new Error('useAppSettings must be used within an AppSettingsProvider');
  }
  return context;
};

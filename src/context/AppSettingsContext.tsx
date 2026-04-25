import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import BackgroundTestService from '../services/BackgroundTestService';

const APP_SETTINGS = {
  STORAGE_KEY: 'mobile_speed_test_settings',
};

interface Settings {
  speedUnit: 'Mbps' | 'MB/s' | 'kB/s';
  showPing: boolean;
  continuousMonitoringEnabled: boolean;
  backgroundTestingPermissionAccepted: boolean;
  backgroundTestInterval: number | null;
  backgroundTestIntervalSeconds: number | null;
  detailedCellularRadioEnabled: boolean;
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
  continuousMonitoringEnabled: false,
  backgroundTestingPermissionAccepted: false,
  backgroundTestInterval: null,
  backgroundTestIntervalSeconds: 30 * 60,
  detailedCellularRadioEnabled: false,
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

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        syncNotificationOptOut();
      }
    });

    return () => subscription.remove();
  }, [settings]);

  const persistSettings = async (updatedSettings: Settings) => {
    setSettings(updatedSettings);
    await AsyncStorage.setItem(APP_SETTINGS.STORAGE_KEY, JSON.stringify(updatedSettings));
  };

  const syncNotificationOptOut = async () => {
    try {
      const disabledFromNotification = await BackgroundTestService.wasDisabledFromNotification();
      if (!disabledFromNotification || !settings.continuousMonitoringEnabled) {
        return;
      }

      const updatedSettings = {
        ...settings,
        continuousMonitoringEnabled: false,
      };

      await persistSettings(updatedSettings);
      await BackgroundTestService.configureFromSettings(updatedSettings);
    } catch (error) {
      console.error('Failed to sync background notification state:', error);
    }
  };

  const loadSettings = async () => {
    try {
      const savedSettings = await AsyncStorage.getItem(APP_SETTINGS.STORAGE_KEY);
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        const hydratedSettings = {
          ...DEFAULT_SETTINGS,
          ...parsed,
          backgroundTestIntervalSeconds:
            parsed.backgroundTestIntervalSeconds ??
            (typeof parsed.backgroundTestInterval === 'number'
              ? parsed.backgroundTestInterval * 60
              : null),
        };

        setSettings(hydratedSettings);
        BackgroundTestService.configureFromSettings(hydratedSettings).then((result) => {
          if (result?.disabledFromNotification && hydratedSettings.continuousMonitoringEnabled) {
            void persistSettings({
              ...hydratedSettings,
              continuousMonitoringEnabled: false,
            });
          }
        }).catch((error) => {
          console.error('Failed to configure background testing:', error);
        });
      } else {
        BackgroundTestService.configureFromSettings(DEFAULT_SETTINGS).catch((error) => {
          console.error('Failed to configure background testing:', error);
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
    try {
      if (newSettings.continuousMonitoringEnabled) {
        await BackgroundTestService.clearNotificationOptOut();
      }

      await persistSettings(updatedSettings);
      await BackgroundTestService.configureFromSettings(updatedSettings);
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  };

  const resetSettings = async () => {
    try {
      setSettings(DEFAULT_SETTINGS);
      await AsyncStorage.removeItem(APP_SETTINGS.STORAGE_KEY);
      await BackgroundTestService.configureFromSettings(DEFAULT_SETTINGS);
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

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_APP_SETTINGS,
  loadAppSettings,
  resetAppSettings,
  saveAppSettings,
  sanitizeAppSettings,
} from '../config/appSettings';

const AppSettingsContext = createContext({
  settings: DEFAULT_APP_SETTINGS,
  loaded: false,
  updateSettings: () => {},
  resetSettings: async () => {},
});

export const useAppSettings = () => useContext(AppSettingsContext);

export const AppSettingsProvider = ({ children }) => {
  const [settings, setSettings] = useState(DEFAULT_APP_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;

    loadAppSettings()
      .then((stored) => {
        if (mounted) setSettings(stored);
      })
      .finally(() => {
        if (mounted) setLoaded(true);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const updateSettings = async (partial) => {
    const next = sanitizeAppSettings({ ...settings, ...partial });
    setSettings(next);
    await saveAppSettings(next);
    return next;
  };

  const resetSettingsState = async () => {
    const next = await resetAppSettings();
    setSettings(next);
    return next;
  };

  const value = useMemo(
    () => ({
      settings,
      loaded,
      updateSettings,
      resetSettings: resetSettingsState,
    }),
    [loaded, settings],
  );

  return (
    <AppSettingsContext.Provider value={value}>
      {loaded ? children : null}
    </AppSettingsContext.Provider>
  );
};

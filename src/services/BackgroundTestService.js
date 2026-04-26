import AsyncStorage from '@react-native-async-storage/async-storage';
import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

let BackgroundMonitorNotification = null;

if (Platform.OS === 'android') {
  try {
    BackgroundMonitorNotification = require('../../modules/expo-background-monitor-notification').default;
  } catch (_error) {
    BackgroundMonitorNotification = null;
  }
}

export const BACKGROUND_TEST_TASK = 'BACKGROUND_TEST_TASK';
export const BACKGROUND_TEST_HISTORY_KEY = 'backgroundSpeedTestHistory';
export const BACKGROUND_TEST_ALERTS_KEY = 'backgroundSpeedDropAlerts';
export const BACKGROUND_TEST_SETTINGS_KEY = 'mobile_speed_test_settings';

export const BACKGROUND_INTERVALS = [
  { label: 'Every 15 min', value: 15 * 60 },
  { label: 'Every 30 min', value: 30 * 60 },
  { label: 'Every 1 hr', value: 60 * 60 },
  { label: 'Every 3 hrs', value: 3 * 60 * 60 },
  { label: 'Every 6 hrs', value: 6 * 60 * 60 },
];

const QUICK_DOWNLOAD_MS = 4000;
const HISTORY_LIMIT = 500;
const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_INTERVAL_SECONDS = 30 * 60;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const mean = (values) => {
  const valid = values.filter((value) => Number.isFinite(value) && value > 0);
  if (!valid.length) return 0;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
};

const readSettings = async () => {
  const stored = await AsyncStorage.getItem(BACKGROUND_TEST_SETTINGS_KEY);
  return stored ? JSON.parse(stored) : {};
};

const getIntervalSeconds = (settings = {}) => (
  settings.backgroundTestIntervalSeconds
    ?? (typeof settings.backgroundTestInterval === 'number'
      ? settings.backgroundTestInterval * 60
      : DEFAULT_INTERVAL_SECONDS)
);

const getIntervalLabel = (intervalSeconds) => {
  const matched = BACKGROUND_INTERVALS.find((option) => option.value === intervalSeconds);
  return matched ? matched.label.toLowerCase().replace('every ', 'every ') : `every ${Math.round(intervalSeconds / 60)} min`;
};

const shouldRunFromSettings = (settings = {}) => (
  Boolean(settings.continuousMonitoringEnabled)
    && Boolean(settings.backgroundTestingPermissionAccepted)
    && getIntervalSeconds(settings) > 0
);

const wasDisabledFromNotification = async () => (
  Boolean(await BackgroundMonitorNotification?.wasDisabledFromNotificationAsync?.().catch(() => false))
);

const showMonitoringNotification = async (intervalSeconds) => {
  if (!BackgroundMonitorNotification) {
    return false;
  }

  return Boolean(await BackgroundMonitorNotification
    .showMonitoringNotificationAsync(getIntervalLabel(intervalSeconds))
    .catch(() => false));
};

const hideMonitoringNotification = async () => {
  await BackgroundMonitorNotification?.hideMonitoringNotificationAsync?.().catch(() => {});
};

const scheduleNativeMonitoring = async (intervalMinutes) => (
  Boolean(await BackgroundMonitorNotification?.scheduleNativeMonitoringAsync?.(intervalMinutes).catch(() => false))
);

const cancelNativeMonitoring = async () => {
  await BackgroundMonitorNotification?.cancelNativeMonitoringAsync?.().catch(() => {});
};

const clearNotificationOptOut = async () => {
  await BackgroundMonitorNotification?.clearDisabledFromNotificationAsync?.().catch(() => {});
};

const requestWithTimeout = async (url, timeoutMs = 3000) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      method: 'HEAD',
      cache: 'no-store',
      signal: controller.signal,
      headers: { 'Cache-Control': 'no-cache' },
    });
  } finally {
    clearTimeout(timeoutId);
  }
};

const runQuickPing = async () => {
  const targets = [
    'https://www.cloudflare.com',
    'https://www.google.com',
    'https://speed.cloudflare.com',
  ];
  const samples = [];

  for (const target of targets) {
    try {
      const startedAt = Date.now();
      await requestWithTimeout(`${target}/?_=${Date.now()}`, 2500);
      samples.push(Date.now() - startedAt);
      await sleep(120);
    } catch (_error) {}
  }

  return Math.round(mean(samples));
};

const runSingleDownloadChunk = (timeoutMs) => (
  new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    let lastLoaded = 0;
    let totalBytes = 0;
    let settled = false;
    const startedAt = Date.now();

    const finish = () => {
      if (settled) return;
      settled = true;
      const elapsedSeconds = Math.max((Date.now() - startedAt) / 1000, 0.001);
      resolve({ totalBytes, elapsedSeconds });
    };

    const timeoutId = setTimeout(() => {
      try {
        xhr.abort();
      } catch (_error) {}
      finish();
    }, timeoutMs);

    xhr.open('GET', `https://speed.cloudflare.com/__down?bytes=25000000&_=${Date.now()}`);
    xhr.timeout = timeoutMs + 1000;
    xhr.setRequestHeader('Cache-Control', 'no-cache');

    xhr.onprogress = (event) => {
      if (event.loaded > lastLoaded) {
        totalBytes += event.loaded - lastLoaded;
        lastLoaded = event.loaded;
      }
    };
    xhr.onload = () => {
      clearTimeout(timeoutId);
      finish();
    };
    xhr.onerror = () => {
      clearTimeout(timeoutId);
      finish();
    };
    xhr.ontimeout = () => {
      clearTimeout(timeoutId);
      finish();
    };

    try {
      xhr.send();
    } catch (_error) {
      clearTimeout(timeoutId);
      finish();
    }
  })
);

const runQuickDownload = async () => {
  const startedAt = Date.now();
  const result = await runSingleDownloadChunk(QUICK_DOWNLOAD_MS);
  const elapsedSeconds = Math.max((Date.now() - startedAt) / 1000, result.elapsedSeconds, 0.001);
  const speed = (result.totalBytes * 8) / (elapsedSeconds * 1000000);

  return {
    speed: Math.round(speed * 100) / 100,
    totalBytes: result.totalBytes,
    elapsedMs: Math.round(elapsedSeconds * 1000),
  };
};

export const getBackgroundHistory = async () => {
  try {
    const stored = await AsyncStorage.getItem(BACKGROUND_TEST_HISTORY_KEY);
    const parsed = stored ? JSON.parse(stored) : [];
    const jsHistory = Array.isArray(parsed) ? parsed : [];
    const nativeStored = await BackgroundMonitorNotification?.getNativeHistoryAsync?.().catch(() => '[]');
    const nativeParsed = nativeStored ? JSON.parse(nativeStored) : [];
    const nativeHistory = Array.isArray(nativeParsed) ? nativeParsed : [];
    const byId = new Map();

    [...jsHistory, ...nativeHistory].forEach((item) => {
      const key = item.id || `${item.date}-${item.source || 'background'}`;
      byId.set(key, item);
    });

    return [...byId.values()].sort((left, right) => (
      new Date(right.date).getTime() - new Date(left.date).getTime()
    ));
  } catch (_error) {
    return [];
  }
};

const saveBackgroundResult = async (result) => {
  const history = await getBackgroundHistory();
  const cutoff = Date.now() - (7 * DAY_MS);
  const nextHistory = [result, ...history]
    .filter((item) => new Date(item.date).getTime() >= cutoff)
    .slice(0, HISTORY_LIMIT);

  await AsyncStorage.setItem(BACKGROUND_TEST_HISTORY_KEY, JSON.stringify(nextHistory));
  return nextHistory;
};

export const getBackgroundDropAlerts = async () => {
  try {
    const stored = await AsyncStorage.getItem(BACKGROUND_TEST_ALERTS_KEY);
    const parsed = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (_error) {
    return [];
  }
};

const saveDropAlert = async (alert) => {
  const alerts = await getBackgroundDropAlerts();
  const cutoff = Date.now() - (7 * DAY_MS);
  const nextAlerts = [alert, ...alerts]
    .filter((item) => new Date(item.date).getTime() >= cutoff)
    .slice(0, 100);

  await AsyncStorage.setItem(BACKGROUND_TEST_ALERTS_KEY, JSON.stringify(nextAlerts));
  return nextAlerts;
};

const maybeRecordDropAlert = async (result, previousHistory) => {
  const cutoff = Date.now() - DAY_MS;
  const recent = previousHistory.filter((item) => new Date(item.date).getTime() >= cutoff);
  const average = mean(recent.map((item) => Number(item.download || 0)));

  if (recent.length < 3 || average <= 0 || result.download >= average * 0.7) {
    return null;
  }

  const alert = {
    id: `${Date.now()}`,
    date: new Date().toISOString(),
    type: 'background-speed-drop',
    title: 'Speed dropped',
    message: `Background test measured ${result.download.toFixed(1)} Mbps, down more than 30% from the 24h average of ${average.toFixed(1)} Mbps.`,
    download: result.download,
    average24h: Math.round(average * 10) / 10,
    resultId: result.id,
    read: false,
  };

  await saveDropAlert(alert);
  return alert;
};

export const runBackgroundTestNow = async () => {
  const previousHistory = await getBackgroundHistory();
  const [ping, download] = await Promise.all([
    runQuickPing(),
    runQuickDownload(),
  ]);

  const result = {
    id: `${Date.now()}`,
    date: new Date().toISOString(),
    timestamp: Date.now(),
    download: download.speed,
    ping,
    upload: 0,
    totalBytes: download.totalBytes,
    durationMs: download.elapsedMs,
    source: 'background',
  };

  await saveBackgroundResult(result);
  const alert = await maybeRecordDropAlert(result, previousHistory);
  return alert ? { ...result, alert } : result;
};

const defineBackgroundTask = () => {
  if (TaskManager.isTaskDefined(BACKGROUND_TEST_TASK)) {
    return;
  }

  TaskManager.defineTask(BACKGROUND_TEST_TASK, async ({ error }) => {
    if (error) {
      return BackgroundTask.BackgroundTaskResult.Failed;
    }

    try {
      const settings = await readSettings();
      if (!shouldRunFromSettings(settings) || await wasDisabledFromNotification()) {
        return BackgroundTask.BackgroundTaskResult.Success;
      }

      await runBackgroundTestNow();
      return BackgroundTask.BackgroundTaskResult.Success;
    } catch (taskError) {
      console.log('Background speed test failed:', taskError?.message || taskError);
      return BackgroundTask.BackgroundTaskResult.Failed;
    }
  });
};

defineBackgroundTask();

const BackgroundTestService = {
  async getStatus() {
    const [isAvailable, fetchStatus, isRegistered] = await Promise.all([
      TaskManager.isAvailableAsync(),
      BackgroundTask.getStatusAsync(),
      TaskManager.isTaskRegisteredAsync(BACKGROUND_TEST_TASK).catch(() => false),
    ]);

    return {
      isAvailable,
      fetchStatus,
      isRegistered,
      nativeAndroidAvailable: Boolean(BackgroundMonitorNotification),
    };
  },

  async configureFromSettings(settings = {}) {
    defineBackgroundTask();

    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_TEST_TASK).catch(() => false);
    const isAvailable = await TaskManager.isAvailableAsync().catch(() => false);
    const fetchStatus = await BackgroundTask.getStatusAsync().catch(() => null);
    const disabledFromNotification = await wasDisabledFromNotification();

    if (!shouldRunFromSettings(settings) || disabledFromNotification) {
      if (isRegistered) {
        await BackgroundTask.unregisterTaskAsync(BACKGROUND_TEST_TASK);
      }
      await cancelNativeMonitoring();
      await hideMonitoringNotification();
      return { registered: false, disabledFromNotification };
    }

    const intervalSeconds = getIntervalSeconds(settings);
    const intervalMinutes = Math.max(15, Math.ceil(intervalSeconds / 60));
    const nativeRegistered = await scheduleNativeMonitoring(intervalMinutes);

    if (BackgroundMonitorNotification) {
      if (isRegistered) {
        await BackgroundTask.unregisterTaskAsync(BACKGROUND_TEST_TASK);
      }
      await showMonitoringNotification(intervalSeconds);
      return { registered: false, nativeRegistered, intervalSeconds, intervalMinutes };
    }

    if (!isAvailable || fetchStatus !== BackgroundTask.BackgroundTaskStatus.Available) {
      await showMonitoringNotification(intervalSeconds);
      return {
        registered: false,
        nativeRegistered,
        unavailable: !nativeRegistered,
        fetchStatus,
      };
    }

    if (!isRegistered) {
      await BackgroundTask.registerTaskAsync(BACKGROUND_TEST_TASK, {
        minimumInterval: intervalMinutes,
      });
    } else {
      await BackgroundTask.unregisterTaskAsync(BACKGROUND_TEST_TASK);
      await BackgroundTask.registerTaskAsync(BACKGROUND_TEST_TASK, {
        minimumInterval: intervalMinutes,
      });
    }
    await showMonitoringNotification(intervalSeconds);

    return { registered: true, nativeRegistered, intervalSeconds, intervalMinutes };
  },

  getIntervalSeconds,
  clearNotificationOptOut,
  getBackgroundHistory,
  getBackgroundDropAlerts,
  hideMonitoringNotification,
  wasDisabledFromNotification,
  runBackgroundTestNow,
};

export default BackgroundTestService;

import { requireNativeModule } from 'expo-modules-core';

type BackgroundMonitorNotificationModule = {
  showMonitoringNotificationAsync(intervalLabel: string): Promise<boolean>;
  hideMonitoringNotificationAsync(): Promise<void>;
  wasDisabledFromNotificationAsync(): Promise<boolean>;
  clearDisabledFromNotificationAsync(): Promise<void>;
  scheduleNativeMonitoringAsync(intervalMinutes: number): Promise<boolean>;
  cancelNativeMonitoringAsync(): Promise<void>;
  getNativeHistoryAsync(): Promise<string>;
};

export default requireNativeModule<BackgroundMonitorNotificationModule>('ExpoBackgroundMonitorNotification');

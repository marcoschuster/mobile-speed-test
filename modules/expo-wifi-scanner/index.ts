import { requireNativeModule } from 'expo-modules-core';

export type WiFiNetwork = {
  ssid: string;
  bssid: string;
  frequency: number;
  channel: number;
  rssi: number;
  capabilities: string;
};

type CurrentWiFiNetwork = {
  ssid: string | null;
  bssid: string | null;
};

type WiFiScannerModule = {
  scanAsync(): Promise<WiFiNetwork[]>;
  getCurrentNetworkAsync(): Promise<CurrentWiFiNetwork>;
};

export default requireNativeModule<WiFiScannerModule>('ExpoWiFiScanner');

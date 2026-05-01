import { PermissionsAndroid, Platform } from 'react-native';

export type WiFiBand = '2.4GHz' | '5GHz' | '6GHz' | 'Other';

export type WiFiNetwork = {
  ssid: string;
  bssid: string;
  frequency: number;
  channel: number;
  rssi: number;
  capabilities: string;
  band: WiFiBand;
  isCurrent: boolean;
};

export type CurrentWiFiNetwork = {
  ssid: string | null;
  bssid: string | null;
};

let NativeWiFiScanner: any = null;

if (Platform.OS === 'android') {
  try {
    NativeWiFiScanner = require('../../modules/expo-wifi-scanner').default;
  } catch (_error) {
    NativeWiFiScanner = null;
  }
}

const getBand = (frequency: number): WiFiBand => {
  if (frequency >= 2400 && frequency < 2500) return '2.4GHz';
  if (frequency >= 4900 && frequency < 5925) return '5GHz';
  if (frequency >= 5925 && frequency <= 7125) return '6GHz';
  return 'Other';
};

const requestAndroidPermissions = async () => {
  if (Platform.OS !== 'android') return false;

  const permissions = [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
  const nearbyWifiPermission = (PermissionsAndroid.PERMISSIONS as any).NEARBY_WIFI_DEVICES;
  if (Platform.Version >= 33 && nearbyWifiPermission) {
    permissions.push(nearbyWifiPermission);
  }

  const result = await PermissionsAndroid.requestMultiple(permissions);
  return permissions.some((permission) => result[permission] === PermissionsAndroid.RESULTS.GRANTED);
};

export const isWiFiScannerAvailable = () => Platform.OS === 'android' && Boolean(NativeWiFiScanner);

export const scanWiFiNetworks = async (): Promise<{ networks: WiFiNetwork[]; current: CurrentWiFiNetwork }> => {
  if (Platform.OS !== 'android') {
    return { networks: [], current: { ssid: null, bssid: null } };
  }

  if (!NativeWiFiScanner) {
    throw new Error('WiFi scanner native module is not available. Rebuild the Android app.');
  }

  const hasPermission = await requestAndroidPermissions();
  if (!hasPermission) {
    throw new Error('Location or nearby WiFi permission is required to scan WiFi networks.');
  }

  const [rawNetworks, current] = await Promise.all([
    NativeWiFiScanner.scanAsync(),
    NativeWiFiScanner.getCurrentNetworkAsync(),
  ]);
  const currentBssid = typeof current?.bssid === 'string' ? current.bssid.toLowerCase() : null;
  const currentSsid = typeof current?.ssid === 'string' ? current.ssid : null;

  const networks = (Array.isArray(rawNetworks) ? rawNetworks : [])
    .filter((network) => network && typeof network === 'object')
    .map((network) => {
      const bssid = String(network.bssid || '').toLowerCase();
      const ssid = String(network.ssid || 'Hidden network');
      const frequency = Number(network.frequency || 0);
      return {
        ssid,
        bssid,
        frequency,
        channel: Number(network.channel || 0),
        rssi: Number(network.rssi || -100),
        capabilities: String(network.capabilities || ''),
        band: getBand(frequency),
        isCurrent: Boolean((currentBssid && bssid === currentBssid) || (!currentBssid && currentSsid && ssid === currentSsid)),
      };
    })
    .filter((network) => network.channel > 0);

  return {
    networks,
    current: {
      ssid: currentSsid,
      bssid: currentBssid,
    },
  };
};

export const groupNetworksByBand = (networks: WiFiNetwork[]) => (
  networks.reduce<Record<WiFiBand, WiFiNetwork[]>>((groups, network) => {
    groups[network.band].push(network);
    return groups;
  }, { '2.4GHz': [], '5GHz': [], '6GHz': [], Other: [] })
);

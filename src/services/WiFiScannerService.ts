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

const frequencyToChannel = (frequency: number): number => {
  if (frequency === 2484) return 14;
  if (frequency >= 2412 && frequency <= 2472) return (frequency - 2407) / 5;
  if (frequency >= 4910 && frequency <= 5895) return (frequency - 5000) / 5;
  if (frequency >= 5955 && frequency <= 7115) return (frequency - 5950) / 5;
  return 0;
};

const requestAndroidPermissions = async () => {
  if (Platform.OS !== 'android') return false;

  const androidVersion = typeof Platform.Version === 'number' ? Platform.Version : Number(Platform.Version);
  const nearbyWifiPermission = (PermissionsAndroid.PERMISSIONS as any).NEARBY_WIFI_DEVICES;

  // On Android 13+: NEARBY_WIFI_DEVICES alone is sufficient for WiFi scanning
  if (androidVersion >= 33 && nearbyWifiPermission) {
    const result = await PermissionsAndroid.requestMultiple([nearbyWifiPermission]);
    if (result[nearbyWifiPermission] === PermissionsAndroid.RESULTS.GRANTED) {
      return true;
    }
    // Fall through to try location permission as fallback
  }

  const result = await PermissionsAndroid.requestMultiple([PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION]);
  return result[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] === PermissionsAndroid.RESULTS.GRANTED;
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
    throw new Error('Location and nearby WiFi permission are required to scan WiFi networks.');
  }

  const [rawNetworks, current] = await Promise.all([
    NativeWiFiScanner.scanAsync(),
    NativeWiFiScanner.getCurrentNetworkAsync(),
  ]);
  
  console.log('WiFi scan debug - raw results:', rawNetworks?.length || 0, 'networks');
  console.log('WiFi scan debug - current network:', current);
  
  const currentBssid = typeof current?.bssid === 'string' ? current.bssid.toLowerCase() : null;
  const currentSsid = typeof current?.ssid === 'string' ? current.ssid : null;

  const networks = (Array.isArray(rawNetworks) ? rawNetworks : [])
    .filter((network) => network && typeof network === 'object')
    .map((network) => {
      const bssid = String(network.bssid || '').toLowerCase();
      const ssid = String(network.ssid || 'Hidden network');
      const frequency = Number(network.frequency || 0);
      let channel = Number(network.channel || 0);
      
      // Calculate channel from frequency if not provided
      if (channel === 0 && frequency > 0) {
        channel = frequencyToChannel(frequency);
      }
      
      return {
        ssid,
        bssid,
        frequency,
        channel,
        rssi: Number(network.rssi || -100),
        capabilities: String(network.capabilities || ''),
        band: getBand(frequency),
        isCurrent: Boolean((currentBssid && bssid === currentBssid) || (!currentBssid && currentSsid && ssid === currentSsid)),
      };
    })
    .filter((network) => network.channel > 0 && network.ssid !== 'Hidden network');

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

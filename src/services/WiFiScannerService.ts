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
  rssi?: number;
  frequency?: number;
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
  // 2.4 GHz
  if (frequency >= 2412 && frequency <= 2472) return Math.round((frequency - 2407) / 5);
  // 5 GHz (Channels 36-177)
  if (frequency >= 5170 && frequency <= 5900) return Math.round((frequency - 5000) / 5);
  // 6 GHz (Channels 1-233)
  if (frequency >= 5945 && frequency <= 7125) return Math.round((frequency - 5940) / 5);
  return 0;
};

const requestAndroidPermissions = async () => {
  if (Platform.OS !== 'android') return false;

  const androidVersion = typeof Platform.Version === 'number' ? Platform.Version : Number(Platform.Version);
  const nearbyWifiPermission = (PermissionsAndroid.PERMISSIONS as any).NEARBY_WIFI_DEVICES;

  // On Android 13+: NEARBY_WIFI_DEVICES is preferred
  if (androidVersion >= 33 && nearbyWifiPermission) {
    const result = await PermissionsAndroid.requestMultiple([
      nearbyWifiPermission,
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    ]);
    return (
      result[nearbyWifiPermission] === PermissionsAndroid.RESULTS.GRANTED ||
      result[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] === PermissionsAndroid.RESULTS.GRANTED
    );
  }

  const result = await PermissionsAndroid.requestMultiple([PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION]);
  return result[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] === PermissionsAndroid.RESULTS.GRANTED;
};

export const isWiFiScannerAvailable = () => Platform.OS === 'android' && Boolean(NativeWiFiScanner);

export const isLocationEnabled = async (): Promise<boolean> => {
  if (Platform.OS !== 'android' || !NativeWiFiScanner) return true;
  try {
    return await NativeWiFiScanner.isLocationEnabledAsync();
  } catch (_e) {
    return true;
  }
};

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
    NativeWiFiScanner.scanAsync().catch(() => []),
    NativeWiFiScanner.getCurrentNetworkAsync().catch(() => ({ ssid: null, bssid: null })),
  ]);
  
  const currentBssid = typeof current?.bssid === 'string' ? current.bssid.toLowerCase() : null;
  const currentSsid = typeof current?.ssid === 'string' ? current.ssid : null;

  let networks = (Array.isArray(rawNetworks) ? rawNetworks : [])
    .filter((network) => network && typeof network === 'object')
    .map((network) => {
      const bssid = String(network.bssid || '').toLowerCase();
      const ssid = String(network.ssid || 'Hidden network');
      const frequency = Number(network.frequency || 0);
      let channel = Number(network.channel || 0);
      
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
        isCurrent: Boolean((currentBssid && bssid === currentBssid) || (!currentBssid && currentSsid && ssid === currentSsid && ssid !== 'Connected (SSID hidden)')),
      };
    });

  // If we are connected but the current network is not in the scan results, add it syntheticly
  const hasCurrentInList = networks.some((n) => n.isCurrent);
  if (!hasCurrentInList && (currentSsid || currentBssid)) {
    const frequency = Number(current?.frequency || 0);
    const channel = frequencyToChannel(frequency);
    
    // Even if frequency is 0, we add it if we know we are connected
    networks.push({
      ssid: currentSsid || 'Connected network',
      bssid: currentBssid || '',
      frequency: frequency,
      channel: channel || 0,
      rssi: Number(current?.rssi || -50),
      capabilities: '[CURRENT]',
      band: frequency > 0 ? getBand(frequency) : 'Other',
      isCurrent: true,
    });
  }

  // Filter out invalid channels, but KEEP "Hidden networks" because they still cause congestion!
  networks = networks.filter((network) => (network.channel > 0 || network.isCurrent));

  return {
    networks,
    current: {
      ssid: currentSsid,
      bssid: currentBssid,
      rssi: current?.rssi,
      frequency: current?.frequency,
    },
  };
};


export const groupNetworksByBand = (networks: WiFiNetwork[]) => (
  networks.reduce<Record<WiFiBand, WiFiNetwork[]>>((groups, network) => {
    groups[network.band].push(network);
    return groups;
  }, { '2.4GHz': [], '5GHz': [], '6GHz': [], Other: [] })
);

import * as Cellular from 'expo-cellular';
import { Platform, PermissionsAndroid } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';

type NativeCellularRadioModule = {
  getCellInfoAsync(): Promise<{
    rsrp?: number | null;
    rsrq?: number | null;
    band?: string | null;
    earfcn?: number | null;
    cellId?: string | null;
  } | null>;
};

export type CellularRadioSnapshot = {
  networkType: string | null;
  carrierName: string | null;
  rsrp: number | null;
  rsrq: number | null;
  band: string | null;
  earfcn: number | null;
  cellId: string | null;
};

type CellularRadioOptions = {
  enableDetailedRadio?: boolean;
};

const ExpoCellularRadio = requireOptionalNativeModule<NativeCellularRadioModule>('ExpoCellularRadio');

const CELLULAR_GENERATION_LABELS: Record<number, string | null> = {
  [Cellular.CellularGeneration.UNKNOWN]: null,
  [Cellular.CellularGeneration.CELLULAR_2G]: '2G',
  [Cellular.CellularGeneration.CELLULAR_3G]: '3G',
  [Cellular.CellularGeneration.CELLULAR_4G]: '4G LTE',
  [Cellular.CellularGeneration.CELLULAR_5G]: '5G NR',
};

const emptySnapshot = (): CellularRadioSnapshot => ({
  networkType: null,
  carrierName: null,
  rsrp: null,
  rsrq: null,
  band: null,
  earfcn: null,
  cellId: null,
});

const requestAndroidCellularPermissions = async (): Promise<boolean> => {
  const phonePermission = await Cellular.getPermissionsAsync().catch(() => null);
  let phoneGranted = phonePermission?.granted ?? false;

  if (!phoneGranted) {
    const requested = await Cellular.requestPermissionsAsync().catch(() => null);
    phoneGranted = requested?.granted ?? false;
  }

  const hasFineLocation = await PermissionsAndroid.check(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
  ).catch(() => false);

  let fineGranted = hasFineLocation;
  if (!fineGranted) {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      {
        title: 'Cellular signal access',
        message: 'Flash uses location permission on Android to read serving-cell radio details during a speed test.',
        buttonPositive: 'Allow',
        buttonNegative: 'Deny',
      },
    ).catch(() => PermissionsAndroid.RESULTS.DENIED);

    fineGranted = granted === PermissionsAndroid.RESULTS.GRANTED;
  }

  return Boolean(phoneGranted && fineGranted);
};

export const getCellularRadioSnapshot = async (
  options: CellularRadioOptions = {},
): Promise<CellularRadioSnapshot> => {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') {
    return emptySnapshot();
  }

  if (Platform.OS === 'android' && !options.enableDetailedRadio) {
    return emptySnapshot();
  }

  const permissionsGranted = Platform.OS === 'android'
    ? await requestAndroidCellularPermissions()
    : true;

  if (!permissionsGranted) {
    return emptySnapshot();
  }

  const generation = await Cellular.getCellularGenerationAsync().catch(
    () => Cellular.CellularGeneration.UNKNOWN,
  );
  const networkType = CELLULAR_GENERATION_LABELS[generation] ?? null;

  if (!networkType) {
    return emptySnapshot();
  }

  const carrierName = await Cellular.getCarrierNameAsync().catch(() => null);

  if (Platform.OS !== 'android' || !ExpoCellularRadio) {
    return {
      ...emptySnapshot(),
      networkType,
      carrierName: carrierName ?? null,
    };
  }

  const cellInfo = await ExpoCellularRadio.getCellInfoAsync().catch(() => null);

  return {
    networkType,
    carrierName: carrierName ?? null,
    rsrp: cellInfo?.rsrp ?? null,
    rsrq: cellInfo?.rsrq ?? null,
    band: cellInfo?.band ?? null,
    earfcn: cellInfo?.earfcn ?? null,
    cellId: cellInfo?.cellId ?? null,
  };
};

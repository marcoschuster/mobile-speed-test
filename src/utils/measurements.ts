// ── Type Definitions ─────────────────────────────────────────────────────────
type SpeedUnit = 'mbps' | 'kbps' | 'mbs';

interface SpeedUnitConfig {
  label: string;
  multiplier: number;
}

interface ConnectionQualityParams {
  download?: number;
  upload?: number;
  ping?: number;
}

interface ConnectionQualityResult {
  label: string;
  summary: string;
}

const SPEED_UNIT_MAP: Record<string, SpeedUnitConfig> = {
  mbps: { label: 'Mbps', multiplier: 1 },
  kbps: { label: 'Kbps', multiplier: 1000 },
  mbs: { label: 'MB/s', multiplier: 0.125 },
};

const getDisplayDecimals = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  if (value >= 100) return 0;
  if (value >= 10) return 1;
  return 2;
};

export const getSpeedUnitLabel = (unit: SpeedUnit = 'mbps'): string =>
  SPEED_UNIT_MAP[unit]?.label || SPEED_UNIT_MAP.mbps.label;

export const convertSpeedFromMbps = (value: number, unit: SpeedUnit = 'mbps'): number => {
  const multiplier = SPEED_UNIT_MAP[unit]?.multiplier || SPEED_UNIT_MAP.mbps.multiplier;
  return value * multiplier;
};

export const formatSpeedValue = (value: number, unit: SpeedUnit = 'mbps', decimals?: number): string => {
  const numeric = Number.isFinite(value) ? value : 0;
  const converted = convertSpeedFromMbps(numeric, unit);
  return converted.toFixed(decimals ?? getDisplayDecimals(converted));
};

export const formatSpeedWithUnit = (value: number, unit: SpeedUnit = 'mbps', decimals?: number): string =>
  `${formatSpeedValue(value, unit, decimals)} ${getSpeedUnitLabel(unit)}`;

export const formatBytes = (value: number): string => {
  const bytes = Number.isFinite(value) ? Math.max(0, value) : 0;
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (bytes >= 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${Math.round(bytes)} B`;
};

export const formatPing = (value: number): string => `${Math.round(Number.isFinite(value) ? value : 0)} ms`;

export const getConnectionQuality = ({ download = 0, upload = 0, ping = 0 }: ConnectionQualityParams): ConnectionQualityResult => {
  if (download >= 150 && upload >= 30 && ping <= 20) {
    return {
      label: 'Excellent',
      summary: 'Strong for 4K streaming, cloud gaming, and large uploads.',
    };
  }

  if (download >= 50 && upload >= 10 && ping <= 40) {
    return {
      label: 'Great',
      summary: 'Comfortable for video calls, streaming, and most remote work.',
    };
  }

  if (download >= 25 && upload >= 5 && ping <= 70) {
    return {
      label: 'Good',
      summary: 'Solid for HD streaming, browsing, and general day-to-day use.',
    };
  }

  if (download >= 10 && upload >= 2 && ping <= 120) {
    return {
      label: 'Fair',
      summary: 'Usable, but you may notice slow uploads and weaker call quality.',
    };
  }

  return {
    label: 'Limited',
    summary: 'Suitable for light browsing, but demanding apps may struggle.',
  };
};

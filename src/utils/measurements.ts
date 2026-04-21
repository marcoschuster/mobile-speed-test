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
  // Tier 1: Gigabit fiber - Ultra premium
  if (download >= 1000 && upload >= 500 && ping <= 10) {
    return {
      label: 'Ultra Premium',
      summary: 'Gigabit fiber: Perfect for 8K streaming, VR, and massive parallel downloads.',
    };
  }

  // Tier 2: High-end fiber - Outstanding
  if (download >= 500 && upload >= 200 && ping <= 15) {
    return {
      label: 'Outstanding',
      summary: 'High-speed fiber: Ideal for 4K HDR streaming, cloud gaming, and large file transfers.',
    };
  }

  // Tier 3: Premium fiber - Excellent
  if (download >= 300 && upload >= 100 && ping <= 20) {
    return {
      label: 'Excellent',
      summary: 'Premium fiber: Great for 4K streaming, video conferencing, and heavy multi-tasking.',
    };
  }

  // Tier 4: High cable - Very Good
  if (download >= 200 && upload >= 50 && ping <= 25) {
    return {
      label: 'Very Good',
      summary: 'High-speed cable: Smooth 4K streaming, fast downloads, and solid remote work.',
    };
  }

  // Tier 5: Good cable - Great
  if (download >= 150 && upload >= 30 && ping <= 30) {
    return {
      label: 'Great',
      summary: 'Fast cable: Excellent for HD streaming, gaming, and family use.',
    };
  }

  // Tier 6: Solid cable - Very Good
  if (download >= 100 && upload >= 20 && ping <= 40) {
    return {
      label: 'Very Good',
      summary: 'Solid connection: Good for video calls, streaming, and most online activities.',
    };
  }

  // Tier 7: Good connection - Good
  if (download >= 75 && upload >= 15 && ping <= 50) {
    return {
      label: 'Good',
      summary: 'Reliable: Comfortable for HD streaming, browsing, and work from home.',
    };
  }

  // Tier 8: Decent connection - Good
  if (download >= 50 && upload >= 10 && ping <= 60) {
    return {
      label: 'Good',
      summary: 'Decent: Handles HD streaming, video calls, and multiple devices well.',
    };
  }

  // Tier 9: Solid WiFi - Above Average
  if (download >= 40 && upload >= 8 && ping <= 70) {
    return {
      label: 'Above Average',
      summary: 'Solid WiFi: Good for streaming, browsing, and light work from home.',
    };
  }

  // Tier 10: Average connection - Average
  if (download >= 30 && upload >= 5 && ping <= 80) {
    return {
      label: 'Average',
      summary: 'Standard: Suitable for SD/HD streaming and general daily use.',
    };
  }

  // Tier 11: Moderate connection - Fair
  if (download >= 20 && upload >= 3 && ping <= 100) {
    return {
      label: 'Fair',
      summary: 'Moderate: Usable for streaming and browsing, but may slow with multiple users.',
    };
  }

  // Tier 12: Basic connection - Fair
  if (download >= 15 && upload >= 2 && ping <= 120) {
    return {
      label: 'Fair',
      summary: 'Basic: Works for browsing and light streaming, uploads will be slow.',
    };
  }

  // Tier 13: Limited connection - Poor
  if (download >= 10 && upload >= 1 && ping <= 150) {
    return {
      label: 'Poor',
      summary: 'Limited: Suitable for light browsing, video may buffer, uploads very slow.',
    };
  }

  // Tier 14: Weak connection - Very Poor
  if (download >= 5 && upload >= 0.5 && ping <= 200) {
    return {
      label: 'Very Poor',
      summary: 'Weak: Only basic browsing, streaming not recommended.',
    };
  }

  // Tier 15: Minimal connection - Extremely Poor
  if (download >= 1 && upload >= 0.1 && ping <= 300) {
    return {
      label: 'Extremely Poor',
      summary: 'Minimal: Only text browsing possible, very slow experience.',
    };
  }

  return {
    label: 'No Connection',
    summary: 'Unable to measure connection speed reliably.',
  };
};

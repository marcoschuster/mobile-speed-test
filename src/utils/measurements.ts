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

const getLatencyNote = (ping: number): string => {
  if (!Number.isFinite(ping) || ping <= 0) return 'Latency was not measured.';
  if (ping <= 30) return 'Latency is responsive enough for calls and gaming.';
  if (ping <= 60) return 'Latency is normal for streaming, calls, and casual gaming.';
  if (ping <= 100) return 'Latency is noticeable but fine for video and everyday use.';
  if (ping <= 150) return 'Latency is high, so games and live calls may feel delayed.';
  return 'Latency is very high, so real-time gaming and calls may feel unstable.';
};

export const getConnectionQuality = ({ download = 0, upload = 0, ping = 0 }: ConnectionQualityParams): ConnectionQualityResult => {
  const latencyNote = getLatencyNote(ping);

  if (download >= 1000 && upload >= 300) {
    return {
      label: ping <= 30 ? 'Ultra Premium' : 'Ultra Bandwidth',
      summary: `Gigabit-class connection: excellent for 8K/4K streaming, huge downloads, cloud backups, and many devices. ${latencyNote}`,
    };
  }

  if (download >= 500 && upload >= 100) {
    return {
      label: ping <= 40 ? 'Outstanding' : 'Outstanding Bandwidth',
      summary: `Very fast connection: great for 4K HDR streaming, cloud gaming when latency is low, and large uploads. ${latencyNote}`,
    };
  }

  if (download >= 300 && upload >= 50) {
    return {
      label: ping <= 50 ? 'Excellent' : 'Excellent Bandwidth',
      summary: `Excellent for 4K streaming, video calls, large downloads, and busy households. ${latencyNote}`,
    };
  }

  if (download >= 150 && upload >= 25) {
    return {
      label: ping <= 60 ? 'Very Good' : 'Very Good Bandwidth',
      summary: `Very good for 4K streaming, work calls, gaming downloads, and several active devices. ${latencyNote}`,
    };
  }

  if (download >= 75 && upload >= 10) {
    return {
      label: ping <= 80 ? 'Good' : 'Good Bandwidth',
      summary: `Good everyday connection: handles HD/4K streaming, video calls, browsing, and normal multi-device use. ${latencyNote}`,
    };
  }

  if (download >= 50 && upload >= 5) {
    return {
      label: ping <= 100 ? 'Solid' : 'Solid Bandwidth',
      summary: `Solid connection: 50 Mbps down is enough for HD streaming, typical 4K streaming, calls, browsing, and downloads. Uploads are fine for calls and light cloud work. ${latencyNote}`,
    };
  }

  if (download >= 25 && upload >= 3) {
    return {
      label: 'Decent',
      summary: `Decent for HD streaming, browsing, and video calls. 4K may work on one device but has less headroom. ${latencyNote}`,
    };
  }

  if (download >= 10 && upload >= 1) {
    return {
      label: 'Basic',
      summary: `Basic but usable: browsing, messaging, music, and one SD/HD stream should work, but multitasking and uploads are limited. ${latencyNote}`,
    };
  }

  if (download >= 5 && upload >= 0.5) {
    return {
      label: 'Limited',
      summary: `Limited connection: browsing and low-resolution streaming may work, but calls, downloads, and multiple devices will struggle. ${latencyNote}`,
    };
  }

  if (download >= 1 && upload >= 0.1) {
    return {
      label: 'Very Limited',
      summary: `Very limited: messaging and light pages may load, but video and calls are likely unreliable. ${latencyNote}`,
    };
  }

  return {
    label: 'No Connection',
    summary: 'Unable to measure connection speed reliably.',
  };
};

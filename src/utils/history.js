import { LEGAL_EFFECTIVE_DATE } from '../config/appInfo';

export const pruneHistoryByRetention = (history, retentionDays) => {
  if (!Array.isArray(history)) return [];
  if (!retentionDays || retentionDays < 0) return history;

  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  return history.filter((item) => {
    const timestamp = new Date(item.date).getTime();
    return Number.isFinite(timestamp) && timestamp >= cutoff;
  });
};

export const summarizeHistory = (history) => {
  if (!history.length) {
    return {
      totalTests: 0,
      averageDownload: 0,
      averageUpload: 0,
      averagePing: 0,
      totalDataUsedBytes: 0,
      recentTrend: 'steady',
      lastTest: null,
    };
  }

  const totals = history.reduce(
    (acc, item) => ({
      averageDownload: acc.averageDownload + (item.download || 0),
      averageUpload: acc.averageUpload + (item.upload || 0),
      averagePing: acc.averagePing + (item.ping || 0),
      totalDataUsedBytes: acc.totalDataUsedBytes + (item.totalBytes || 0),
    }),
    { averageDownload: 0, averageUpload: 0, averagePing: 0, totalDataUsedBytes: 0 },
  );

  const sorted = [...history].sort((a, b) => new Date(b.date) - new Date(a.date));
  const latest = sorted[0];
  const previous = sorted[1];

  let recentTrend = 'steady';
  if (previous) {
    const delta = (latest.download || 0) - (previous.download || 0);
    if (delta >= 10) recentTrend = 'up';
    else if (delta <= -10) recentTrend = 'down';
  }

  return {
    totalTests: history.length,
    averageDownload: totals.averageDownload / history.length,
    averageUpload: totals.averageUpload / history.length,
    averagePing: totals.averagePing / history.length,
    totalDataUsedBytes: totals.totalDataUsedBytes,
    recentTrend,
    lastTest: latest,
  };
};

export const buildHistoryCsv = (history) => {
  const header = [
    'date',
    'download_mbps',
    'upload_mbps',
    'ping_ms',
    'download_bytes',
    'upload_bytes',
    'total_bytes',
    'server_name',
    'server_location',
    'provider',
  ];

  const rows = history.map((item) => [
    item.date || '',
    Number(item.download || 0).toFixed(2),
    Number(item.upload || 0).toFixed(2),
    Math.round(Number(item.ping || 0)),
    Math.round(Number(item.downloadBytes || 0)),
    Math.round(Number(item.uploadBytes || 0)),
    Math.round(Number(item.totalBytes || 0)),
    sanitizeCsvValue(item.serverName || ''),
    sanitizeCsvValue(item.serverLocation || ''),
    sanitizeCsvValue(item.provider || ''),
  ]);

  return [
    `# ZOLT speed history export`,
    `# generated_at=${new Date().toISOString()}`,
    `# privacy_policy_effective_date=${LEGAL_EFFECTIVE_DATE}`,
    header.join(','),
    ...rows.map((row) => row.join(',')),
  ].join('\n');
};

const sanitizeCsvValue = (value) => `"${String(value).replace(/"/g, '""')}"`;

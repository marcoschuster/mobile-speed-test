export interface HistoryItem {
  id: string;
  date: string;
  download: number;
  upload: number;
  ping: number;
  jitter: number;
  testProvider: string;
}

export const buildHistoryCsv = (history: HistoryItem[]): string => {
  if (!history || history.length === 0) {
    return '';
  }

  const header = 'Date,Download (Mbps),Upload (Mbps),Ping (ms),Jitter (ms),Provider';
  const rows = history.map(item =>
    `${item.date},${item.download.toFixed(2)},${item.upload.toFixed(2)},${item.ping.toFixed(2)},${item.jitter.toFixed(2)},${item.testProvider}`
  );

  return [header, ...rows].join('\n');
};

export const summarizeHistory = (history: HistoryItem[]) => {
  if (!history || history.length === 0) {
    return {
      avgDownload: 0,
      avgUpload: 0,
      avgPing: 0,
      avgJitter: 0,
      totalTests: 0,
      totalDataUsedBytes: 0,
      bestDownload: 0,
      bestUpload: 0,
      bestPing: Infinity,
    };
  }

  const totalDownload = history.reduce((sum, item) => sum + item.download, 0);
  const totalUpload = history.reduce((sum, item) => sum + item.upload, 0);
  const totalPing = history.reduce((sum, item) => sum + item.ping, 0);
  const totalJitter = history.reduce((sum, item) => sum + item.jitter, 0);

  const bestDownload = Math.max(...history.map(item => item.download));
  const bestUpload = Math.max(...history.map(item => item.upload));
  const bestPing = Math.min(...history.map(item => item.ping));

  // Estimate data used: assume 10MB per test (simplified)
  const totalDataUsedBytes = history.length * 10 * 1024 * 1024;

  return {
    avgDownload: totalDownload / history.length,
    avgUpload: totalUpload / history.length,
    avgPing: totalPing / history.length,
    avgJitter: totalJitter / history.length,
    totalTests: history.length,
    totalDataUsedBytes,
    bestDownload,
    bestUpload,
    bestPing,
  };
};

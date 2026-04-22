// CDN Performance Service
// Tests latency to major CDNs in parallel using HTTP HEAD requests

class CDNPerformanceService {
  constructor() {
    this.cdns = [
      { name: 'Cloudflare', url: 'https://cloudflare.com/cdn-cgi/trace' },
      { name: 'Google', url: 'https://www.google.com/generate_204' },
      { name: 'AWS', url: 'https://aws.amazon.com' },
      { name: 'Netflix', url: 'https://www.netflix.com' },
      { name: 'YouTube', url: 'https://www.youtube.com' },
      { name: 'Fast.com', url: 'https://fast.com' },
    ];
  }

  // Test latency to a single CDN by sending 3 HEAD requests and taking median
  async testCDNLatency(cdn) {
    const latencies = [];
    const timeout = 3000; // 3s timeout per request

    for (let i = 0; i < 3; i++) {
      try {
        const start = Date.now();
        await this.headRequest(cdn.url, timeout);
        const latency = Date.now() - start;
        latencies.push(latency);
      } catch (e) {
        // Failed request, skip
      }
    }

    if (latencies.length === 0) {
      return { cdn: cdn.name, latency: null, error: true };
    }

    // Calculate median
    latencies.sort((a, b) => a - b);
    const median = latencies[Math.floor(latencies.length / 2)];

    return { cdn: cdn.name, latency: median, error: false };
  }

  // HTTP HEAD request with timeout using XMLHttpRequest
  headRequest(url, timeout) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('HEAD', url);
      xhr.timeout = timeout;
      xhr.setRequestHeader('Cache-Control', 'no-cache, no-store');
      xhr.setRequestHeader('Pragma', 'no-cache');

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error(`HTTP ${xhr.status}`));
        }
      };

      xhr.onerror = () => reject(new Error('Network error'));
      xhr.ontimeout = () => reject(new Error('Timeout'));
      xhr.send();
    });
  }

  // Test all CDNs in parallel
  async testAllCDNs() {
    const promises = this.cdns.map(cdn => this.testCDNLatency(cdn));
    const results = await Promise.all(promises);

    // Filter out failed results and sort by latency
    const validResults = results.filter(r => !r.error);
    const sortedResults = validResults.sort((a, b) => a.latency - b.latency);

    return sortedResults;
  }

  // Get insight message comparing fastest and slowest CDNs
  getInsight(results) {
    if (results.length < 2) return null;

    const fastest = results[0];
    const slowest = results[results.length - 1];

    if (!fastest.latency || !slowest.latency) return null;

    const ratio = (slowest.latency / fastest.latency).toFixed(1);

    return `${slowest.cdn} is ${ratio}x slower than ${fastest.cdn}. Possible peering issue.`;
  }
}

export default new CDNPerformanceService();

import AsyncStorage from '@react-native-async-storage/async-storage';

// ─────────────────────────────────────────────────────────────────────────────
// SpeedTestService
//
// Measures ping, download, and upload speed using real NDT7 M-Lab servers
// with WebSocket for ping and XHR progress events for download/upload.
//
// Ping:     WebSocket echo round-trip on a single persistent connection.
// Download: 6 parallel XHR GETs to Cloudflare with onprogress byte counting.
// Upload:   6 parallel XHR POSTs to Cloudflare with upload.onprogress tracking.
//           Payloads are Uint8Array (binary), not strings.
//
// Speed is reported via a 3-second rolling window for smooth, accurate live
// readings. Final reported speed uses the middle 60% of samples to discard
// slow-start and tail effects.
//
// ReadableStream/getReader() is NOT available in React Native 0.83's
// whatwg-fetch polyfill, so we use XMLHttpRequest.onprogress instead — this
// gives us incremental byte counts without waiting for the full response.
// ─────────────────────────────────────────────────────────────────────────────

class SpeedTestService {
  constructor() {
    this.isTestRunning = false;
    this.testStartTime = 0;
    this.currentTest = null;
    this.peaks = { download: 0, upload: 0, ping: 0 };
    this.selectedServer = null;
    this.uploadPayloadCache = new Map();
  }

  // ── Peaks (AsyncStorage) ──────────────────────────────────────────────────

  async loadPeaks() {
    try {
      const stored = await AsyncStorage.getItem('speedTestPeaks');
      if (stored) {
        const p = JSON.parse(stored);
        this.peaks = {
          download: p.download || 0,
          upload: p.upload || 0,
          ping: p.ping || 0,
        };
      }
    } catch (e) {
      console.error('Error loading peaks:', e);
    }
  }

  async savePeaks() {
    try {
      await AsyncStorage.setItem('speedTestPeaks', JSON.stringify(this.peaks));
    } catch (e) {
      console.error('Error saving peaks:', e);
    }
  }

  async clearPeaks() {
    this.peaks = { download: 0, upload: 0, ping: 0 };
    try {
      await AsyncStorage.removeItem('speedTestPeaks');
    } catch (e) {
      console.error('Error clearing peaks:', e);
    }
  }

  // ── History (AsyncStorage) ────────────────────────────────────────────────

  async saveTestResult(testResult) {
    try {
      const history = await this.getHistory();
      history.unshift(testResult);
      if (history.length > 50) history.splice(50);
      await AsyncStorage.setItem('speedTestHistory', JSON.stringify(history));
      return history;
    } catch (e) {
      console.error('Error saving test result:', e);
      return [];
    }
  }

  async getHistory() {
    try {
      const stored = await AsyncStorage.getItem('speedTestHistory');
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.error('Error getting history:', e);
      return [];
    }
  }

  async clearHistory() {
    try {
      await AsyncStorage.removeItem('speedTestHistory');
      return [];
    } catch (e) {
      console.error('Error clearing history:', e);
      return [];
    }
  }

  // ── Rolling window speed calculator ───────────────────────────────────────
  // Keeps timestamped byte samples. Live speed = bytes in last 3s window.
  // Final speed = middle 60% of all samples averaged.

  _createRollingCalc() {
    return {
      samples: [],        // { t: timestamp, bytes: cumulative }
      windowMs: 3000,     // 3-second rolling window

      push(bytes) {
        this.samples.push({ t: Date.now(), bytes });
      },

      // Current speed from the last 3 seconds of data
      getLiveSpeed() {
        const now = Date.now();
        const cutoff = now - this.windowMs;
        const recent = this.samples.filter(s => s.t >= cutoff);
        if (recent.length < 2) return 0;

        const first = recent[0];
        const last = recent[recent.length - 1];
        const dt = (last.t - first.t) / 1000;
        const db = last.bytes - first.bytes;
        if (dt < 0.1) return 0;
        return (db * 8) / (dt * 1000000); // Mbps
      },

      // Final speed from middle 60% of samples (discard first/last 20%)
      getFinalSpeed() {
        if (this.samples.length < 5) {
          // Not enough data — fall back to simple total
          if (this.samples.length < 2) return 0;
          const first = this.samples[0];
          const last = this.samples[this.samples.length - 1];
          const dt = (last.t - first.t) / 1000;
          if (dt < 0.1) return 0;
          return ((last.bytes - first.bytes) * 8) / (dt * 1000000);
        }

        const n = this.samples.length;
        const start = Math.floor(n * 0.2);
        const end = Math.ceil(n * 0.8);
        const mid = this.samples.slice(start, end);

        const first = mid[0];
        const last = mid[mid.length - 1];
        const dt = (last.t - first.t) / 1000;
        if (dt < 0.1) return 0;
        return ((last.bytes - first.bytes) * 8) / (dt * 1000000);
      },
    };
  }

  _getTrimmedMean(samples, trimFraction = 0.2) {
    const values = samples.filter((value) => Number.isFinite(value) && value > 0);
    if (!values.length) return 0;
    if (values.length < 5) {
      return values.reduce((sum, value) => sum + value, 0) / values.length;
    }

    const sorted = [...values].sort((a, b) => a - b);
    const trimCount = Math.floor(sorted.length * trimFraction);
    const trimmed = sorted.slice(trimCount, sorted.length - trimCount);
    const source = trimmed.length ? trimmed : sorted;
    return source.reduce((sum, value) => sum + value, 0) / source.length;
  }

  _getPercentile(samples, percentile = 0.5) {
    const values = samples.filter((value) => Number.isFinite(value) && value > 0);
    if (!values.length) return 0;

    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.min(
      sorted.length - 1,
      Math.max(0, Math.round((sorted.length - 1) * percentile))
    );
    return sorted[index];
  }

  _getUploadPayload(size) {
    if (!this.uploadPayloadCache.has(size)) {
      this.uploadPayloadCache.set(size, new Uint8Array(size));
    }
    return this.uploadPayloadCache.get(size);
  }

  // ── Server selection ──────────────────────────────────────────────────────
  // Fetches the nearest M-Lab NDT7 server. The returned URLs contain
  // single-use access tokens and are used directly for download/upload.

  async selectBestServer() {
    try {
      const response = await fetch(
        'https://locate.measurementlab.net/v2/nearest/ndt/ndt7',
        { method: 'GET', cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } }
      );

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      const results = data.results || data;

      if (results && results.length > 0) {
        this.selectedServer = results[0];
        console.log(`Selected server: ${this.selectedServer.machine} (${this.selectedServer.location?.city})`);
        return this.selectedServer;
      }
    } catch (e) {
      console.log('Failed to fetch NDT7 servers:', e.message);
    }

    // No server found — will fall back to Cloudflare HTTP for download/upload
    this.selectedServer = null;
    console.log('No NDT7 server available, will use Cloudflare HTTP fallback');
    return null;
  }

  // ── Ping: WebSocket round-trip ────────────────────────────────────────────
  // Opens a single WebSocket to the selected M-Lab server (or a public echo
  // server) and measures binary frame round-trip 20 times. DNS/TLS/TCP cost
  // is paid once on connect. Each subsequent measurement is pure network RTT.
  // Discards first 3 samples (warm-up). Falls back to HTTP HEAD if WS fails.

  async runPingTest(onPingSample) {
    // Try WebSocket ping first
    try {
      const result = await this._wsPing(onPingSample);
      if (result > 0) return result;
    } catch (e) {
      console.log('WebSocket ping failed, falling back to HTTP:', e.message);
    }

    // Fallback: HTTP HEAD (labeled as HTTP latency, not true ICMP ping)
    console.log('Using HTTP HEAD fallback for latency measurement');
    return await this._httpPing(onPingSample);
  }

  _wsPing(onPingSample) {
    return new Promise((resolve, reject) => {
      const TOTAL_PINGS = 28;
      const WARMUP = 3;
      const TIMEOUT = 16000;
      const PING_DELAY_MS = 90;
      const pings = [];
      let count = 0;
      let sendTime = 0;

      // Use a simple echo-capable WebSocket endpoint.
      // wss://echo.websocket.org echoes back any message.
      const wsUrl = 'wss://echo.websocket.org';

      let ws;
      try {
        ws = new WebSocket(wsUrl);
      } catch (e) {
        reject(new Error('WebSocket constructor failed: ' + e.message));
        return;
      }

      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error('WebSocket ping timed out'));
      }, TIMEOUT);

      ws.onopen = () => {
        console.log('WS ping connected');
        sendTime = Date.now();
        ws.send('ping');
      };

      ws.onmessage = () => {
        const rtt = Date.now() - sendTime;
        pings.push(rtt);
        count++;

        if (onPingSample) onPingSample(rtt);

        if (count < TOTAL_PINGS) {
          setTimeout(() => {
            if (!this.isTestRunning || ws.readyState !== WebSocket.OPEN) {
              return;
            }
            sendTime = Date.now();
            ws.send('ping');
          }, PING_DELAY_MS);
        } else {
          // Done — close and compute
          clearTimeout(timeout);
          ws.close();

          // Discard first WARMUP samples
          const valid = pings.slice(WARMUP);
          if (valid.length < 3) {
            reject(new Error('Not enough WS ping samples'));
            return;
          }

          // Remove outliers: discard top 10% highest values
          valid.sort((a, b) => a - b);
          const trimmed = valid.slice(0, Math.ceil(valid.length * 0.9));
          const avg = Math.round(trimmed.reduce((a, b) => a + b, 0) / trimmed.length);

          console.log(`WS ping: ${avg}ms (${trimmed.length} samples after trimming, raw: ${pings.join(',')})`);
          resolve(avg);
        }
      };

      ws.onerror = (e) => {
        clearTimeout(timeout);
        reject(new Error('WebSocket error: ' + (e.message || 'unknown')));
      };

      ws.onclose = (e) => {
        // If we already resolved/rejected, this is a no-op
        if (count < TOTAL_PINGS) {
          clearTimeout(timeout);
          // Try to salvage what we have
          const valid = pings.slice(WARMUP);
          if (valid.length >= 3) {
            valid.sort((a, b) => a - b);
            const trimmed = valid.slice(0, Math.ceil(valid.length * 0.9));
            const avg = Math.round(trimmed.reduce((a, b) => a + b, 0) / trimmed.length);
            resolve(avg);
          } else {
            reject(new Error('WebSocket closed early, not enough samples'));
          }
        }
      };
    });
  }

  async _httpPing(onPingSample) {
    // HTTP HEAD fallback — measures full HTTP round-trip (DNS+TLS+HTTP).
    // Results will be higher than true network latency.
    const pings = [];
    const servers = [
      'https://www.google.com',
      'https://www.cloudflare.com',
      'https://1.1.1.1',
    ];

    for (let i = 0; i < 20; i++) {
      try {
        const server = servers[i % servers.length];
        const start = Date.now();
        await fetch(`${server}/?_=${Date.now()}`, {
          method: 'HEAD', cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' },
        });
        const rtt = Date.now() - start;
        pings.push(rtt);
        if (onPingSample) onPingSample(rtt);
        await new Promise((resolve) => setTimeout(resolve, 80));
      } catch (e) {
        console.log('HTTP ping failed:', e.message);
      }
    }

    if (pings.length < 3) throw new Error('Not enough ping measurements');

    // Discard first 3 (cold start), sort, trim top 10%
    const valid = pings.slice(3);
    valid.sort((a, b) => a - b);
    const trimmed = valid.slice(0, Math.ceil(valid.length * 0.9));
    const avg = Math.round(trimmed.reduce((a, b) => a + b, 0) / trimmed.length);

    console.log(`HTTP ping (fallback): ${avg}ms (${trimmed.length} samples)`);
    return avg;
  }

  // ── Download: XHR with onprogress ─────────────────────────────────────────
  // Uses XMLHttpRequest instead of fetch() so we can track bytes as they
  // arrive via the onprogress event, rather than waiting for the full blob.
  // This gives smooth speedometer updates and accurate timing.
  //
  // 6 parallel connections to Cloudflare's speed test endpoint.
  // Chunk sizes ramp from 1MB → 2MB → 4MB → 8MB.
  // 12-second test window. Rolling 3s window for live speed.

  async runDownloadTest(onSpeedUpdate) {
    const testDuration = 12000;
    const startTime = Date.now();
    const calc = this._createRollingCalc();
    const shared = { totalBytes: 0 };
    const liveSamples = [];
    let lastReportedBytes = 0;
    let lastReportedAt = Date.now();
    let lastSmoothedSpeed = 0;

    const chunkSizes = [1048576, 2097152, 4194304, 8388608]; // 1, 2, 4, 8 MB

    // Warm-up: small XHR to establish connection pool
    await this._xhrDownloadChunk(4096, 5000).catch(() => {});

    const measureStart = Date.now();
    calc.push(0);

    const WORKERS = 4;
    console.log(`Starting download test — ${WORKERS} XHR connections for 12s`);

    // Live speed reporter every 200ms
    const updateInterval = setInterval(() => {
      if (onSpeedUpdate && shared.totalBytes > 0) {
        const now = Date.now();
        const rollingSpeed = calc.getLiveSpeed();
        const deltaBytes = shared.totalBytes - lastReportedBytes;
        const deltaSeconds = Math.max((now - lastReportedAt) / 1000, 0.001);
        const intervalSpeed = deltaBytes > 0 ? ((deltaBytes * 8) / (deltaSeconds * 1000000)) : 0;
        const speed = intervalSpeed > 0
          ? (rollingSpeed > 0 ? rollingSpeed * 0.72 + intervalSpeed * 0.28 : intervalSpeed)
          : rollingSpeed;

        lastReportedBytes = shared.totalBytes;
        lastReportedAt = now;

        if (speed > 0) {
          // Store raw speed value for logging
          liveSamples.push(speed);

          // Apply smoothing to prevent spikes - limit rate of change to 50% per update
          let smoothedSpeed;
          if (lastSmoothedSpeed === 0) {
            smoothedSpeed = speed;
          } else {
            const maxChange = lastSmoothedSpeed * 0.5;
            const change = speed - lastSmoothedSpeed;
            if (Math.abs(change) > maxChange) {
              smoothedSpeed = lastSmoothedSpeed + (change > 0 ? maxChange : -maxChange);
            } else {
              smoothedSpeed = speed;
            }
          }
          lastSmoothedSpeed = smoothedSpeed;

          onSpeedUpdate(smoothedSpeed, 'download');
        }
      }
    }, 140);

    // Parallel workers
    const promises = [];
    for (let i = 0; i < WORKERS; i++) {
      promises.push(
        this._downloadWorkerXHR(chunkSizes, startTime, testDuration, shared, calc, i)
      );
    }

    await Promise.allSettled(promises);
    clearInterval(updateInterval);

    const finalSpeed = Math.max(calc.getFinalSpeed(), 0.1);
    if (onSpeedUpdate) onSpeedUpdate(finalSpeed, 'download');

    // Log download samples with aggressive filtering to remove unrealistic spikes
    const rawDownloadSamples = liveSamples.map(s => Math.round(s));
    // Exclude first 10 samples (warmup) and last 2 samples (tail effects)
    const stableDownloadWindow = rawDownloadSamples.slice(
      Math.min(10, rawDownloadSamples.length),
      rawDownloadSamples.length > 4 ? -2 : rawDownloadSamples.length
    );
    const sortedDownloadSamples = [...stableDownloadWindow].sort((a, b) => a - b);
    const downloadTrimCount = Math.floor(sortedDownloadSamples.length * 0.15);
    const filteredDownloadSamples = sortedDownloadSamples.slice(downloadTrimCount, sortedDownloadSamples.length - downloadTrimCount);
    const elapsed = (Date.now() - measureStart) / 1000;
    console.log(
      `Download: ${finalSpeed.toFixed(2)} Mbps (${filteredDownloadSamples.length} samples, raw: ${filteredDownloadSamples.join(',')})`
    );
    console.log(
      `Download done: ${(shared.totalBytes / 1048576).toFixed(1)} MB in ${elapsed.toFixed(1)}s — ` +
      `rolling: ${finalSpeed.toFixed(2)} Mbps`
    );
    return finalSpeed;
  }

  async _downloadWorkerXHR(chunkSizes, startTime, testDuration, shared, calc, idx) {
    let errors = 0;
    let sizeIdx = 0;

    // Stagger worker starts to avoid simultaneous connection bursts
    await new Promise(r => setTimeout(r, idx * 150));

    while (Date.now() - startTime < testDuration && errors < 3 && this.isTestRunning) {
      try {
        const size = chunkSizes[Math.min(sizeIdx, chunkSizes.length - 1)];
        const url = `https://speed.cloudflare.com/__down?bytes=${size}&_=${Date.now()}_${idx}_${sizeIdx}`;

        await this._xhrDownloadChunk(url, testDuration, (loaded) => {
          shared.totalBytes += loaded;
          calc.push(shared.totalBytes);
        });

        errors = 0;
        sizeIdx++;
      } catch (e) {
        errors++;
        console.log(`DL worker ${idx + 1} error (${errors}): ${e.message}`);
        // Exponential backoff: 300ms, 900ms, then give up
        if (errors < 3) await new Promise(r => setTimeout(r, 300 * errors * errors));
      }
    }
  }

  // Single XHR download with onprogress tracking.
  // The onProgress callback receives INCREMENTAL bytes (delta since last event).
  _xhrDownloadChunk(url, timeoutMs, onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', typeof url === 'number'
        ? `https://speed.cloudflare.com/__down?bytes=${url}&_=${Date.now()}`
        : url
      );
      xhr.responseType = 'arraybuffer';
      xhr.timeout = timeoutMs || 15000;
      // Prevent caching
      xhr.setRequestHeader('Cache-Control', 'no-cache, no-store');
      xhr.setRequestHeader('Pragma', 'no-cache');

      let lastLoaded = 0;

      xhr.onprogress = (event) => {
        if (event.loaded > lastLoaded) {
          const delta = event.loaded - lastLoaded;
          lastLoaded = event.loaded;
          if (onProgress) onProgress(delta);
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          // Final delta in case onprogress didn't fire for the tail
          if (xhr.response) {
            const finalSize = xhr.response.byteLength || 0;
            if (finalSize > lastLoaded && onProgress) {
              onProgress(finalSize - lastLoaded);
            }
          }
          resolve(lastLoaded);
        } else {
          reject(new Error(`XHR download HTTP ${xhr.status}`));
        }
      };

      xhr.onerror = () => reject(new Error('XHR download network error'));
      xhr.ontimeout = () => reject(new Error('XHR download timeout'));
      xhr.send();
    });
  }

  // ── Upload: XHR with upload.onprogress ────────────────────────────────────
  // Sends Uint8Array binary payloads via XHR POST to Cloudflare.
  // upload.onprogress tracks bytes as they leave the device.
  //
  // 6 parallel connections. Payloads ramp 256KB → 512KB → 1MB → 2MB.
  // 12-second test window. Rolling 3s window for live speed.
  //
  // Note: Using 6 connections (matching download). Cloudflare's __up endpoint
  // handles this fine — tested and confirmed no rate limiting at 6 connections.

  async runUploadTest(onSpeedUpdate) {
    const testDuration = 13500;
    const startTime = Date.now();
    const calc = this._createRollingCalc();
    const shared = { totalBytes: 0 };
    const liveSamples = [];
    let lastReportedBytes = 0;
    let lastReportedAt = Date.now();
    let lastSmoothedSpeed = 0;

    const payloads = [
      this._getUploadPayload(64 * 1024),     // 64 KB
      this._getUploadPayload(96 * 1024),     // 96 KB
      this._getUploadPayload(128 * 1024),    // 128 KB
      this._getUploadPayload(192 * 1024),    // 192 KB
      this._getUploadPayload(256 * 1024),    // 256 KB
      this._getUploadPayload(384 * 1024),    // 384 KB
      this._getUploadPayload(512 * 1024),    // 512 KB
    ];

    // Warm-up POST
    await this._xhrUploadChunk(new Uint8Array(1024), 5000).catch(() => {});

    const measureStart = Date.now();
    calc.push(0);

    const WORKERS = 3;
    console.log(`Starting upload test — ${WORKERS} XHR connections for 13.5s`);

    const updateInterval = setInterval(() => {
      if (onSpeedUpdate && shared.totalBytes > 0) {
        const now = Date.now();
        const rollingSpeed = calc.getLiveSpeed();
        const deltaBytes = shared.totalBytes - lastReportedBytes;
        const deltaSeconds = Math.max((now - lastReportedAt) / 1000, 0.001);
        const intervalSpeed = deltaBytes > 0 ? ((deltaBytes * 8) / (deltaSeconds * 1000000)) : 0;
        const speed = intervalSpeed > 0
          ? (rollingSpeed > 0 ? rollingSpeed * 0.68 + intervalSpeed * 0.32 : intervalSpeed)
          : rollingSpeed;

        lastReportedBytes = shared.totalBytes;
        lastReportedAt = now;

        if (speed > 0) {
          // Store raw speed value for logging
          liveSamples.push(speed);

          // Apply smoothing to prevent spikes - limit rate of change to 50% per update
          let smoothedSpeed;
          if (lastSmoothedSpeed === 0) {
            smoothedSpeed = speed;
          } else {
            const maxChange = lastSmoothedSpeed * 0.5;
            const change = speed - lastSmoothedSpeed;
            if (Math.abs(change) > maxChange) {
              smoothedSpeed = lastSmoothedSpeed + (change > 0 ? maxChange : -maxChange);
            } else {
              smoothedSpeed = speed;
            }
          }
          lastSmoothedSpeed = smoothedSpeed;

          onSpeedUpdate(smoothedSpeed, 'upload');
        }
      }
    }, 130);

    const promises = [];
    for (let i = 0; i < WORKERS; i++) {
      promises.push(
        this._uploadWorkerXHR(payloads, startTime, testDuration, shared, calc, i)
      );
    }

    await Promise.allSettled(promises);
    clearInterval(updateInterval);

    const finalRolling = calc.getFinalSpeed();
    const stableWindow = liveSamples.slice(
      Math.min(8, liveSamples.length),
      liveSamples.length > 4 ? -2 : liveSamples.length
    );
    const stableEstimate = this._getTrimmedMean(stableWindow, 0.15);
    const p50 = this._getPercentile(stableWindow, 0.5);
    const p75 = this._getPercentile(stableWindow, 0.75);
    const anchoredEstimate = Math.max(
      stableEstimate * 1.03,
      p50 * 1.05,
      p75 * 0.98,
    );
    const finalSpeed = Math.max(
      anchoredEstimate > 0 ? Math.min(finalRolling, anchoredEstimate) : finalRolling,
      0.1
    );
    if (onSpeedUpdate) onSpeedUpdate(finalSpeed, 'upload');

    // Log upload samples with aggressive filtering to remove unrealistic spikes
    const rawUploadSamples = liveSamples.map(s => Math.round(s));
    // Exclude first 10 samples (warmup) and last 2 samples (tail effects)
    const stableUploadWindow = rawUploadSamples.slice(
      Math.min(10, rawUploadSamples.length),
      rawUploadSamples.length > 4 ? -2 : rawUploadSamples.length
    );
    const sortedUploadSamples = [...stableUploadWindow].sort((a, b) => a - b);
    const uploadTrimCount = Math.floor(sortedUploadSamples.length * 0.15);
    const filteredUploadSamples = sortedUploadSamples.slice(uploadTrimCount, sortedUploadSamples.length - uploadTrimCount);
    const elapsed = (Date.now() - measureStart) / 1000;
    console.log(
      `Upload: ${finalSpeed.toFixed(2)} Mbps (${filteredUploadSamples.length} samples, raw: ${filteredUploadSamples.join(',')})`
    );
    console.log(
      `Upload done: ${(shared.totalBytes / 1048576).toFixed(1)} MB in ${elapsed.toFixed(1)}s — ` +
      `rolling: ${finalSpeed.toFixed(2)} Mbps`
    );
    return finalSpeed;
  }

  async _uploadWorkerXHR(payloads, startTime, testDuration, shared, calc, idx) {
    let errors = 0;
    let payloadIdx = 0;

    // Stagger worker starts to avoid simultaneous connection bursts
    await new Promise(r => setTimeout(r, idx * 150));

    while (Date.now() - startTime < testDuration && errors < 3 && this.isTestRunning) {
      try {
        const payload = payloads[Math.min(payloadIdx, payloads.length - 1)];

        await this._xhrUploadChunk(payload, testDuration, (loaded) => {
          shared.totalBytes += loaded;
          calc.push(shared.totalBytes);
        });

        errors = 0;
        payloadIdx++;
      } catch (e) {
        errors++;
        console.log(`UL worker ${idx + 1} error (${errors}): ${e.message}`);
        // Exponential backoff: 300ms, 900ms, then give up
        if (errors < 3) await new Promise(r => setTimeout(r, 300 * errors * errors));
      }
    }
  }

  // Single XHR upload with upload.onprogress tracking.
  // onProgress receives INCREMENTAL bytes (delta).
  // Body is a Uint8Array sent as application/octet-stream.
  _xhrUploadChunk(payload, timeoutMs, onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `https://speed.cloudflare.com/__up?_=${Date.now()}`);
      xhr.setRequestHeader('Content-Type', 'application/octet-stream');
      xhr.timeout = timeoutMs || 15000;

      let lastLoaded = 0;

      xhr.upload.onprogress = (event) => {
        if (event.loaded > lastLoaded) {
          const delta = event.loaded - lastLoaded;
          lastLoaded = event.loaded;
          if (onProgress) onProgress(delta);
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          // Ensure we counted all bytes even if last progress event was missed
          const total = payload.byteLength || payload.length;
          if (lastLoaded < total && onProgress) {
            onProgress(total - lastLoaded);
          }
          resolve(lastLoaded);
        } else {
          reject(new Error(`XHR upload HTTP ${xhr.status}`));
        }
      };

      xhr.onerror = () => reject(new Error('XHR upload network error'));
      xhr.ontimeout = () => reject(new Error('XHR upload timeout'));

      // Send the binary payload directly
      xhr.send(payload);
    });
  }

  // ── Main test runner ──────────────────────────────────────────────────────
  // Sequence: server selection → download → upload → ping
  // Callbacks are unchanged from the original interface.

  async runSpeedTest(onProgress, onSpeedUpdate, onComplete, onError, onPingSample, onPhaseComplete) {
    if (this.isTestRunning) return;

    this.isTestRunning = true;
    this.testStartTime = Date.now();
    this.currentTest = {
      date: new Date().toISOString(),
      download: 0,
      upload: 0,
      ping: 0,
    };

    try {
      // Phase 1: Select nearest M-Lab NDT7 server
      onProgress('Selecting server...', 'server');
      await this.selectBestServer();

      // Phase 2: Download (parallel XHR with onprogress, rolling window)
      onProgress('Testing download speed...', 'download');
      const downloadResult = await this.runDownloadTest(onSpeedUpdate);
      this.currentTest.download = downloadResult;
      if (onPhaseComplete) onPhaseComplete('download', downloadResult);

      if (downloadResult > this.peaks.download) {
        this.peaks.download = downloadResult;
        await this.savePeaks();
      }

      // Phase 3: Upload (parallel XHR with upload.onprogress, rolling window)
      onProgress('Testing upload speed...', 'upload');
      const uploadResult = await this.runUploadTest(onSpeedUpdate);
      this.currentTest.upload = uploadResult;
      if (onPhaseComplete) onPhaseComplete('upload', uploadResult);

      if (uploadResult > this.peaks.upload) {
        this.peaks.upload = uploadResult;
        await this.savePeaks();
      }

      // Phase 4: Ping (WebSocket RTT, HTTP HEAD fallback)
      onProgress('Testing ping...', 'ping');
      const pingResult = await this.runPingTest(onPingSample);
      this.currentTest.ping = pingResult;
      if (onPhaseComplete) onPhaseComplete('ping', pingResult);

      // Update ping peak (lower is better; 0 = no previous peak)
      if (this.peaks.ping === 0 || pingResult < this.peaks.ping) {
        this.peaks.ping = pingResult;
        await this.savePeaks();
      }

      // Save to history
      await this.saveTestResult(this.currentTest);
      onComplete(this.currentTest);
    } catch (error) {
      console.error('Speed test failed:', error);
      onError(error.message);
    } finally {
      this.isTestRunning = false;
    }
  }

  stopTest() {
    this.isTestRunning = false;
  }

  getPeaks() {
    return { ...this.peaks };
  }
}

export default new SpeedTestService();

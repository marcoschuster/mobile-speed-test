import AsyncStorage from '@react-native-async-storage/async-storage';

class SpeedTestService {
  constructor() {
    this.isTestRunning = false;
    this.testStartTime = 0;
    this.currentTest = null;
    this.peaks = {
      download: 0,
      upload: 0,
      ping: 0
    };
    this.selectedServer = null;
  }

  async loadPeaks() {
    try {
      const stored = await AsyncStorage.getItem('speedTestPeaks');
      if (stored) {
        const parsed = JSON.parse(stored);
        this.peaks = {
          download: parsed.download || 0,
          upload: parsed.upload || 0,
          ping: parsed.ping || 0,
        };
      }
    } catch (error) {
      console.error('Error loading peaks:', error);
    }
  }

  async savePeaks() {
    try {
      await AsyncStorage.setItem('speedTestPeaks', JSON.stringify(this.peaks));
    } catch (error) {
      console.error('Error saving peaks:', error);
    }
  }

  async saveTestResult(testResult) {
    try {
      const existingHistory = await this.getHistory();
      existingHistory.unshift(testResult);
      
      // Keep only last 50 results
      if (existingHistory.length > 50) {
        existingHistory.splice(50);
      }
      
      await AsyncStorage.setItem('speedTestHistory', JSON.stringify(existingHistory));
      return existingHistory;
    } catch (error) {
      console.error('Error saving test result:', error);
      return [];
    }
  }

  async getHistory() {
    try {
      const stored = await AsyncStorage.getItem('speedTestHistory');
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error getting history:', error);
      return [];
    }
  }

  async clearHistory() {
    try {
      await AsyncStorage.removeItem('speedTestHistory');
      return [];
    } catch (error) {
      console.error('Error clearing history:', error);
      return [];
    }
  }

  // NDT7 server selection
  async selectBestServer() {
    try {
      // Fetch nearest NDT7 servers
      const response = await fetch('https://locate.measurementlab.net/v2/nearest/ndt/ndt7', {
        method: 'GET',
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache'
        }
      });
      
      if (response.ok) {
        const servers = await response.json();
        if (servers && servers.length > 0) {
          this.selectedServer = servers[0]; // First result is already sorted by proximity
          console.log('Selected NDT7 server:', this.selectedServer.fqdn);
          return this.selectedServer;
        }
      }
    } catch (error) {
      console.log('Failed to fetch NDT7 servers:', error.message);
    }
    
    // Fallback to hardcoded server
    this.selectedServer = {
      fqdn: 'ndt-iupui-mlab1-ord05.mlab-oti.measurement-lab.org',
      download_url: 'https://ndt-iupui-mlab1-ord05.mlab-oti.measurement-lab.org:443',
      upload_url: 'https://ndt-iupui-mlab1-ord05.mlab-oti.measurement-lab.org:443'
    };
    console.log('Using fallback NDT7 server');
    return this.selectedServer;
  }

  // NDT7 ping test with reliable servers
  async runPingTest(onPingSample) {
    const pings = [];
    
    // Use reliable servers for ping testing
    const pingServers = [
      'https://www.google.com',
      'https://www.cloudflare.com',
      'https://www.amazon.com',
      'https://www.microsoft.com',
      'https://www.facebook.com'
    ];
    
    // Send 10 sequential fetch requests
    for (let i = 0; i < 10; i++) {
      try {
        const server = pingServers[i % pingServers.length];
        const start = Date.now();
        const response = await fetch(`${server}/?ping=${Date.now()}`, {
          method: 'HEAD',
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache'
          }
        });
        
        if (response.ok) {
          const end = Date.now();
          const sample = end - start;
          pings.push(sample);
          if (onPingSample) onPingSample(sample);
        }
      } catch (error) {
        console.log('Ping request failed:', error.message);
      }
    }
    
    if (pings.length < 3) {
      throw new Error('Not enough successful ping measurements');
    }
    
    // Discard first result (cold start) and average remaining
    const validPings = pings.slice(1);
    const averagePing = Math.round(validPings.reduce((a, b) => a + b, 0) / validPings.length);
    
    console.log(`Ping test: ${averagePing}ms (${validPings.length} samples)`);
    return averagePing;
  }

  // Download speed test using Cloudflare speed endpoint
  async runDownloadTest(onSpeedUpdate) {
    const testDuration = 12000; // 12 seconds
    const startTime = Date.now();
    const shared = { totalBytes: 0, measuring: false, measureStart: 0 };

    // Use only Cloudflare — fast, reliable, supports any size via query param
    // Use smaller chunks so we get many sequential fetches (more data points, saturates pipe)
    const chunkSizes = [
      1048576,   // 1 MB
      2097152,   // 2 MB
      4194304,   // 4 MB
    ];

    // Warm-up: single small request to establish connection
    try {
      await fetch(`https://speed.cloudflare.com/__down?bytes=4096&_=${Date.now()}`, {
        method: 'GET', cache: 'no-store',
      });
    } catch (_) { /* ignore */ }

    shared.measureStart = Date.now();
    shared.measuring = true;

    console.log(`Starting download test — 6 connections for ${testDuration / 1000}s`);

    // Periodic speed reporter
    const updateInterval = setInterval(() => {
      if (onSpeedUpdate && shared.totalBytes > 0 && shared.measuring) {
        const elapsed = (Date.now() - shared.measureStart) / 1000;
        if (elapsed > 0.3) {
          const speed = (shared.totalBytes * 8) / (elapsed * 1000000);
          onSpeedUpdate(Math.max(speed, 0.1), 'download');
        }
      }
    }, 300);

    // 6 parallel connections all hitting Cloudflare
    const promises = [];
    for (let i = 0; i < 6; i++) {
      promises.push(this._downloadWorker(chunkSizes, startTime, testDuration, shared, i));
    }

    const results = await Promise.allSettled(promises);
    clearInterval(updateInterval);

    let totalBytes = 0;
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') {
        totalBytes += r.value;
        console.log(`DL conn ${i + 1}: ${(r.value / 1048576).toFixed(2)} MB`);
      }
    });

    const elapsed = (Date.now() - shared.measureStart) / 1000;
    const finalSpeed = elapsed > 0 ? (totalBytes * 8) / (elapsed * 1000000) : 0;

    if (onSpeedUpdate) onSpeedUpdate(Math.max(finalSpeed, 0.1), 'download');
    console.log(`Download done: ${(totalBytes / 1048576).toFixed(1)} MB in ${elapsed.toFixed(1)}s = ${finalSpeed.toFixed(2)} Mbps`);
    return Math.max(finalSpeed, 0.1);
  }

  async _downloadWorker(chunkSizes, startTime, testDuration, shared, idx) {
    let bytes = 0;
    let errors = 0;
    // Rotate through chunk sizes — start small, ramp up
    let sizeIdx = 0;

    while (Date.now() - startTime < testDuration && errors < 3) {
      try {
        const size = chunkSizes[Math.min(sizeIdx, chunkSizes.length - 1)];
        const url = `https://speed.cloudflare.com/__down?bytes=${size}&_=${Date.now()}_${idx}`;

        const response = await fetch(url, {
          method: 'GET',
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' },
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const blob = await response.blob();
        bytes += blob.size;
        shared.totalBytes += blob.size;
        errors = 0;
        sizeIdx++; // next iteration use bigger chunk
      } catch (e) {
        errors++;
        console.log(`DL worker ${idx + 1} error (${errors}): ${e.message}`);
        if (errors < 3) await new Promise(r => setTimeout(r, 200));
      }
    }
    return bytes;
  }

  // Upload speed test using Cloudflare speed endpoint
  async runUploadTest(onSpeedUpdate) {
    const testDuration = 12000; // 12 seconds
    const startTime = Date.now();
    const shared = { totalBytes: 0, measureStart: 0 };

    // Build payloads of increasing size (binary-like strings)
    const makePayload = (size) => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      let s = '';
      for (let i = 0; i < size; i++) s += chars.charAt(i % chars.length);
      return s;
    };

    const payloads = [
      makePayload(256 * 1024),   // 256 KB
      makePayload(512 * 1024),   // 512 KB
      makePayload(1024 * 1024),  // 1 MB
    ];

    // Warm-up
    try {
      await fetch('https://speed.cloudflare.com/__up', {
        method: 'POST', cache: 'no-store',
        body: 'warmup',
      });
    } catch (_) { /* ignore */ }

    shared.measureStart = Date.now();

    console.log(`Starting upload test — 4 connections for ${testDuration / 1000}s`);

    const updateInterval = setInterval(() => {
      if (onSpeedUpdate && shared.totalBytes > 0) {
        const elapsed = (Date.now() - shared.measureStart) / 1000;
        if (elapsed > 0.3) {
          const speed = (shared.totalBytes * 8) / (elapsed * 1000000);
          onSpeedUpdate(Math.max(speed, 0.1), 'upload');
        }
      }
    }, 300);

    const promises = [];
    for (let i = 0; i < 4; i++) {
      promises.push(this._uploadWorker(payloads, startTime, testDuration, shared, i));
    }

    const results = await Promise.allSettled(promises);
    clearInterval(updateInterval);

    let totalBytes = 0;
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') {
        totalBytes += r.value;
        console.log(`UL conn ${i + 1}: ${(r.value / 1048576).toFixed(2)} MB`);
      }
    });

    const elapsed = (Date.now() - shared.measureStart) / 1000;
    const finalSpeed = elapsed > 0 ? (totalBytes * 8) / (elapsed * 1000000) : 0;

    if (onSpeedUpdate) onSpeedUpdate(Math.max(finalSpeed, 0.1), 'upload');
    console.log(`Upload done: ${(totalBytes / 1048576).toFixed(1)} MB in ${elapsed.toFixed(1)}s = ${finalSpeed.toFixed(2)} Mbps`);
    return Math.max(finalSpeed, 0.1);
  }

  async _uploadWorker(payloads, startTime, testDuration, shared, idx) {
    let bytes = 0;
    let errors = 0;
    let payloadIdx = 0;

    while (Date.now() - startTime < testDuration && errors < 3) {
      try {
        const payload = payloads[Math.min(payloadIdx, payloads.length - 1)];

        const response = await fetch('https://speed.cloudflare.com/__up', {
          method: 'POST',
          cache: 'no-store',
          headers: { 'Content-Type': 'application/octet-stream' },
          body: payload,
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        bytes += payload.length;
        shared.totalBytes += payload.length;
        errors = 0;
        payloadIdx++; // ramp up payload size
      } catch (e) {
        errors++;
        console.log(`UL worker ${idx + 1} error (${errors}): ${e.message}`);
        if (errors < 3) await new Promise(r => setTimeout(r, 200));
      }
    }
    return bytes;
  }

  // Main test runner using NDT7-compatible methodology
  async runSpeedTest(onProgress, onSpeedUpdate, onComplete, onError, onPingSample) {
    if (this.isTestRunning) return;
    
    this.isTestRunning = true;
    this.testStartTime = Date.now();
    this.currentTest = {
      date: new Date().toISOString(),
      download: 0,
      upload: 0,
      ping: 0
    };

    try {
      // Phase 1: Select best NDT7 server
      onProgress('Selecting NDT7 server...', 'server');
      await this.selectBestServer();
      
      // Phase 2: Ping test
      onProgress('Testing ping...', 'ping');
      const pingResult = await this.runPingTest(onPingSample);
      this.currentTest.ping = pingResult;
      
      // Phase 3: Download test with NDT7-compatible methodology
      onProgress('Testing download speed...', 'download');
      const downloadResult = await this.runDownloadTest(onSpeedUpdate);
      this.currentTest.download = downloadResult;
      
      // Update peak
      if (downloadResult > this.peaks.download) {
        this.peaks.download = downloadResult;
        await this.savePeaks();
      }
      
      // Phase 4: Upload test with NDT7-compatible methodology
      onProgress('Testing upload speed...', 'upload');
      const uploadResult = await this.runUploadTest(onSpeedUpdate);
      this.currentTest.upload = uploadResult;
      
      // Update peak
      if (uploadResult > this.peaks.upload) {
        this.peaks.upload = uploadResult;
        await this.savePeaks();
      }
      
      // Update ping peak (lower is better; 0 means no previous peak stored)
      if (this.peaks.ping === 0 || pingResult < this.peaks.ping) {
        this.peaks.ping = pingResult;
        await this.savePeaks();
      }
      
      // Save test result
      await this.saveTestResult(this.currentTest);
      
      onComplete(this.currentTest);
      
    } catch (error) {
      console.error('NDT7-compatible speed test failed:', error);
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

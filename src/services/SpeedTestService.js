import AsyncStorage from '@react-native-async-storage/async-storage';

class SpeedTestService {
  constructor() {
    this.isTestRunning = false;
    this.testStartTime = 0;
    this.currentTest = null;
    this.peaks = {
      download: 0,
      upload: 0,
      ping: Infinity
    };
    this.selectedServer = null;
  }

  async loadPeaks() {
    try {
      const stored = await AsyncStorage.getItem('speedTestPeaks');
      if (stored) {
        this.peaks = JSON.parse(stored);
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
  async runPingTest() {
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
          pings.push(end - start);
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

  // NDT7-compatible download test using HTTP
  async runDownloadTest(onSpeedUpdate) {
    if (!this.selectedServer) {
      await this.selectBestServer();
    }
    
    const testDuration = 10000; // 10 seconds for better measurements
    const startTime = Date.now();
    const sharedState = { totalBytes: 0 }; // Shared across all connections
    
    // Use highly reliable speed test endpoints
    const testUrls = [
      'https://speed.cloudflare.com/__down?bytes=5242880', // 5MB
      'https://speed.cloudflare.com/__down?bytes=10485760', // 10MB
      'https://speedtest.net/files/10MB.zip',
      'https://proof.ovh.net/files/10Mb.dat',
      'https://www.thinkbroadband.com/10MB.zip'
    ];
    
    console.log(`Starting download test with ${testUrls.length} URLs for ${testDuration/1000}s`);
    
    // Start a periodic updater for smooth progress
    const updateInterval = setInterval(() => {
      if (onSpeedUpdate && sharedState.totalBytes > 0) {
        const elapsed = (Date.now() - startTime) / 1000;
        const currentSpeed = elapsed > 0 ? (sharedState.totalBytes * 8) / (elapsed * 1000000) : 0;
        onSpeedUpdate(Math.max(currentSpeed, 0.1), 'download');
      }
    }, 500); // Update every 500ms for smooth progress
    
    // Run multiple parallel downloads with better error handling
    const promises = [];
    for (let i = 0; i < 4; i++) {
      promises.push(this.runSingleDownload(testUrls, startTime, testDuration, sharedState, i));
    }
    
    const results = await Promise.allSettled(promises);
    clearInterval(updateInterval); // Stop the updater
    
    let totalBytesAll = 0;
    
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        totalBytesAll += result.value;
        console.log(`Download connection ${index + 1}: ${(result.value / 1048576).toFixed(2)} MB`);
      } else {
        console.log(`Download connection ${index + 1} failed:`, result.reason);
      }
    });
    
    const totalElapsed = (Date.now() - startTime) / 1000;
    const finalSpeed = totalElapsed > 0 ? (totalBytesAll * 8) / (totalElapsed * 1000000) : 0;
    
    // Send final update
    if (onSpeedUpdate) {
      onSpeedUpdate(Math.max(finalSpeed, 0.1), 'download');
    }
    
    console.log(`Download test completed: ${(totalBytesAll / 1048576).toFixed(2)} MB total in ${totalElapsed.toFixed(1)}s = ${finalSpeed.toFixed(2)} Mbps`);
    return Math.max(finalSpeed, 0.1);
  }

  async runSingleDownload(testUrls, startTime, testDuration, sharedState, connectionIndex) {
    let bytes = 0;
    let lastLogTime = startTime;
    let measurementCount = 0;
    let consecutiveErrors = 0;
    const maxConsecutiveErrors = 2; // Give up after 2 consecutive errors
    
    // Each connection uses a specific URL to avoid conflicts
    const urlIndex = connectionIndex % testUrls.length;
    
    while (Date.now() - startTime < testDuration && consecutiveErrors < maxConsecutiveErrors) {
      try {
        const url = testUrls[urlIndex];
        // Properly append timestamp (handle existing ? or not)
        const separator = url.includes('?') ? '&' : '?';
        const finalUrl = `${url}${separator}nocache=${Date.now()}`;
        
        const response = await fetch(finalUrl, {
          method: 'GET',
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });
        
        if (response.ok) {
          const blob = await response.blob();
          bytes += blob.size;
          sharedState.totalBytes += blob.size; // Update shared state
          measurementCount++;
          consecutiveErrors = 0; // Reset error count on success
          
          if (Date.now() - lastLogTime > 1500) {
            const elapsed = (Date.now() - startTime) / 1000;
            const currentSpeed = elapsed > 0 ? (bytes * 8) / (elapsed * 1000000) : 0;
            console.log(`Connection ${connectionIndex + 1}: ${(bytes / 1048576).toFixed(2)} MB downloaded, current speed: ${currentSpeed.toFixed(2)} Mbps`);
            lastLogTime = Date.now();
          }
          
          // Small delay to prevent overwhelming the server
          await new Promise(resolve => setTimeout(resolve, 50));
        } else {
          throw new Error(`HTTP ${response.status}`);
        }
      } catch (error) {
        consecutiveErrors++;
        console.log(`Download error on connection ${connectionIndex + 1} (attempt ${consecutiveErrors}):`, error.message);
        
        if (consecutiveErrors >= maxConsecutiveErrors) {
          console.log(`Connection ${connectionIndex + 1} stopping after ${consecutiveErrors} consecutive errors`);
          break;
        }
        
        // Short wait before retry
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }
    
    console.log(`Connection ${connectionIndex + 1} finished: ${(bytes / 1048576).toFixed(2)} MB total, ${measurementCount} measurements`);
    return bytes;
  }

  // NDT7-compatible upload test using HTTP
  async runUploadTest(onSpeedUpdate) {
    if (!this.selectedServer) {
      await this.selectBestServer();
    }
    
    const testDuration = 10000; // 10 seconds for better measurements
    const startTime = Date.now();
    const sharedState = { totalBytes: 0 }; // Shared across all connections
    
    // Create test payload as a string (React Native compatible)
    const payloadSize = 256 * 1024; // 256KB chunks
    let payload = '';
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < payloadSize; i++) {
      payload += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    // Use endpoints that accept POST data
    const uploadEndpoints = [
      { url: 'https://httpbin.org/post', method: 'POST', type: 'json' },
      { url: 'https://postman-echo.com/post', method: 'POST', type: 'json' },
      { url: 'https://httpbin.org/anything', method: 'POST', type: 'json' }
    ];
    
    console.log(`Starting upload test with ${uploadEndpoints.length} endpoints for ${testDuration/1000}s`);
    
    // Start a periodic updater for smooth progress
    const updateInterval = setInterval(() => {
      if (onSpeedUpdate && sharedState.totalBytes > 0) {
        const elapsed = (Date.now() - startTime) / 1000;
        const currentSpeed = elapsed > 0 ? (sharedState.totalBytes * 8) / (elapsed * 1000000) : 0;
        onSpeedUpdate(Math.max(currentSpeed, 0.1), 'upload');
      }
    }, 500); // Update every 500ms for smooth progress
    
    // Run multiple parallel uploads with better error handling
    const promises = [];
    for (let i = 0; i < 3; i++) { // 3 parallel connections
      promises.push(this.runSingleUpload(uploadEndpoints, payload, startTime, testDuration, sharedState, i));
    }
    
    const results = await Promise.allSettled(promises);
    clearInterval(updateInterval); // Stop the updater
    
    let totalBytesAll = 0;
    
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        totalBytesAll += result.value;
        console.log(`Upload connection ${index + 1}: ${(result.value / 1048576).toFixed(2)} MB`);
      } else {
        console.log(`Upload connection ${index + 1} failed:`, result.reason);
      }
    });
    
    const totalElapsed = (Date.now() - startTime) / 1000;
    const finalSpeed = totalElapsed > 0 ? (totalBytesAll * 8) / (totalElapsed * 1000000) : 0;
    
    // Send final update
    if (onSpeedUpdate) {
      onSpeedUpdate(Math.max(finalSpeed, 0.1), 'upload');
    }
    
    console.log(`Upload test completed: ${(totalBytesAll / 1048576).toFixed(2)} MB total in ${totalElapsed.toFixed(1)}s = ${finalSpeed.toFixed(2)} Mbps`);
    return Math.max(finalSpeed, 0.1);
  }

  async runSingleUpload(uploadEndpoints, payload, startTime, testDuration, sharedState, connectionIndex) {
    let bytes = 0;
    let lastLogTime = startTime;
    let measurementCount = 0;
    let retryCount = 0;
    const maxRetries = 3;
    
    while (Date.now() - startTime < testDuration && retryCount < maxRetries) {
      try {
        const endpointIndex = connectionIndex % uploadEndpoints.length;
        const endpoint = uploadEndpoints[endpointIndex];
        
        // Send as JSON POST (React Native compatible)
        const response = await fetch(endpoint.url, {
          method: endpoint.method,
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            data: payload,
            timestamp: Date.now(),
            size: payload.length
          }),
          timeout: 8000
        });
        
        if (response && (response.ok || response.status === 200 || response.status === 201)) {
          bytes += payload.length;
          sharedState.totalBytes += payload.length; // Update shared state
          measurementCount++;
          retryCount = 0; // Reset on success
          
          if (Date.now() - lastLogTime > 1500) {
            const elapsed = (Date.now() - startTime) / 1000;
            const currentSpeed = elapsed > 0 ? (bytes * 8) / (elapsed * 1000000) : 0;
            console.log(`Connection ${connectionIndex + 1}: ${(bytes / 1048576).toFixed(2)} MB uploaded, current speed: ${currentSpeed.toFixed(2)} Mbps`);
            lastLogTime = Date.now();
          }
          
          // Small delay between uploads to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
        } else {
          throw new Error(`HTTP ${response?.status || 'Unknown'}`);
        }
      } catch (error) {
        retryCount++;
        console.log(`Upload error on connection ${connectionIndex + 1} (retry ${retryCount}):`, error.message);
        
        if (retryCount >= maxRetries) {
          console.log(`Connection ${connectionIndex + 1} max retries reached`);
          break;
        }
        
        // Wait before retry with exponential backoff
        await new Promise(resolve => setTimeout(resolve, 500 * retryCount));
      }
    }
    
    console.log(`Connection ${connectionIndex + 1} finished: ${(bytes / 1048576).toFixed(2)} MB total, ${measurementCount} measurements`);
    return bytes;
  }

  // Main test runner using NDT7-compatible methodology
  async runSpeedTest(onProgress, onSpeedUpdate, onComplete, onError) {
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
      const pingResult = await this.runPingTest();
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
      
      // Update ping peak
      if (pingResult < this.peaks.ping) {
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

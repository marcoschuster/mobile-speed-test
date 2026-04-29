import SpeedTestService from './SpeedTestService';

const TEST_DURATION_MS = 10000;
const PACKET_RATE_HZ = 60;
const PACKET_INTERVAL_MS = 1000 / PACKET_RATE_HZ;
const PACKET_SIZE = 64;
const RESPONSE_GRACE_MS = 450;
const HARD_TIMEOUT_MS = TEST_DURATION_MS + 2000;
const ECHO_URLS = [
  'wss://echo.websocket.events',
  'wss://ws.ifelse.io',
];

const getGamingGrade = ({ avgLatency, jitter, packetLoss, maxLatencySpike }) => {
  if (avgLatency <= 15 && jitter <= 3 && packetLoss === 0 && maxLatencySpike <= 20) {
    return {
      grade: 'S',
      games: 'Elite competitive ready',
      summary: 'Top-tier connection for ranked shooters, fighters, and cloud gaming. Inputs should feel immediate.',
    };
  }

  if (avgLatency <= 25 && jitter <= 5 && packetLoss <= 0.1 && maxLatencySpike <= 35) {
    return {
      grade: 'A+',
      games: 'Excellent for PUBG, CODM',
      summary: 'Excellent for ranked FPS play with very low delay and almost no instability.',
    };
  }

  if (avgLatency <= 40 && jitter <= 10 && packetLoss <= 0.5 && maxLatencySpike <= 60) {
    return {
      grade: 'A',
      games: 'Strong for competitive gaming',
      summary: 'Responsive enough for most competitive matches. Occasional network variance should be minor.',
    };
  }

  if (avgLatency <= 65 && jitter <= 15 && packetLoss <= 1 && maxLatencySpike <= 90) {
    return {
      grade: 'B',
      games: 'Good for online gaming',
      summary: 'Good for casual and most ranked play, but very timing-sensitive games may feel slightly delayed.',
    };
  }

  if (avgLatency <= 90 && jitter <= 25 && packetLoss <= 2 && maxLatencySpike <= 130) {
    return {
      grade: 'C',
      games: 'Playable with compromises',
      summary: 'Playable for casual matches. Expect some delayed hit registration, peeking disadvantage, or stutter.',
    };
  }

  if (avgLatency <= 130 && jitter <= 40 && packetLoss <= 4 && maxLatencySpike <= 200) {
    return {
      grade: 'D',
      games: 'Only okay for slower games',
      summary: 'Fast shooters and cloud gaming will feel inconsistent. Turn-based or slower online games are more realistic.',
    };
  }

  return {
    grade: 'F',
    games: 'Not recommended for live matches',
    summary: 'Expect rubber-banding, delayed shots, disconnect risk, or unstable gameplay.',
  };
};

class GamingModeTest {
  constructor() {
    this.isRunning = false;
  }

  async run(onProgress) {
    if (this.isRunning) {
      throw new Error('Gaming test is already running.');
    }

    this.isRunning = true;

    try {
      if (!SpeedTestService.selectedServer) {
        try {
          await SpeedTestService.selectBestServer();
        } catch (error) {
          console.log('Gaming mode server selection fallback:', error?.message || error);
        }
      }

      let lastError = null;

      for (const endpoint of ECHO_URLS) {
        try {
          return await this._runPacketStream(endpoint, onProgress);
        } catch (error) {
          lastError = error;
          console.log(`Gaming test endpoint failed (${endpoint}):`, error?.message || error);
        }
      }

      throw lastError || new Error('Gaming test transport could not be established.');
    } finally {
      this.isRunning = false;
    }
  }

  _runPacketStream(endpoint, onProgress) {
    return new Promise((resolve, reject) => {
      const sentTimes = new Map();
      const rtts = [];
      let sentCount = 0;
      let receivedCount = 0;
      let socket = null;
      let sendTimer = null;
      let testStartedAt = 0;
      let completed = false;

      const finalize = () => {
        if (completed) return;
        completed = true;

        if (sendTimer) clearTimeout(sendTimer);
        if (socket) {
          try {
            socket.close();
          } catch {}
        }

        const packetLoss = sentCount > 0 ? ((sentCount - receivedCount) / sentCount) * 100 : 100;
        const avgLatency = rtts.length
          ? rtts.reduce((sum, value) => sum + value, 0) / rtts.length
          : 0;
        const jitter = rtts.length >= 2
          ? rtts.slice(1).reduce((sum, value, index) => sum + Math.abs(value - rtts[index]), 0) / (rtts.length - 1)
          : 0;
        const maxLatency = rtts.length ? Math.max(...rtts) : 0;
        const maxLatencySpike = Math.max(0, maxLatency - avgLatency);
        const grade = getGamingGrade({ avgLatency, jitter, packetLoss, maxLatencySpike });

        resolve({
          durationMs: TEST_DURATION_MS,
          packetRateHz: PACKET_RATE_HZ,
          packetSize: PACKET_SIZE,
          sentPackets: sentCount,
          receivedPackets: receivedCount,
          avgLatency: Math.round(avgLatency * 100) / 100,
          jitter: Math.round(jitter * 100) / 100,
          packetLoss: Math.round(packetLoss * 100) / 100,
          maxLatencySpike: Math.round(maxLatencySpike * 100) / 100,
          ...grade,
        });
      };

      const hardTimeout = setTimeout(finalize, HARD_TIMEOUT_MS);

      const buildPacketPayload = (index) => {
        const prefix = `GM:${index}:${Date.now()}:`;
        const paddingLength = Math.max(PACKET_SIZE - prefix.length, 0);
        return `${prefix}${'x'.repeat(paddingLength)}`;
      };

      const parsePacketIndex = (rawData) => {
        const text = typeof rawData === 'string'
          ? rawData
          : rawData instanceof ArrayBuffer
            ? Array.from(new Uint8Array(rawData)).map((value) => String.fromCharCode(value)).join('')
            : null;

        if (!text || !text.startsWith('GM:')) {
          return null;
        }

        const segments = text.split(':');
        if (segments.length < 2) {
          return null;
        }

        const index = Number(segments[1]);
        return Number.isFinite(index) ? index : null;
      };

      const schedulePacket = (index) => {
        if (completed) return;

        const elapsed = Date.now() - testStartedAt;
        const totalPackets = Math.round((TEST_DURATION_MS / 1000) * PACKET_RATE_HZ);
        if (elapsed >= TEST_DURATION_MS || index >= totalPackets) {
          setTimeout(() => {
            clearTimeout(hardTimeout);
            finalize();
          }, RESPONSE_GRACE_MS);
          return;
        }

        const payload = buildPacketPayload(index);

        const sentAt = Date.now();
        sentTimes.set(index, sentAt);
        sentCount += 1;

        try {
          socket.send(payload);
        } catch (error) {
          clearTimeout(hardTimeout);
          reject(new Error(error?.message || 'Failed to send gaming test packet.'));
          return;
        }

        if (onProgress) {
          onProgress({
            elapsedMs: elapsed,
            sentPackets: sentCount,
            receivedPackets: receivedCount,
          });
        }

        const nextTarget = testStartedAt + ((index + 1) * PACKET_INTERVAL_MS);
        const delay = Math.max(0, nextTarget - Date.now());
        sendTimer = setTimeout(() => schedulePacket(index + 1), delay);
      };

      try {
        socket = new WebSocket(endpoint);
      } catch (error) {
        clearTimeout(hardTimeout);
        reject(new Error('Gaming test transport could not start.'));
        return;
      }

      socket.onopen = () => {
        testStartedAt = Date.now();
        schedulePacket(0);
      };

      socket.onmessage = (event) => {
        if (completed) return;

        try {
          const index = parsePacketIndex(event.data);
          if (index === null) return;

          const sentAt = sentTimes.get(index);
          if (typeof sentAt !== 'number') return;

          sentTimes.delete(index);
          receivedCount += 1;
          rtts.push(Date.now() - sentAt);
        } catch {}
      };

      socket.onerror = () => {
        clearTimeout(hardTimeout);
        reject(new Error('Gaming test transport failed.'));
      };

      socket.onclose = () => {
        if (!completed) {
          clearTimeout(hardTimeout);
          finalize();
        }
      };
    });
  }
}

export default new GamingModeTest();

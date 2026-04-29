import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';

const ExpoTraceroute = requireOptionalNativeModule('ExpoTraceroute');

const CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_HOPS = 15;
const HOP_TIMEOUT_MS = 1000;
const routeCache = new Map();

class TracerouteService {
  _normalizeHost(host) {
    if (!host || typeof host !== 'string') return null;

    const trimmed = host.trim();
    if (!trimmed) return null;

    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      try {
        return new URL(trimmed).hostname || null;
      } catch {
        return null;
      }
    }

    return trimmed;
  }

  resolveTargetHost(testResult) {
    if (!testResult) return null;

    const explicit = this._normalizeHost(testResult.serverHost);
    if (explicit) return explicit;

    const fromName = this._normalizeHost(testResult.serverName);
    if (fromName && fromName.includes('.')) return fromName;

    if (String(testResult.provider || '').toLowerCase() === 'cloudflare') {
      return 'speed.cloudflare.com';
    }

    if (String(testResult.serverName || '').toLowerCase() === 'cloudflare') {
      return 'speed.cloudflare.com';
    }

    return null;
  }

  _getCached(host) {
    const cached = routeCache.get(host);
    if (!cached) return null;
    if ((Date.now() - cached.timestamp) > CACHE_TTL_MS) {
      routeCache.delete(host);
      return null;
    }
    return cached;
  }

  _setCached(host, result) {
    routeCache.set(host, {
      ...result,
      timestamp: Date.now(),
      cached: false,
    });
  }

  analyzeRoute(hops = []) {
    for (let index = 1; index < hops.length; index += 1) {
      const previous = hops[index - 1];
      const current = hops[index];
      if (typeof previous?.rtt !== 'number' || typeof current?.rtt !== 'number') continue;

      if ((current.rtt - previous.rtt) > 50) {
        return {
          hop: current.hop,
          message: `Possible congestion at Hop ${current.hop}`,
        };
      }
    }

    return null;
  }

  async diagnoseRoute(targetHostInput) {
    const targetHost = this._normalizeHost(targetHostInput);
    if (!targetHost) {
      return {
        hops: [],
        targetHost: null,
        warning: null,
        error: 'No server host available for route diagnosis.',
        cached: false,
      };
    }

    const cached = this._getCached(targetHost);
    if (cached) {
      return {
        ...cached,
        cached: true,
      };
    }

    if (Platform.OS !== 'android' || !ExpoTraceroute?.traceRouteAsync) {
      return {
        hops: [],
        targetHost,
        warning: null,
        error: 'Traceroute is only available on Android builds with the native route module.',
        cached: false,
      };
    }

    try {
      const hops = await ExpoTraceroute.traceRouteAsync(targetHost, MAX_HOPS, HOP_TIMEOUT_MS);
      const normalizedHops = Array.isArray(hops)
        ? hops.map((hop) => ({
          hop: Number(hop?.hop) || 0,
          ip: hop?.ip || '*',
          rtt: typeof hop?.rtt === 'number' ? hop.rtt : null,
          timeout: Boolean(hop?.timeout),
        }))
        : [];

      const result = {
        hops: normalizedHops,
        targetHost,
        warning: this.analyzeRoute(normalizedHops),
        error: normalizedHops.length ? null : 'Traceroute did not return any hops.',
      };

      this._setCached(targetHost, result);
      return {
        ...result,
        cached: false,
      };
    } catch (error) {
      return {
        hops: [],
        targetHost,
        warning: null,
        error: error?.message || 'Traceroute failed.',
        cached: false,
      };
    }
  }
}

export default new TracerouteService();

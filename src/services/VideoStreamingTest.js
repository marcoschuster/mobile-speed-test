import { useEventListener } from 'expo';
import { VideoView, useVideoPlayer } from 'expo-video';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

const TEST_WINDOW_MS = 10000;
const MAX_TTF_MS = 3000;
const MAX_REBUFFERS = 2;

const APPLE_IMMERSIVE_BASE = 'https://devstreaming-cdn.apple.com/videos/streaming/examples/immersive-media/apple-immersive-video/';
const APPLE_DV_BASE = 'https://devstreaming-cdn.apple.com/videos/streaming/examples/adv_dv_atmos/';
const APPLE_BIPBOP_BASE = 'https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_fmp4/';
const VODOBOX_4K_BASE = 'https://sample.vodobox.net/skate_phantom_flex_4k/';

export const STREAM_PROFILES = [
  {
    quality: '4K60',
    label: '4K60',
    targetBitrateMbps: 50,
    streamBitrateMbps: 49.9,
    resolution: '4320x4320',
    frameRate: 90,
    uri: `${APPLE_IMMERSIVE_BASE}hls/AivBeachWWDC_VideoVar_3/playlist.m3u8`,
  },
  {
    quality: '4K',
    label: '4K',
    targetBitrateMbps: 25,
    streamBitrateMbps: 24.5,
    resolution: '3840x2160',
    frameRate: 24,
    uri: `${APPLE_DV_BASE}Job2dae5735-d6ca-48ca-91be-0ec0bead535c-107702578-hls_bundle_hdrhls798_dolbyvision/prog_index.m3u8`,
  },
  {
    quality: '1080p',
    label: '1080p',
    targetBitrateMbps: 5,
    streamBitrateMbps: 5.4,
    resolution: '1920x1080',
    frameRate: 24,
    uri: `${VODOBOX_4K_BASE}fullhd/skate_phantom_flex_4k_4160_1080p.m3u8`,
  },
  {
    quality: '480p',
    label: '480p',
    targetBitrateMbps: 2,
    streamBitrateMbps: 2.2,
    resolution: '960x540',
    frameRate: 60,
    uri: `${APPLE_BIPBOP_BASE}v5/prog_index.m3u8`,
  },
];

const COMPATIBILITY_ERROR_PATTERN = /unsupported|not supported|decoder|codec|format|manifest|playlist|layout|dvh1|hevc|hvc1|exo|avplayer/i;

const SERVICE_LIBRARY = [
  { name: 'YouTube', tier4k: '4K', tierHd: '1080p', color: '#FF0033', textColor: '#FFFFFF' },
  { name: 'Netflix', tier4k: '4K HDR', tierHd: 'HD', color: '#E50914', textColor: '#FFFFFF' },
  { name: 'Prime Video', tier4k: '4K', tierHd: 'HD', color: '#00A8E1', textColor: '#08111A' },
  { name: 'Disney+', tier4k: '4K', tierHd: 'HD', color: '#113CCF', textColor: '#FFFFFF' },
];

const QUALITY_RANK = {
  'Below 480p': 0,
  '480p': 1,
  '1080p': 2,
  '4K': 3,
  '4K60': 4,
};

const BANDWIDTH_QUALITY_CAPS = [
  { quality: '4K60', minimumMbps: 50 },
  { quality: '4K', minimumMbps: 25 },
  { quality: '1080p', minimumMbps: 5 },
  { quality: '480p', minimumMbps: 2 },
];

const stringifyError = (error) => {
  if (!error) return 'Unknown playback error';
  if (typeof error === 'string') return error;
  if (typeof error?.message === 'string') return error.message;
  return JSON.stringify(error);
};

const isCompatibilityError = (error) => COMPATIBILITY_ERROR_PATTERN.test(String(error || ''));

const normalizeMetric = (value, digits = 2) => (
  typeof value === 'number' && Number.isFinite(value) ? Number(value.toFixed(digits)) : null
);

const getBandwidthQualityCap = (measuredDownloadMbps = 0) => (
  BANDWIDTH_QUALITY_CAPS.find((cap) => measuredDownloadMbps >= cap.minimumMbps)?.quality || 'Below 480p'
);

const getLowerQuality = (firstQuality, secondQuality) => (
  (QUALITY_RANK[firstQuality] || 0) <= (QUALITY_RANK[secondQuality] || 0) ? firstQuality : secondQuality
);

const summarizeResult = ({
  sustainableProfile,
  measuredDownloadMbps,
  bandwidthQualityCap,
  quality,
  canStream4K,
  canStreamHd,
  canStreamSd,
  compatibilityLimited,
}) => {
  if (measuredDownloadMbps < 2) {
    return `Measured bandwidth is only ${measuredDownloadMbps.toFixed(1)} Mbps, below the usual floor for stable 480p video. Expect buffering or failed starts.`;
  }

  if (bandwidthQualityCap !== sustainableProfile?.quality) {
    if (quality === '480p') {
      return `Playback started, but ${measuredDownloadMbps.toFixed(1)} Mbps only leaves enough headroom for low-resolution streaming. HD and 4K are likely to buffer.`;
    }

    if (quality === '1080p') {
      return `Playback was stable, but ${measuredDownloadMbps.toFixed(1)} Mbps caps this connection around HD. 4K needs more sustained bandwidth.`;
    }
  }

  if (canStream4K && sustainableProfile?.quality === '4K60') {
    return 'Can stream 4K YouTube and Netflix 4K HDR with headroom for higher frame-rate playback.';
  }

  if (canStream4K) {
    return compatibilityLimited
      ? 'Bandwidth is strong enough for Netflix 4K HDR, but the highest probe sample used a format your device player may not fully support.'
      : 'Can stream 4K YouTube and Netflix 4K HDR on this connection.';
  }

  if (canStreamHd) {
    return 'Sustains HD streaming well, but 4K playback is likely to stall or start too slowly.';
  }

  if (canStreamSd) {
    return 'Only lower-bitrate streaming looked stable during the HLS playback probe.';
  }

  return 'Real HLS playback did not sustain even the lowest test profile.';
};

const buildServices = ({ canStream4K, canStreamHd, canStreamSd }) => {
  const supported = canStream4K || canStreamHd || canStreamSd;

  return SERVICE_LIBRARY.map((service) => ({
    name: service.name,
    tier: canStream4K ? service.tier4k : canStreamHd ? service.tierHd : canStreamSd ? 'SD' : 'Not stable',
    supported,
    emphasis: canStream4K,
    color: service.color,
    textColor: service.textColor,
  }));
};

const getStreamingGrade = ({
  quality,
  measuredDownloadMbps,
  sustainableProfile,
  canStream4K,
  canStreamHd,
  canStreamSd,
}) => {
  const ttf = sustainableProfile?.timeToFirstFrameMs;
  const rebuffers = sustainableProfile?.rebufferCount ?? Number.POSITIVE_INFINITY;

  if (
    quality === '4K60' &&
    measuredDownloadMbps >= 60 &&
    typeof ttf === 'number' &&
    ttf <= 1000 &&
    rebuffers === 0
  ) {
    return 'S';
  }

  if (
    canStream4K &&
    measuredDownloadMbps >= 35 &&
    typeof ttf === 'number' &&
    ttf <= 1500 &&
    rebuffers === 0
  ) {
    return 'A+';
  }

  if (canStream4K) {
    return 'A';
  }

  if (canStreamHd && measuredDownloadMbps >= 10 && rebuffers <= 1) {
    return 'B';
  }

  if (canStreamHd || canStreamSd) {
    return 'C';
  }

  if (measuredDownloadMbps >= 1) {
    return 'D';
  }

  return 'F';
};

const buildAssessment = (tests, measuredDownloadMbps = 0) => {
  const normalizedDownloadMbps = normalizeMetric(measuredDownloadMbps, 1) || 0;
  const sustainableProfile = tests.find((test) => test.canSustain) || null;
  const playbackQuality = sustainableProfile?.quality || 'Below 480p';
  const bandwidthQualityCap = getBandwidthQualityCap(normalizedDownloadMbps);
  const quality = getLowerQuality(playbackQuality, bandwidthQualityCap);
  const compatibilityLimited = tests.some(
    (test) => (test.quality === '4K60' || test.quality === '4K') && test.unsupportedFormat
  );
  const canDirect4K = quality === '4K60' || quality === '4K';
  const hasStableHd = QUALITY_RANK[quality] >= QUALITY_RANK['1080p'];
  const canStream4K = normalizedDownloadMbps >= 25 && (canDirect4K || (
    compatibilityLimited &&
    hasStableHd &&
    normalizedDownloadMbps >= 35
  ));
  const canStreamHd = !canStream4K && hasStableHd;
  const canStreamSd = QUALITY_RANK[quality] >= QUALITY_RANK['480p'];
  const grade = getStreamingGrade({
    quality,
    measuredDownloadMbps: normalizedDownloadMbps,
    sustainableProfile,
    canStream4K,
    canStreamHd,
    canStreamSd,
  });

  return {
    grade,
    quality,
    playbackQuality,
    bandwidthQualityCap,
    canStream4K,
    canStreamHd,
    canStreamSd,
    canStreamNetflix4KHDR: canStream4K && normalizedDownloadMbps >= 25,
    canStreamYouTube4K: canStream4K,
    compatibilityLimited,
    measuredDownloadMbps: normalizedDownloadMbps,
    sustainableProfile,
    services: buildServices({ canStream4K, canStreamHd, canStreamSd }),
    summary: summarizeResult({
      sustainableProfile,
      measuredDownloadMbps: normalizedDownloadMbps,
      bandwidthQualityCap,
      quality,
      canStream4K,
      canStreamHd,
      canStreamSd,
      compatibilityLimited,
    }),
    tests,
  };
};

class VideoStreamingTestService {
  constructor() {
    this.host = null;
    this.isRunning = false;
    this.cancelled = false;
  }

  attachHost(host) {
    this.host = host;
  }

  detachHost(host) {
    if (this.host === host) {
      this.host = null;
    }
  }

  cancel() {
    this.cancelled = true;
    this.host?.cancelProbe?.();
  }

  async run({ measuredDownloadMbps = 0, onProgress } = {}) {
    if (!this.host) {
      throw new Error('Video streaming probe host is not mounted.');
    }

    if (this.isRunning) {
      throw new Error('Video streaming probe is already running.');
    }

    this.isRunning = true;
    this.cancelled = false;
    const startedAt = Date.now();
    const tests = [];

    try {
      for (const profile of STREAM_PROFILES) {
        if (this.cancelled) {
          throw new Error('Video streaming probe cancelled.');
        }

        onProgress?.(`Testing ${profile.label} stream...`);
        const result = await this.host.probeProfile(profile);
        tests.push(result);

        if (result.canSustain) {
          break;
        }
      }

      const assessment = buildAssessment(tests, measuredDownloadMbps);
      return {
        ...assessment,
        completedInMs: Date.now() - startedAt,
      };
    } finally {
      this.isRunning = false;
      this.cancelled = false;
    }
  }
}

const VideoStreamingTest = new VideoStreamingTestService();

export const HiddenVideoStreamingTestHost = () => {
  const probeRef = useRef(null);
  const player = useVideoPlayer(null, (player) => {
    player.loop = false;
    player.muted = true;
    player.timeUpdateEventInterval = 0.25;
    player.volume = 0;
  });

  const stopAndUnload = useCallback(async () => {
    try {
      player.pause();
    } catch (_error) {}

    try {
      await player.replaceAsync(null);
    } catch (_error) {}
  }, [player]);

  const finishProbe = useMemo(() => (
    async (state, patch = {}) => {
      if (!state || state.finished) {
        return;
      }

      state.finished = true;
      clearTimeout(state.timeout);

      const error = patch.error ? stringifyError(patch.error) : null;
      const result = {
        ...state.result,
        ...patch,
        error,
        unsupportedFormat: Boolean(
          patch.unsupportedFormat || (error && isCompatibilityError(error))
        ),
        elapsedMs: Date.now() - state.startedAt,
      };

      result.canSustain = Boolean(
        !result.error &&
        typeof result.timeToFirstFrameMs === 'number' &&
        result.timeToFirstFrameMs <= MAX_TTF_MS &&
        result.rebufferCount <= MAX_REBUFFERS
      );

      probeRef.current = null;
      await stopAndUnload();
      state.resolve(result);
    }
  ), [stopAndUnload]);

  useEffect(() => {
    const host = {
      probeProfile: async (profile) => {
        if (probeRef.current) {
          await finishProbe(probeRef.current, { error: 'Probe interrupted.' });
        }

        await stopAndUnload();

        return new Promise(async (resolve) => {
          const startedAt = Date.now();
          const result = {
            quality: profile.quality,
            label: profile.label,
            targetBitrateMbps: profile.targetBitrateMbps,
            streamBitrateMbps: profile.streamBitrateMbps,
            resolution: profile.resolution,
            frameRate: profile.frameRate,
            uri: profile.uri,
            timeToFirstFrameMs: null,
            rebufferCount: 0,
            error: null,
            unsupportedFormat: false,
            canSustain: false,
          };

          const state = {
            result,
            resolve,
            startedAt,
            finished: false,
            sawFrame: false,
            wasBuffering: false,
            timeout: setTimeout(() => {
              void finishProbe(state);
            }, TEST_WINDOW_MS),
          };

          probeRef.current = state;

          try {
            await player.replaceAsync({ uri: profile.uri, contentType: 'hls' });
            player.currentTime = 0;
            player.play();
          } catch (error) {
            await finishProbe(state, { error });
          }
        });
      },
      cancelProbe: () => {
        if (probeRef.current) {
          void finishProbe(probeRef.current, { error: 'Probe cancelled.' });
        } else {
          void stopAndUnload();
        }
      },
    };

    VideoStreamingTest.attachHost(host);

    return () => {
      VideoStreamingTest.detachHost(host);
      if (probeRef.current) {
        void finishProbe(probeRef.current, { error: 'Probe host unmounted.' });
      } else {
        void stopAndUnload();
      }
    };
  }, [finishProbe]);

  const markFirstFrame = useCallback(async () => {
    const state = probeRef.current;

    if (!state || state.finished || state.sawFrame) {
      return;
    }

    state.sawFrame = true;
    state.result.timeToFirstFrameMs = Date.now() - state.startedAt;
  }, []);

  useEventListener(player, 'statusChange', ({ status, error }) => {
    const state = probeRef.current;

    if (!state || state.finished) {
      return;
    }

    if (error || status === 'error') {
      void finishProbe(state, { error: error || 'Video playback failed.' });
      return;
    }

    if (state.sawFrame && status === 'loading' && !state.wasBuffering) {
      state.result.rebufferCount += 1;
    }

    state.wasBuffering = status === 'loading';
  });

  useEventListener(player, 'playingChange', ({ isPlaying }) => {
    if (isPlaying) {
      void markFirstFrame();
    }
  });

  useEventListener(player, 'timeUpdate', ({ currentTime }) => {
    if (currentTime > 0) {
      void markFirstFrame();
    }
  });

  return (
    <View pointerEvents="none" style={styles.host}>
      <VideoView
        player={player}
        style={styles.video}
        nativeControls={false}
        contentFit="contain"
        onFirstFrameRender={() => {
          void markFirstFrame();
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
    left: -100,
    top: -100,
  },
  video: {
    width: 1,
    height: 1,
  },
});

export default VideoStreamingTest;

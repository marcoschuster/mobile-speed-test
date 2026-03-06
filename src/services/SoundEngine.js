// ─────────────────────────────────────────────────────────────────────────────
// ZOLT — Premium Sound Engine
//
// Generates all SFX programmatically using the Web Audio API (AudioContext).
// No external audio files needed. Every sound is synthesised from pure
// oscillators, noise, and envelopes to achieve a minimalist "glassy" aesthetic.
//
// Haptic feedback is layered on top via expo-haptics for mobile.
//
// All sounds respect a master volume (0–1) persisted in AsyncStorage.
// A master mute toggle is also provided.
// ─────────────────────────────────────────────────────────────────────────────

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

let Haptics = null;
try {
  Haptics = require('expo-haptics');
} catch (e) {
  // expo-haptics not available (web, etc.)
}

// ── AudioContext singleton ───────────────────────────────────────────────────
let _ctx = null;
const getCtx = () => {
  if (_ctx) return _ctx;
  try {
    const AC = typeof AudioContext !== 'undefined'
      ? AudioContext
      : typeof webkitAudioContext !== 'undefined'
        ? webkitAudioContext
        : null;
    if (AC) _ctx = new AC();
  } catch (e) {
    // Audio not supported
  }
  return _ctx;
};

// ── Storage keys ────────────────────────────────────────────────────────────
const VOL_KEY = '@zolt_sfx_volume';
const MUTE_KEY = '@zolt_sfx_muted';
const HAPTIC_KEY = '@zolt_haptics';

class SoundEngine {
  constructor() {
    this._volume = 0.7;        // 0–1 master volume
    this._muted = false;
    this._hapticsEnabled = true;
    this._loaded = false;
    this._loadPrefs();
  }

  // ── Persistence ─────────────────────────────────────────────────────────

  async _loadPrefs() {
    try {
      const [vol, muted, haptics] = await Promise.all([
        AsyncStorage.getItem(VOL_KEY),
        AsyncStorage.getItem(MUTE_KEY),
        AsyncStorage.getItem(HAPTIC_KEY),
      ]);
      if (vol !== null) this._volume = parseFloat(vol);
      if (muted !== null) this._muted = muted === 'true';
      if (haptics !== null) this._hapticsEnabled = haptics !== 'false';
    } catch (e) { /* ignore */ }
    this._loaded = true;
  }

  get volume() { return this._volume; }
  set volume(v) {
    this._volume = Math.max(0, Math.min(1, v));
    AsyncStorage.setItem(VOL_KEY, String(this._volume)).catch(() => {});
  }

  get muted() { return this._muted; }
  set muted(m) {
    this._muted = !!m;
    AsyncStorage.setItem(MUTE_KEY, String(this._muted)).catch(() => {});
  }

  get hapticsEnabled() { return this._hapticsEnabled; }
  set hapticsEnabled(h) {
    this._hapticsEnabled = !!h;
    AsyncStorage.setItem(HAPTIC_KEY, String(this._hapticsEnabled)).catch(() => {});
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  _gain(ctx, vol = 1) {
    const g = ctx.createGain();
    // -3 dB headroom ≈ 0.707, then scale by master volume and per-sound vol
    g.gain.value = 0.707 * this._volume * vol;
    return g;
  }

  _canPlay() {
    if (this._muted) return false;
    const ctx = getCtx();
    if (!ctx) return false;
    // Resume suspended AudioContext (browser autoplay policy)
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return true;
  }

  // ── Haptics ─────────────────────────────────────────────────────────────

  _haptic(style = 'light') {
    if (!this._hapticsEnabled || !Haptics) return;
    if (Platform.OS === 'web') return;
    try {
      switch (style) {
        case 'light':
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          break;
        case 'medium':
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          break;
        case 'heavy':
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          break;
        case 'success':
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          break;
        case 'selection':
          Haptics.selectionAsync();
          break;
        default:
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (e) { /* haptics not available */ }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SOUND LIBRARY
  // Each method synthesises a short, premium sound from scratch.
  // ═══════════════════════════════════════════════════════════════════════════

  // ── 1. Start Test Button ────────────────────────────────────────────────
  // Firm, mid-frequency "popped" click — tactile and certain.
  // Two layered oscillators with fast attack/decay + a tiny noise burst.
  playStartTest() {
    if (!this._canPlay()) return;
    this._haptic('medium');
    const ctx = getCtx();
    const now = ctx.currentTime;

    // Layer 1: Pitched pop (sine → fast decay)
    const osc1 = ctx.createOscillator();
    const g1 = this._gain(ctx, 0.6);
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(800, now);
    osc1.frequency.exponentialRampToValueAtTime(300, now + 0.08);
    g1.gain.setValueAtTime(0.707 * this._volume * 0.6, now);
    g1.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc1.connect(g1).connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.12);

    // Layer 2: High harmonic click (triangle)
    const osc2 = ctx.createOscillator();
    const g2 = this._gain(ctx, 0.3);
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(2200, now);
    osc2.frequency.exponentialRampToValueAtTime(800, now + 0.04);
    g2.gain.setValueAtTime(0.707 * this._volume * 0.3, now);
    g2.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    osc2.connect(g2).connect(ctx.destination);
    osc2.start(now);
    osc2.stop(now + 0.08);
  }

  // ── 2. Navigation Tab Tick ──────────────────────────────────────────────
  // Very short, high-pitched "tick" — like a light toggle.
  playNavTick() {
    if (!this._canPlay()) return;
    this._haptic('selection');
    const ctx = getCtx();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const g = this._gain(ctx, 0.25);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(3800, now);
    osc.frequency.exponentialRampToValueAtTime(2400, now + 0.025);
    g.gain.setValueAtTime(0.707 * this._volume * 0.25, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    osc.connect(g).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.05);
  }

  // ── 3. Gauge Wind-up (Sheen) ───────────────────────────────────────────
  // Low-volume ascending "whir" that rises in pitch. Call with a 0–1
  // progress value; the method plays a short grain at the appropriate pitch.
  // Designed to be called periodically (every ~300ms) during the test.
  playGaugeWhir(progress = 0) {
    if (!this._canPlay()) return;
    const ctx = getCtx();
    const now = ctx.currentTime;

    // Map 0–1 progress to 200–1200 Hz
    const freq = 200 + progress * 1000;
    const vol = 0.06 + progress * 0.08; // very subtle, gets slightly louder

    const osc = ctx.createOscillator();
    const g = this._gain(ctx, vol);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.linearRampToValueAtTime(freq * 1.05, now + 0.15);
    g.gain.setValueAtTime(0.707 * this._volume * vol, now + 0.01);
    g.gain.linearRampToValueAtTime(0.707 * this._volume * vol * 0.8, now + 0.1);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    osc.connect(g).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.22);
  }

  // ── 4. Test Complete (Success Chime) ────────────────────────────────────
  // Soft, ascending two-note harmonic chime — signals results are ready.
  playTestComplete() {
    if (!this._canPlay()) return;
    this._haptic('success');
    const ctx = getCtx();
    const now = ctx.currentTime;

    const notes = [
      { freq: 880, start: 0, dur: 0.25 },      // A5
      { freq: 1318.5, start: 0.12, dur: 0.35 }, // E6 (ascending fifth)
    ];

    notes.forEach(({ freq, start, dur }) => {
      // Fundamental
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const peakVol = 0.707 * this._volume * 0.45;
      g.gain.setValueAtTime(0.001, now + start);
      g.gain.linearRampToValueAtTime(peakVol, now + start + 0.02);
      g.gain.setValueAtTime(peakVol, now + start + dur * 0.3);
      g.gain.exponentialRampToValueAtTime(0.001, now + start + dur);
      osc.connect(g).connect(ctx.destination);
      osc.start(now + start);
      osc.stop(now + start + dur + 0.02);

      // Shimmer harmonic (2x frequency, lower volume)
      const osc2 = ctx.createOscillator();
      const g2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.value = freq * 2;
      const shimVol = peakVol * 0.2;
      g2.gain.setValueAtTime(0.001, now + start);
      g2.gain.linearRampToValueAtTime(shimVol, now + start + 0.02);
      g2.gain.exponentialRampToValueAtTime(0.001, now + start + dur * 0.7);
      osc2.connect(g2).connect(ctx.destination);
      osc2.start(now + start);
      osc2.stop(now + start + dur + 0.02);
    });
  }

  // ── 5. Graph Point Interaction ──────────────────────────────────────────
  // "Water droplet" / resonant glass ping — short and crystalline.
  playGraphPing() {
    if (!this._canPlay()) return;
    this._haptic('light');
    const ctx = getCtx();
    const now = ctx.currentTime;

    // High sine with fast pitch drop (droplet feel)
    const osc = ctx.createOscillator();
    const g = this._gain(ctx, 0.35);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(4200, now);
    osc.frequency.exponentialRampToValueAtTime(1800, now + 0.06);
    osc.frequency.exponentialRampToValueAtTime(1400, now + 0.15);
    g.gain.setValueAtTime(0.707 * this._volume * 0.35, now);
    g.gain.setValueAtTime(0.707 * this._volume * 0.25, now + 0.04);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc.connect(g).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.2);

    // Resonance shimmer
    const osc2 = ctx.createOscillator();
    const g2 = this._gain(ctx, 0.1);
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(6400, now);
    osc2.frequency.exponentialRampToValueAtTime(2800, now + 0.08);
    g2.gain.setValueAtTime(0.707 * this._volume * 0.1, now);
    g2.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc2.connect(g2).connect(ctx.destination);
    osc2.start(now);
    osc2.stop(now + 0.14);
  }

  // ── 6. Toggle ON ───────────────────────────────────────────────────────
  // Bright ascending "chirp" — feels like activation.
  playToggleOn() {
    if (!this._canPlay()) return;
    this._haptic('light');
    const ctx = getCtx();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const g = this._gain(ctx, 0.3);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(1600, now + 0.07);
    g.gain.setValueAtTime(0.707 * this._volume * 0.3, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.connect(g).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  // ── 7. Toggle OFF ──────────────────────────────────────────────────────
  // Soft descending "thud" — feels like deactivation.
  playToggleOff() {
    if (!this._canPlay()) return;
    this._haptic('light');
    const ctx = getCtx();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const g = this._gain(ctx, 0.25);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(280, now + 0.08);
    g.gain.setValueAtTime(0.707 * this._volume * 0.25, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.connect(g).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  // ── 8. Phase Complete (per-metric) ─────────────────────────────────────
  // Quick, gentle ascending note to signal a single phase finished.
  // Lighter than the full test-complete chime.
  playPhaseComplete() {
    if (!this._canPlay()) return;
    this._haptic('light');
    const ctx = getCtx();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const g = this._gain(ctx, 0.3);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1047, now);           // C6
    osc.frequency.setValueAtTime(1047, now + 0.06);
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.707 * this._volume * 0.3, now + 0.015);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc.connect(g).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  // ── 9. Needle Peak Impact ──────────────────────────────────────────────
  // A subtle "thump" when the needle reaches its maximum during a test.
  playNeedlePeak() {
    if (!this._canPlay()) return;
    this._haptic('heavy');
    const ctx = getCtx();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const g = this._gain(ctx, 0.2);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.08);
    g.gain.setValueAtTime(0.707 * this._volume * 0.2, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(g).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.14);
  }
}

export default new SoundEngine();

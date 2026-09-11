import { EQ_BANDS, type EqPreset } from './presets';

interface Deck {
  id: 'A' | 'B';
  audio: HTMLAudioElement;
  source: MediaElementAudioSourceNode | null;
  gain: GainNode | null;
}

const STORAGE_KEY_VOLUME = 'otofy_saved_volume';

function getInitialSavedVolume(): number {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_VOLUME);
      if (saved !== null) {
        const val = parseFloat(saved);
        if (Number.isFinite(val) && val >= 0 && val <= 1) {
          return val;
        }
      }
    } catch {}
  }
  return 0.5; // Safe default volume (50%), strictly not 1.0
}

export class AudioEngine {
  private deckA: Deck;
  private deckB: Deck;
  private activeDeckId: 'A' | 'B' = 'A';
  private ctx: AudioContext | null = null;

  private masterGainNode: GainNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private limiterNode: DynamicsCompressorNode | null = null;
  private eqFilters: BiquadFilterNode[] = [];
  private isInitialized = false;

  private currentVolume = getInitialSavedVolume();
  private isMuted = false;
  private currentDeviceId = 'default';

  constructor() {
    this.deckA = {
      id: 'A',
      audio: new Audio(),
      source: null,
      gain: null,
    };
    this.deckB = {
      id: 'B',
      audio: new Audio(),
      source: null,
      gain: null,
    };

    this.configureAudioElement(this.deckA.audio);
    this.configureAudioElement(this.deckB.audio);
  }

  private configureAudioElement(el: HTMLAudioElement): void {
    el.crossOrigin = 'anonymous';
    el.preload = 'auto';
    if (typeof document !== 'undefined') {
      el.style.display = 'none';
      if (!el.isConnected && document.body) {
        document.body.appendChild(el);
      }
    }
    if (this.currentDeviceId && this.currentDeviceId !== 'default' && 'setSinkId' in el) {
      (el as any).setSinkId(this.currentDeviceId).catch(() => {});
    }
  }

  private ensureContext(): AudioContext {
    if (!this.ctx || this.ctx.state === 'closed') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    return this.ctx;
  }

  get activeAudioElement(): HTMLAudioElement {
    return this.activeDeckId === 'A' ? this.deckA.audio : this.deckB.audio;
  }

  get element(): HTMLAudioElement {
    return this.activeAudioElement;
  }

  get activeDeck(): 'A' | 'B' {
    return this.activeDeckId;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    const ctx = this.ensureContext();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    if (typeof document !== 'undefined' && document.body) {
      if (!this.deckA.audio.isConnected) document.body.appendChild(this.deckA.audio);
      if (!this.deckB.audio.isConnected) document.body.appendChild(this.deckB.audio);
    }

    // 1. Initialize Master Gain (controls player volume independently of crossfade with logarithmic curve)
    this.masterGainNode = ctx.createGain();
    this.masterGainNode.gain.value = this.isMuted ? 0 : Math.pow(this.currentVolume, 2.5);

    // 2. Initialize Analyser
    this.analyserNode = ctx.createAnalyser();
    this.analyserNode.fftSize = 128;
    this.analyserNode.smoothingTimeConstant = 0.8;

    // 3. Initialize Limiter / DynamicsCompressor
    this.limiterNode = ctx.createDynamicsCompressor();
    this.limiterNode.threshold.value = -0.5;
    this.limiterNode.knee.value = 6;
    this.limiterNode.ratio.value = 12;
    this.limiterNode.attack.value = 0.003;
    this.limiterNode.release.value = 0.25;

    // 4. Initialize 10-band EQ filters
    this.eqFilters = EQ_BANDS.map((band, index) => {
      const filter = ctx.createBiquadFilter();
      filter.frequency.value = band.frequency;
      filter.gain.value = 0;

      if (index === 0) {
        filter.type = 'lowshelf';
      } else if (index === EQ_BANDS.length - 1) {
        filter.type = 'highshelf';
      } else {
        filter.type = 'peaking';
        filter.Q.value = 1.414;
      }

      return filter;
    });

    // 5. Initialize Deck A
    this.deckA.source = ctx.createMediaElementSource(this.deckA.audio);
    this.deckA.gain = ctx.createGain();
    this.deckA.gain.gain.value = 1.0;
    this.deckA.source.connect(this.deckA.gain);

    // 6. Initialize Deck B
    this.deckB.source = ctx.createMediaElementSource(this.deckB.audio);
    this.deckB.gain = ctx.createGain();
    this.deckB.gain.gain.value = 0.0;
    this.deckB.source.connect(this.deckB.gain);

    // Connect Deck A & B gains to the first EQ band
    const firstFilter = this.eqFilters[0];
    this.deckA.gain.connect(firstFilter);
    this.deckB.gain.connect(firstFilter);

    // Chain EQ filters
    let currentNode: AudioNode = firstFilter;
    for (let i = 1; i < this.eqFilters.length; i++) {
      currentNode.connect(this.eqFilters[i]);
      currentNode = this.eqFilters[i];
    }

    // EQ -> Master Gain -> Limiter -> Analyser -> Destination
    currentNode.connect(this.masterGainNode);
    this.masterGainNode.connect(this.limiterNode);
    this.limiterNode.connect(this.analyserNode);
    this.analyserNode.connect(ctx.destination);

    this.isInitialized = true;
  }

  async loadTrack(url: string): Promise<void> {
    await this.initialize();
    const active = this.activeDeckId === 'A' ? this.deckA : this.deckB;
    const inactive = this.activeDeckId === 'A' ? this.deckB : this.deckA;

    // Reset gain ramps
    if (this.ctx && active.gain && inactive.gain) {
      active.gain.gain.cancelScheduledValues(this.ctx.currentTime);
      active.gain.gain.setValueAtTime(1.0, this.ctx.currentTime);
      inactive.gain.gain.cancelScheduledValues(this.ctx.currentTime);
      inactive.gain.gain.setValueAtTime(0.0, this.ctx.currentTime);
    }

    // Stop inactive deck
    inactive.audio.pause();
    inactive.audio.removeAttribute('src');
    inactive.audio.load();

    active.audio.src = url;
    active.audio.load();
  }

  async play(): Promise<void> {
    await this.initialize();
    const ctx = this.ensureContext();
    if (ctx.state === 'suspended') await ctx.resume();
    await this.activeAudioElement.play();
  }

  pause(): void {
    this.deckA.audio.pause();
    this.deckB.audio.pause();
  }

  async togglePlay(): Promise<void> {
    if (this.activeAudioElement.paused) {
      await this.play();
    } else {
      this.pause();
    }
  }

  seek(time: number): void {
    if (Number.isFinite(time) && time >= 0) {
      try {
        this.activeAudioElement.currentTime = time;
      } catch (err) {
        console.warn('[AudioEngine] Seek error:', err);
      }
    }
  }

  setVolume(volume: number): void {
    const clamped = Math.max(0, Math.min(1, volume));
    this.currentVolume = clamped;
    const actualGain = Math.pow(clamped, 2.5);
    if (this.masterGainNode && this.ctx) {
      this.masterGainNode.gain.setTargetAtTime(this.isMuted ? 0 : actualGain, this.ctx.currentTime, 0.015);
    }
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem(STORAGE_KEY_VOLUME, String(clamped));
      } catch {}
    }
  }

  get volume(): number {
    return this.currentVolume;
  }

  setMuted(muted: boolean): void {
    this.isMuted = muted;
    const actualGain = Math.pow(this.currentVolume, 2.5);
    if (this.masterGainNode && this.ctx) {
      this.masterGainNode.gain.setTargetAtTime(muted ? 0 : actualGain, this.ctx.currentTime, 0.015);
    }
  }

  /**
   * Dual Deck Crossfade Transition:
   * Smoothly crossfades from current active deck to the incoming deck over durationSec.
   */
  async crossfadeTo(nextTrackUrl: string, durationSec: number): Promise<void> {
    await this.initialize();
    const ctx = this.ensureContext();
    if (ctx.state === 'suspended') await ctx.resume();

    const isCurrentA = this.activeDeckId === 'A';
    const outgoing = isCurrentA ? this.deckA : this.deckB;
    const incoming = isCurrentA ? this.deckB : this.deckA;

    const duration = Math.max(0.5, Math.min(15, durationSec));

    // 1. Prepare incoming deck with silent volume
    if (incoming.gain) {
      incoming.gain.gain.cancelScheduledValues(ctx.currentTime);
      incoming.gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    }

    incoming.audio.src = nextTrackUrl;
    incoming.audio.currentTime = 0;
    try {
      await incoming.audio.play();
    } catch (err) {
      console.warn('[AudioEngine] Incoming deck failed to play in crossfade:', err);
    }

    // 2. Perform smooth linear gain crossfade
    const now = ctx.currentTime;
    if (outgoing.gain) {
      outgoing.gain.gain.cancelScheduledValues(now);
      outgoing.gain.gain.setValueAtTime(outgoing.gain.gain.value || 1.0, now);
      outgoing.gain.gain.linearRampToValueAtTime(0.0001, now + duration);
    }

    if (incoming.gain) {
      incoming.gain.gain.linearRampToValueAtTime(1.0, now + duration);
    }

    // 3. Switch active deck ID
    this.activeDeckId = isCurrentA ? 'B' : 'A';

    // 4. Cleanup outgoing deck after transition completes
    setTimeout(() => {
      outgoing.audio.pause();
      outgoing.audio.removeAttribute('src');
      outgoing.audio.load();
      if (this.ctx && outgoing.gain) {
        outgoing.gain.gain.cancelScheduledValues(this.ctx.currentTime);
        outgoing.gain.gain.setValueAtTime(0.0, this.ctx.currentTime);
      }
    }, duration * 1000 + 100);
  }

  setMonoAudio(enabled: boolean): void {
    const ctx = this.ensureContext();
    try {
      ctx.destination.channelCount = enabled ? 1 : 2;
      ctx.destination.channelCountMode = 'explicit';
    } catch (err) {
      console.warn('[AudioEngine] Mono audio setting error:', err);
    }
  }

  setNormalizeVolume(enabled: boolean): void {
    if (!this.limiterNode || !this.ctx) return;
    const now = this.ctx.currentTime;
    if (enabled) {
      // Dynamic range compressor for loudness equalization
      this.limiterNode.threshold.setTargetAtTime(-14, now, 0.05);
      this.limiterNode.knee.setTargetAtTime(12, now, 0.05);
      this.limiterNode.ratio.setTargetAtTime(4, now, 0.05);
      this.limiterNode.attack.setTargetAtTime(0.005, now, 0.05);
      this.limiterNode.release.setTargetAtTime(0.25, now, 0.05);
    } else {
      // Transparent brickwall peak limiter
      this.limiterNode.threshold.setTargetAtTime(-0.5, now, 0.05);
      this.limiterNode.knee.setTargetAtTime(6, now, 0.05);
      this.limiterNode.ratio.setTargetAtTime(12, now, 0.05);
      this.limiterNode.attack.setTargetAtTime(0.003, now, 0.05);
      this.limiterNode.release.setTargetAtTime(0.25, now, 0.05);
    }
  }

  async setOutputDevice(deviceId: string): Promise<void> {
    const id = deviceId || 'default';
    this.currentDeviceId = id;
    const tasks: Promise<any>[] = [];

    // 1. AudioContext destination setSinkId (Web Audio API graph)
    if (this.ctx && 'setSinkId' in this.ctx && typeof (this.ctx as any).setSinkId === 'function') {
      tasks.push(
        (this.ctx as any).setSinkId(id).catch((err: any) => {
          console.warn('[AudioEngine] AudioContext setSinkId failed:', err);
        })
      );
    }

    // 2. Both Deck elements setSinkId
    if (
      this.deckA?.audio &&
      'setSinkId' in this.deckA.audio &&
      typeof (this.deckA.audio as any).setSinkId === 'function'
    ) {
      tasks.push(
        (this.deckA.audio as any).setSinkId(id).catch((err: any) => {
          console.warn('[AudioEngine] DeckA setSinkId failed:', err);
        })
      );
    }
    if (
      this.deckB?.audio &&
      'setSinkId' in this.deckB.audio &&
      typeof (this.deckB.audio as any).setSinkId === 'function'
    ) {
      tasks.push(
        (this.deckB.audio as any).setSinkId(id).catch((err: any) => {
          console.warn('[AudioEngine] DeckB setSinkId failed:', err);
        })
      );
    }

    try {
      await Promise.all(tasks);
    } catch (err) {
      console.warn('[AudioEngine] setOutputDevice error:', err);
    }
  }

  // Event listener delegation across both decks
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions
  ): void {
    this.deckA.audio.addEventListener(type, listener, options);
    this.deckB.audio.addEventListener(type, listener, options);
  }

  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions
  ): void {
    this.deckA.audio.removeEventListener(type, listener, options);
    this.deckB.audio.removeEventListener(type, listener, options);
  }

  // EQ Methods
  setEqBand(index: number, gainDb: number): void {
    if (index >= 0 && index < this.eqFilters.length) {
      const clamped = Math.max(-12, Math.min(12, gainDb));
      const filter = this.eqFilters[index];
      const ctx = this.ensureContext();
      filter.gain.setTargetAtTime(clamped, ctx.currentTime, 0.015);
    }
  }

  applyEqPreset(preset: EqPreset): void {
    preset.bands.forEach((gain, i) => this.setEqBand(i, gain));
  }

  setEqEnabled(enabled: boolean): void {
    this.eqFilters.forEach(filter => {
      if (!enabled) {
        const ctx = this.ensureContext();
        filter.gain.setTargetAtTime(0, ctx.currentTime, 0.015);
      }
    });
  }

  // Analyser data for visualizations
  getFrequencyData(): Uint8Array {
    if (!this.analyserNode) return new Uint8Array(0);
    const data = new Uint8Array(this.analyserNode.frequencyBinCount);
    this.analyserNode.getByteFrequencyData(data);
    return data;
  }

  getTimeDomainData(): Uint8Array {
    if (!this.analyserNode) return new Uint8Array(0);
    const data = new Uint8Array(this.analyserNode.frequencyBinCount);
    this.analyserNode.getByteTimeDomainData(data);
    return data;
  }

  get currentTime(): number {
    const t = this.activeAudioElement.currentTime;
    return Number.isFinite(t) && t >= 0 ? t : 0;
  }

  get duration(): number {
    const d = this.activeAudioElement.duration;
    return Number.isFinite(d) && d > 0 ? d : 0;
  }

  get paused(): boolean {
    return this.activeAudioElement.paused;
  }

  // Setup media session
  setupMediaSession(metadata: {
    title: string;
    artist: string;
    album: string;
    artworkUrl?: string;
  }, handlers: {
    onPlay?: () => void;
    onPause?: () => void;
    onNext?: () => void;
    onPrev?: () => void;
    onSeek?: (time: number) => void;
  }): void {
    if (!('mediaSession' in navigator)) return;

    try {
      const artworks: MediaImage[] = [];
      if (metadata.artworkUrl) {
        artworks.push(
          { src: metadata.artworkUrl, sizes: '96x96', type: 'image/jpeg' },
          { src: metadata.artworkUrl, sizes: '128x128', type: 'image/jpeg' },
          { src: metadata.artworkUrl, sizes: '256x256', type: 'image/jpeg' },
          { src: metadata.artworkUrl, sizes: '512x512', type: 'image/jpeg' }
        );
      }

      navigator.mediaSession.metadata = new MediaMetadata({
        title: metadata.title || 'Unknown Track',
        artist: metadata.artist || 'Unknown Artist',
        album: metadata.album || 'Otofy',
        artwork: artworks,
      });

      if (handlers.onPlay) navigator.mediaSession.setActionHandler('play', handlers.onPlay);
      if (handlers.onPause) navigator.mediaSession.setActionHandler('pause', handlers.onPause);
      if (handlers.onNext) navigator.mediaSession.setActionHandler('nexttrack', handlers.onNext);
      if (handlers.onPrev) navigator.mediaSession.setActionHandler('previoustrack', handlers.onPrev);
      if (handlers.onSeek) {
        navigator.mediaSession.setActionHandler('seekto', (details) => {
          if (details.seekTime != null && Number.isFinite(details.seekTime)) {
            handlers.onSeek!(details.seekTime);
          }
        });
        navigator.mediaSession.setActionHandler('seekbackward', (details) => {
          const skip = details.seekOffset || 10;
          handlers.onSeek!(Math.max(0, this.currentTime - skip));
        });
        navigator.mediaSession.setActionHandler('seekforward', (details) => {
          const skip = details.seekOffset || 10;
          handlers.onSeek!(Math.min(this.duration || Infinity, this.currentTime + skip));
        });
      }
      navigator.mediaSession.setActionHandler('stop', () => {
        if (handlers.onPause) handlers.onPause();
      });
    } catch (err) {
      console.warn('[AudioEngine] setupMediaSession failed:', err);
    }
  }

  updateMediaSessionPosition(position: number, duration: number): void {
    if ('mediaSession' in navigator && 'setPositionState' in navigator.mediaSession) {
      try {
        if (Number.isFinite(duration) && duration > 0 && Number.isFinite(position) && position >= 0) {
          navigator.mediaSession.setPositionState({
            duration: duration,
            playbackRate: 1,
            position: Math.min(position, duration),
          });
        }
      } catch { /* ignore invalid state */ }
    }
  }

  setPlaybackState(state: 'none' | 'paused' | 'playing'): void {
    if ('mediaSession' in navigator) {
      try {
        navigator.mediaSession.playbackState = state;
      } catch {}
    }
  }

  destroy(): void {
    this.deckA.audio.pause();
    this.deckA.audio.src = '';
    this.deckB.audio.pause();
    this.deckB.audio.src = '';
    if (this.ctx && this.ctx.state !== 'closed') {
      this.ctx.close();
    }
    this.isInitialized = false;
    this.eqFilters = [];
    this.deckA.source = null;
    this.deckA.gain = null;
    this.deckB.source = null;
    this.deckB.gain = null;
    this.masterGainNode = null;
    this.analyserNode = null;
    this.limiterNode = null;
    this.ctx = null;
  }
}

// Singleton
export const audioEngine = new AudioEngine();
export default audioEngine;

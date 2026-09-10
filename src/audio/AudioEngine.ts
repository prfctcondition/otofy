import { EQ_BANDS, type EqPreset } from './presets';

interface Deck {
  id: 'A' | 'B';
  audio: HTMLAudioElement;
  source: MediaElementAudioSourceNode | null;
  gain: GainNode | null;
}

class AudioEngine {
  private ctx: AudioContext | null = null;
  private deckA: Deck;
  private deckB: Deck;
  private activeDeckId: 'A' | 'B' = 'A';

  private masterGainNode: GainNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private limiterNode: DynamicsCompressorNode | null = null;
  private eqFilters: BiquadFilterNode[] = [];
  private isInitialized = false;

  private currentVolume = 1.0;
  private isMuted = false;

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

    // 1. Initialize Master Gain (controls player volume independently of crossfade)
    this.masterGainNode = ctx.createGain();
    this.masterGainNode.gain.value = this.isMuted ? 0 : this.currentVolume;

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
    if (isFinite(time) && time >= 0) {
      this.activeAudioElement.currentTime = time;
    }
  }

  setVolume(volume: number): void {
    const clamped = Math.max(0, Math.min(1, volume));
    this.currentVolume = clamped;
    if (this.masterGainNode && this.ctx) {
      this.masterGainNode.gain.setTargetAtTime(this.isMuted ? 0 : clamped, this.ctx.currentTime, 0.015);
    }
  }

  setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (this.masterGainNode && this.ctx) {
      this.masterGainNode.gain.setTargetAtTime(muted ? 0 : this.currentVolume, this.ctx.currentTime, 0.015);
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
    const tasks = [];
    if ('setSinkId' in this.deckA.audio) {
      tasks.push((this.deckA.audio as any).setSinkId(id).catch(() => {}));
    }
    if ('setSinkId' in this.deckB.audio) {
      tasks.push((this.deckB.audio as any).setSinkId(id).catch(() => {}));
    }
    await Promise.all(tasks);
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
    return this.activeAudioElement.currentTime;
  }

  get duration(): number {
    return this.activeAudioElement.duration || 0;
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

    navigator.mediaSession.metadata = new MediaMetadata({
      title: metadata.title,
      artist: metadata.artist,
      album: metadata.album,
      artwork: metadata.artworkUrl
        ? [{ src: metadata.artworkUrl, sizes: '512x512', type: 'image/jpeg' }]
        : [],
    });

    if (handlers.onPlay) navigator.mediaSession.setActionHandler('play', handlers.onPlay);
    if (handlers.onPause) navigator.mediaSession.setActionHandler('pause', handlers.onPause);
    if (handlers.onNext) navigator.mediaSession.setActionHandler('nexttrack', handlers.onNext);
    if (handlers.onPrev) navigator.mediaSession.setActionHandler('previoustrack', handlers.onPrev);
    if (handlers.onSeek) {
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime != null) handlers.onSeek!(details.seekTime);
      });
    }
  }

  updateMediaSessionPosition(position: number, duration: number): void {
    if ('mediaSession' in navigator && 'setPositionState' in navigator.mediaSession) {
      try {
        navigator.mediaSession.setPositionState({
          duration: duration || 0,
          playbackRate: 1,
          position: Math.min(position, duration || 0),
        });
      } catch { /* ignore invalid state */ }
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

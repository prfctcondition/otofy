import { EQ_BANDS, type EqPreset } from './presets';

class AudioEngine {
  private ctx: AudioContext | null = null;
  private audioElement: HTMLAudioElement;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private gainNode: GainNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private limiterNode: DynamicsCompressorNode | null = null;
  private eqFilters: BiquadFilterNode[] = [];
  private isInitialized = false;

  constructor() {
    this.audioElement = new Audio();
    this.audioElement.crossOrigin = 'anonymous';
    this.audioElement.preload = 'auto';
  }

  private ensureContext(): AudioContext {
    if (!this.ctx || this.ctx.state === 'closed') {
      this.ctx = new AudioContext();
    }
    return this.ctx;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    const ctx = this.ensureContext();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    // Create source from audio element
    this.sourceNode = ctx.createMediaElementSource(this.audioElement);

    // Create gain node
    this.gainNode = ctx.createGain();
    this.gainNode.gain.value = 1.0;

    // Create analyser
    this.analyserNode = ctx.createAnalyser();
    this.analyserNode.fftSize = 128;
    this.analyserNode.smoothingTimeConstant = 0.8;

    // Create studio-grade limiter (DynamicsCompressor) to prevent digital clipping when EQ bands are boosted
    this.limiterNode = ctx.createDynamicsCompressor();
    this.limiterNode.threshold.value = -0.5; // Start compression right before 0 dBFS clipping
    this.limiterNode.knee.value = 6;         // Smooth transition into compression
    this.limiterNode.ratio.value = 12;       // Limiting ratio
    this.limiterNode.attack.value = 0.003;   // 3ms fast attack
    this.limiterNode.release.value = 0.25;   // 250ms release

    // Create 10-band EQ filter chain
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

    // Connect chain: source -> EQ filters -> gain -> limiter -> analyser -> destination
    let currentNode: AudioNode = this.sourceNode;
    for (const filter of this.eqFilters) {
      currentNode.connect(filter);
      currentNode = filter;
    }
    currentNode.connect(this.gainNode);
    this.gainNode.connect(this.limiterNode);
    this.limiterNode.connect(this.analyserNode);
    this.analyserNode.connect(ctx.destination);

    this.isInitialized = true;
  }

  async loadTrack(url: string): Promise<void> {
    await this.initialize();
    this.audioElement.src = url;
    this.audioElement.load();
  }

  async play(): Promise<void> {
    await this.initialize();
    const ctx = this.ensureContext();
    if (ctx.state === 'suspended') await ctx.resume();
    await this.audioElement.play();
  }

  pause(): void {
    this.audioElement.pause();
  }

  async togglePlay(): Promise<void> {
    if (this.audioElement.paused) {
      await this.play();
    } else {
      this.pause();
    }
  }

  seek(time: number): void {
    if (isFinite(time) && time >= 0) {
      this.audioElement.currentTime = time;
    }
  }

  setVolume(volume: number): void {
    const clamped = Math.max(0, Math.min(1, volume));
    this.audioElement.volume = clamped;
  }

  setMuted(muted: boolean): void {
    this.audioElement.muted = muted;
  }

  // EQ Methods
  setEqBand(index: number, gainDb: number): void {
    if (index >= 0 && index < this.eqFilters.length) {
      const clamped = Math.max(-12, Math.min(12, gainDb));
      const filter = this.eqFilters[index];
      const ctx = this.ensureContext();
      // Smooth transition to avoid clicks
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

  // Event binding helpers
  get element(): HTMLAudioElement {
    return this.audioElement;
  }

  get currentTime(): number {
    return this.audioElement.currentTime;
  }

  get duration(): number {
    return this.audioElement.duration || 0;
  }

  get paused(): boolean {
    return this.audioElement.paused;
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
    this.audioElement.pause();
    this.audioElement.src = '';
    this.audioElement.load();
    if (this.ctx && this.ctx.state !== 'closed') {
      this.ctx.close();
    }
    this.isInitialized = false;
    this.eqFilters = [];
    this.sourceNode = null;
    this.gainNode = null;
    this.analyserNode = null;
    this.ctx = null;
  }
}

// Singleton
export const audioEngine = new AudioEngine();
export default audioEngine;

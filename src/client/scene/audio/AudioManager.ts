import { IAudioManager, AudioConfig, MusicGenre, MusicTrackId, MusicTrackMeta } from '../../../shared/types/space';
import { ProceduralAmbientSynth, MUSIC_TRACK_CATALOG } from './ProceduralAmbientSynth';

export { MUSIC_TRACK_CATALOG };
export type { MusicGenre, MusicTrackId, MusicTrackMeta };

/**
 * Equal-power cosine window seam crossfade function.
 * Blends start and end samples over a 50ms window to eliminate loop seam clicks.
 * PCM[i] = PCM_start[i] * ((1 - cos(pi*t))/2) + PCM_end[i] * ((1 + cos(pi*t))/2)
 */
export function applyCosineSeamCrossfade(buffer: AudioBuffer, seamDurationSec: number = 0.05): void {
  const sampleRate = buffer.sampleRate || 44100;
  const seamSamples = Math.min(
    Math.floor(seamDurationSec * sampleRate),
    Math.floor(buffer.length / 2)
  );

  if (seamSamples <= 0) return;

  const numChannels = buffer.numberOfChannels;
  const totalLength = buffer.length;

  for (let c = 0; c < numChannels; c++) {
    const pcm = buffer.getChannelData(c);

    for (let i = 0; i < seamSamples; i++) {
      const t = i / seamSamples; // 0.0 to 1.0
      const fadeStart = (1 - Math.cos(Math.PI * t)) / 2; // Ramps up from 0 to 1
      const fadeEnd = (1 + Math.cos(Math.PI * t)) / 2; // Ramps down from 1 to 0

      const valStart = pcm[i];
      const valEnd = pcm[totalLength - seamSamples + i];

      const blended = valStart * fadeStart + valEnd * fadeEnd;

      pcm[i] = blended;
      pcm[totalLength - seamSamples + i] = blended;
    }
  }
}

/**
 * Maps linear slider volume [0.0 - 1.0] or [0 - 100] to human-perceived loudness gain:
 * Gain = (slider / 100)^2.2
 */
export function calculateLogarithmicGain(volume: number): number {
  const normalized = volume > 1.0 ? volume / 100.0 : volume;
  const clamped = Math.max(0, Math.min(1.0, normalized));
  return Math.pow(clamped, 2.2);
}

/**
 * Unified Audio Manager conforming to IAudioManager.
 * Features:
 * - Pure Web Audio procedural generative ambient synthesizer (Mode A)
 * - Sampled audio buffer playback with 50ms cosine seam crossfade (Mode B)
 * - Safe Autoplay policy handling with one-time user gesture unlock
 * - Tab visibility management (auto-fade on tab hide, restore on focus)
 * - Click-free mute/unmute with 100ms micro-fade
 * - Logarithmic volume slider mapping: Gain = (vol/100)^2.2
 * - Real-time FFT AnalyserNode hook (bass, mid, treble energy extraction)
 */
export class AudioManager implements IAudioManager {
  public static readonly MUSIC_TRACK_CATALOG = MUSIC_TRACK_CATALOG;

  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sourceGain: GainNode | null = null;
  private windGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;

  private synth: ProceduralAmbientSynth | null = null;
  private activeBufferSource: AudioBufferSourceNode | null = null;
  private activeMediaElement: HTMLAudioElement | null = null;
  private activeMediaSourceNode: MediaElementAudioSourceNode | null = null;
  private activeMediaCleanup: (() => void) | null = null;
  private pendingMediaUrl: string | null = null;
  private deferredLoadTimer: ReturnType<typeof setTimeout> | null = null;
  private hasUserGesture: boolean = false;
  private loopEnabled: boolean = true;
  private playbackToken: number = 0;

  private currentVolume: number = 0.8; // 0.0 - 1.0
  private currentWindGain: number = 0.15;
  private muted: boolean = false;
  private currentConfig: AudioConfig | null = null;
  private currentMusicTrack: MusicTrackId = 'auto';
  public crossfadeDurationMs: number = 50;
  public onStateChange?: () => void;

  public get audioContext(): AudioContext | null {
    return this.ctx;
  }

  public get masterGainNode(): GainNode | null {
    return this.masterGain;
  }

  public get windGainNode(): GainNode | null {
    return this.windGain;
  }

  public get gain(): number {
    return this.muted ? 0 : calculateLogarithmicGain(this.currentVolume);
  }

  public get isLooping(): boolean {
    return this.loopEnabled;
  }

  public setLoop(loop: boolean): void {
    this.loopEnabled = Boolean(loop);
    if (this.currentConfig) {
      this.currentConfig = { ...this.currentConfig, loop: this.loopEnabled };
    }
    if (this.activeMediaElement) {
      this.activeMediaElement.loop = this.loopEnabled;
    }
    if (this.activeBufferSource) {
      this.activeBufferSource.loop = this.loopEnabled;
    }
    this.onStateChange?.();
  }

  public get currentTrackId(): string | null {
    return this.currentConfig?.trackId ?? null;
  }

  public get config(): AudioConfig | null {
    return this.currentConfig;
  }

  public get activeSourceCount(): number {
    return (
      (this.synth?.playing ? 1 : 0) +
      (this.activeBufferSource ? 1 : 0) +
      (this.activeMediaElement ? 1 : 0)
    );
  }

  public get isPlaying(): boolean {
    return Boolean(this.synth?.playing || this.activeBufferSource || this.activeMediaElement);
  }

  // FFT data array cache
  private fftDataArray: Uint8Array<ArrayBuffer> | null = null;

  // Bound listeners for cleanup
  private gestureListeners: Array<{ event: string; handler: () => void }> = [];
  private visibilityHandler: (() => void) | null = null;

  constructor(providedCtx?: AudioContext) {
    if (providedCtx) {
      this.ctx = providedCtx;
    } else if (typeof window !== 'undefined') {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        try {
          this.ctx = new AudioCtxClass();
        } catch (err) {
          console.warn('AudioContext initialization error:', err);
        }
      }
    }

    this.initializeAudioGraph();
    this.setupAutoplayUnlock();
    this.setupVisibilityHandling();
  }

  private initializeAudioGraph(): void {
    if (!this.ctx || typeof this.ctx.createGain !== 'function') return;

    try {
      this.sourceGain = this.ctx.createGain();
      this.masterGain = this.ctx.createGain();
      this.windGain = this.ctx.createGain();
      this.windGain.gain.value = this.currentWindGain;
      this.windGain.gain.setValueAtTime(this.currentWindGain, this.ctx.currentTime);

      const initialGain = calculateLogarithmicGain(this.currentVolume);
      this.masterGain.gain.value = initialGain;
      this.masterGain.gain.setValueAtTime(initialGain, this.ctx.currentTime);

      if (typeof this.ctx.createAnalyser === 'function') {
        this.analyser = this.ctx.createAnalyser();
        this.analyser.fftSize = 64; // 32 frequency bins
        this.analyser.smoothingTimeConstant = 0.8;
        this.fftDataArray = new Uint8Array(new ArrayBuffer(this.analyser.frequencyBinCount));

        this.sourceGain.connect(this.masterGain);
        this.masterGain.connect(this.analyser);
        this.analyser.connect(this.ctx.destination);
      } else {
        this.sourceGain.connect(this.masterGain);
        this.masterGain.connect(this.ctx.destination);
      }

      this.synth = new ProceduralAmbientSynth(this.ctx, this.sourceGain);
    } catch (err) {
      console.warn('AudioGraph setup error:', err);
    }
  }

  /**
   * Sets up user gesture listeners to resume suspended AudioContext.
   */
  private setupAutoplayUnlock(): void {
    if (!this.ctx) return;
    const target = typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null);
    if (!target || typeof (target as any).addEventListener !== 'function') return;

    const unlockEvents = ['click', 'keydown', 'touchstart', 'mousedown', 'pointerdown'];
    const resumeAudio = () => {
      this.markUserGesture();
      void this.resume();
    };

    for (const eventName of unlockEvents) {
      (target as any).addEventListener(eventName, resumeAudio, { passive: true });
      this.gestureListeners.push({ event: eventName, handler: resumeAudio });
    }
  }

  private markUserGesture(): void {
    this.hasUserGesture = true;
    if (typeof window !== 'undefined') {
      (window as any).__dreamerizeUserGesture = true;
    }
  }

  private isGestureUnlocked(): boolean {
    if (this.hasUserGesture) return true;
    if (typeof window === 'undefined') return true;
    return Boolean((window as any).__dreamerizeUserGesture);
  }

  private activatePendingMediaPlayback(): void {
    if (this.deferredLoadTimer) {
      clearTimeout(this.deferredLoadTimer);
      this.deferredLoadTimer = null;
    }
    if (!this.activeMediaElement) return;
    if (this.pendingMediaUrl && !this.activeMediaElement.src) {
      this.activeMediaElement.src = this.pendingMediaUrl;
    }
    this.activeMediaElement.loop = this.loopEnabled;
    if (this.activeMediaElement.src && this.activeMediaElement.paused) {
      void this.activeMediaElement.play().catch(() => {});
    }
  }

  public async resume(): Promise<void> {
    this.markUserGesture();
    this.activatePendingMediaPlayback();

    if (!this.ctx || this.ctx.state !== 'suspended') {
      this.onStateChange?.();
      return;
    }

    const wasSuspended = this.ctx.state === 'suspended';
    try {
      await this.ctx.resume();
      if (wasSuspended && (this.ctx?.state as string) === 'running' && this.synth?.playing) {
        this.synth.setMusicTrack(this.currentMusicTrack);
      }
      this.activatePendingMediaPlayback();
      this.onStateChange?.();
    } catch {
      // Ignore autoplay unlock errors until next user gesture
    }
  }

  public isSuspended(): boolean {
    return this.ctx?.state === 'suspended';
  }

  public setSoundscapeMix(musicLevel: number, natureLevel: number): void {
    this.synth?.setMixBalance(musicLevel, natureLevel);
    this.onStateChange?.();
  }

  public getSoundscapeMix(): { musicLevel: number; natureLevel: number } {
    return this.synth?.getMixBalance() ?? { musicLevel: 0.95, natureLevel: 0.58 };
  }

  public getMusicCatalog(): readonly MusicTrackMeta[] {
    return MUSIC_TRACK_CATALOG;
  }

  public getMusicTrack(): MusicTrackId {
    return this.synth?.getMusicTrack() ?? this.currentMusicTrack;
  }

  /**
   * Switches the active procedural music composition live while preserving
   * master volume, mute state, and the space-matched nature ambience.
   */
  public setMusicTrack(trackId: MusicTrackId): void {
    const valid = MUSIC_TRACK_CATALOG.some((t) => t.id === trackId);
    const resolved: MusicTrackId = valid ? trackId : 'auto';
    this.currentMusicTrack = resolved;

    void this.resume();

    if (this.synth) {
      // If a sampled audio buffer was active instead of procedural synth, hand over cleanly when user picks a specific track
      if (this.activeBufferSource && !this.synth.playing && resolved !== 'auto') {
        try {
          this.activeBufferSource.stop();
          this.activeBufferSource.disconnect();
        } catch {}
        this.activeBufferSource = null;
      }

      if (!this.synth.playing && !this.activeBufferSource) {
        this.synth.setMusicTrack(resolved);
        this.synth.start(this.currentConfig?.trackId || 'starry-night');
      } else {
        this.synth.setMusicTrack(resolved);
      }
    }
    this.onStateChange?.();
  }

  /**
   * Sets up tab visibility change handling to auto-fade audio when tab is backgrounded.
   */
  private setupVisibilityHandling(): void {
    if (typeof document === 'undefined') return;

    this.visibilityHandler = () => {
      if (!this.masterGain || !this.ctx) return;

      const now = this.ctx.currentTime;
      if (document.hidden) {
        // Tab backgrounded: fade master gain to 0 over 300ms
        try {
          this.masterGain.gain.setTargetAtTime(0, now, 0.08);
        } catch {
          this.masterGain.gain.value = 0;
        }
      } else {
        // Tab restored: fade master gain back to current volume
        const targetGain = this.muted ? 0 : calculateLogarithmicGain(this.currentVolume);
        try {
          this.masterGain.gain.setTargetAtTime(targetGain, now, 0.08);
        } catch {
          this.masterGain.gain.value = targetGain;
        }
      }
    };

    document.addEventListener('visibilitychange', this.visibilityHandler);
  }

  /**
   * Loads and plays the specified audio configuration.
   * Supports both Mode A (procedural_synth) and Mode B (audio_buffer / streamed MP3 loop).
   */
  public async loadAndPlay(config: AudioConfig): Promise<void> {
    const resolvedLoop = config.loop ?? true;
    this.loopEnabled = resolvedLoop;
    this.currentConfig = { ...config, loop: resolvedLoop };
    const token = ++this.playbackToken;

    // Apply default volume from config if specified
    if (config.defaultVolume !== undefined) {
      this.setVolume(config.defaultVolume);
    }

    // Stop currently playing source
    this.stopCurrentAudio(false);

    if (config.ambientType === 'procedural_synth') {
      // Mode A: Procedural Web Audio Synthesizer
      if (this.synth) {
        const slug = config.trackId || 'starry-night';
        this.synth.start(slug);
      }
    } else if (config.ambientType === 'audio_buffer' && config.sourceUrl) {
      // Mode B: Streamed HTMLAudioElement (for browser HTTP 206 loops) or decoded AudioBuffer fallback
      await this.loadBufferAndPlay(config.sourceUrl, resolvedLoop, token);
    }
  }

  /**
   * Plays an audio URL in a seamless loop routed through sourceGain -> masterGain -> analyser.
   * Uses HTMLAudioElement streaming via MediaElementAudioSourceNode in browser environments
   * with explicit ended + timeupdate wraparound guards for continuous gapless looping,
   * falling back to fetch + decodeAudioData when unavailable (e.g. unit tests).
   */
  private async loadBufferAndPlay(
    sourceUrl: string,
    loop: boolean,
    token: number = this.playbackToken
  ): Promise<void> {
    if (!this.ctx) return;

    const canUseMediaElement =
      typeof Audio !== 'undefined' &&
      typeof this.ctx.createMediaElementSource === 'function' &&
      Boolean(this.sourceGain);

    if (canUseMediaElement) {
      try {
        const audioEl = new Audio();
        audioEl.crossOrigin = 'anonymous';
        audioEl.loop = loop;
        audioEl.preload = 'auto';
        audioEl.volume = 1.0;

        const mediaNode = this.ctx.createMediaElementSource(audioEl);
        mediaNode.connect(this.sourceGain!);

        const handleMediaError = () => {
          if (token !== this.playbackToken || this.activeMediaElement !== audioEl) return;
          this.cleanupMediaElement();
          if (this.synth) {
            const slug = this.currentConfig?.trackId || 'starry-night';
            this.synth.start(slug);
          }
        };

        const handleEnded = () => {
          if (token !== this.playbackToken || this.activeMediaElement !== audioEl) return;
          if (this.loopEnabled) {
            audioEl.currentTime = 0;
            void audioEl.play().catch(() => {});
          }
        };

        const handleTimeUpdate = () => {
          if (token !== this.playbackToken || this.activeMediaElement !== audioEl) return;
          if (
            this.loopEnabled &&
            Number.isFinite(audioEl.duration) &&
            audioEl.duration > 1 &&
            audioEl.currentTime >= audioEl.duration - 0.08
          ) {
            audioEl.currentTime = 0;
            if (audioEl.paused) {
              void audioEl.play().catch(() => {});
            }
          }
        };

        audioEl.addEventListener('error', handleMediaError);
        audioEl.addEventListener('ended', handleEnded);
        audioEl.addEventListener('timeupdate', handleTimeUpdate);
        this.activeMediaElement = audioEl;
        this.activeMediaSourceNode = mediaNode;
        this.pendingMediaUrl = sourceUrl;
        this.activeMediaCleanup = () => {
          audioEl.removeEventListener('error', handleMediaError);
          audioEl.removeEventListener('ended', handleEnded);
          audioEl.removeEventListener('timeupdate', handleTimeUpdate);
        };

        if (this.isGestureUnlocked()) {
          this.activatePendingMediaPlayback();
        } else {
          this.deferredLoadTimer = setTimeout(() => {
            if (token !== this.playbackToken || this.activeMediaElement !== audioEl) return;
            this.activatePendingMediaPlayback();
          }, 1600);
        }
        return;
      } catch {
        this.cleanupMediaElement();
      }
    }

    if (typeof fetch === 'undefined') return;

    try {
      const response = await fetch(sourceUrl);
      if (token !== this.playbackToken) return;
      if ((response as any).ok === false) {
        throw new Error(`HTTP ${(response as any).status}`);
      }
      const contentType = (response as any).headers?.get?.('content-type') || '';
      if (contentType.includes('text/html') || contentType.includes('text/plain')) {
        throw new Error(`Invalid audio content-type: ${contentType}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      if (token !== this.playbackToken || !this.ctx) return;
      const decodedBuffer = await this.ctx.decodeAudioData(arrayBuffer);
      if (token !== this.playbackToken || !this.ctx) return;

      if (loop) {
        // Apply 50ms equal-power cosine window seam crossfade
        applyCosineSeamCrossfade(decodedBuffer, 0.05);
      }

      const sourceNode = this.ctx.createBufferSource();
      sourceNode.buffer = decodedBuffer;
      sourceNode.loop = loop;

      if (this.sourceGain) {
        sourceNode.connect(this.sourceGain);
      }

      sourceNode.start();
      this.activeBufferSource = sourceNode;
    } catch {
      if (token !== this.playbackToken) return;
      // Fallback to procedural generative ambient synthesizer when audio file is 404 or unavailable
      if (this.synth) {
        const slug = this.currentConfig?.trackId || 'starry-night';
        this.synth.start(slug);
      }
    }
  }

  private cleanupMediaElement(): void {
    if (this.deferredLoadTimer) {
      clearTimeout(this.deferredLoadTimer);
      this.deferredLoadTimer = null;
    }
    this.pendingMediaUrl = null;
    if (this.activeMediaCleanup) {
      try {
        this.activeMediaCleanup();
      } catch {}
      this.activeMediaCleanup = null;
    }
    if (this.activeMediaSourceNode) {
      try {
        this.activeMediaSourceNode.disconnect();
      } catch {}
      this.activeMediaSourceNode = null;
    }
    if (this.activeMediaElement) {
      try {
        this.activeMediaElement.pause();
        this.activeMediaElement.removeAttribute('src');
        this.activeMediaElement.load();
      } catch {}
      this.activeMediaElement = null;
    }
  }

  private stopCurrentAudio(bumpToken: boolean = true): void {
    if (bumpToken) {
      this.playbackToken++;
    }
    if (this.synth) {
      this.synth.stop();
    }
    this.cleanupMediaElement();
    if (this.activeBufferSource) {
      try {
        this.activeBufferSource.stop();
        this.activeBufferSource.disconnect();
      } catch {
        // Ignore errors if source already ended
      }
      this.activeBufferSource = null;
    }
  }

  /**
   * Sets volume with logarithmic mapping: Gain = (volume / 100)^2.2
   * @param volume Linear volume in range [0.0 - 1.0] or [0 - 100]
   */
  public setVolume(volume: number): void {
    const normalized = volume > 1.0 ? volume / 100.0 : volume;
    this.currentVolume = Math.max(0, Math.min(1.0, normalized));

    if (!this.muted && this.masterGain && this.ctx) {
      const targetGain = calculateLogarithmicGain(this.currentVolume);
      this.masterGain.gain.value = targetGain;
      try {
        // Click-free 100ms micro-fade
        this.masterGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.05);
      } catch {
        this.masterGain.gain.value = targetGain;
      }
    }
    this.onStateChange?.();
  }

  /**
   * Toggles or sets mute state with a click-free 100ms micro-fade.
   */
  public setMute(mute: boolean): void {
    this.muted = mute;

    if (this.masterGain && this.ctx) {
      const targetGain = this.muted ? 0 : calculateLogarithmicGain(this.currentVolume);
      this.masterGain.gain.value = targetGain;
      try {
        // Micro-fade using exponential time constant ~0.05s
        this.masterGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.05);
      } catch {
        this.masterGain.gain.value = targetGain;
      }
    }
    this.onStateChange?.();
  }

  public getVelocityModulatedGain(): number {
    return this.windGain?.gain?.value ?? this.currentWindGain;
  }

  public updateSpatialState(camera: any, speed: number): void {
    const clampedSpeed = Number.isFinite(speed) ? Math.max(0, speed) : 0;
    const targetWind = Math.min(1.0, 0.15 + (clampedSpeed / 7.0) * 0.55);
    this.currentWindGain = targetWind;

    if (this.windGain && this.ctx) {
      this.windGain.gain.value = targetWind;
      try {
        this.windGain.gain.setTargetAtTime(targetWind, this.ctx.currentTime, 0.05);
      } catch {
        this.windGain.gain.value = targetWind;
      }
    }

    if (this.ctx?.listener && camera?.rotation) {
      const listener = this.ctx.listener as any;
      const yaw = camera.rotation.y || 0;
      const pitch = camera.rotation.x || 0;
      const fx = -Math.sin(yaw) * Math.cos(pitch);
      const fy = Math.sin(pitch);
      const fz = -Math.cos(yaw) * Math.cos(pitch);
      try {
        if (listener.forwardX && typeof listener.forwardX.value === 'number') {
          listener.forwardX.value = fx;
          listener.forwardY.value = fy;
          listener.forwardZ.value = fz;
        } else if (typeof listener.setOrientation === 'function') {
          listener.setOrientation(fx, fy, fz, 0, 1, 0);
        }
      } catch {
        // Ignore spatial listener browser implementation differences
      }
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public getVolume(): number {
    return this.currentVolume;
  }

  public getAudioContext(): AudioContext | null {
    return this.ctx;
  }

  public getProceduralSynth(): ProceduralAmbientSynth | null {
    return this.synth;
  }

  /**
   * Extracts real-time FFT energy across low (bass), mid, and high (treble) frequency ranges.
   * Normalized to [0.0 - 1.0].
   */
  public getFFTEnergy(): { bass: number; mid: number; treble: number } {
    if (!this.analyser || !this.fftDataArray) {
      return { bass: 0, mid: 0, treble: 0 };
    }

    try {
      this.analyser.getByteFrequencyData(this.fftDataArray);

      const totalBins = this.fftDataArray.length; // 32 bins
      if (totalBins === 0) return { bass: 0, mid: 0, treble: 0 };

      // Frequency distribution across 32 bins:
      // Bass: bins 0..3 (~0 to ~250 Hz)
      // Mid: bins 4..15 (~250 to ~2500 Hz)
      // Treble: bins 16..31 (~2500 to ~16000 Hz)
      const bassEnd = Math.min(4, totalBins);
      const midEnd = Math.min(16, totalBins);

      let sumBass = 0;
      let countBass = 0;
      for (let i = 0; i < bassEnd; i++) {
        sumBass += this.fftDataArray[i];
        countBass++;
      }

      let sumMid = 0;
      let countMid = 0;
      for (let i = bassEnd; i < midEnd; i++) {
        sumMid += this.fftDataArray[i];
        countMid++;
      }

      let sumTreble = 0;
      let countTreble = 0;
      for (let i = midEnd; i < totalBins; i++) {
        sumTreble += this.fftDataArray[i];
        countTreble++;
      }

      const bass = countBass > 0 ? (sumBass / countBass) / 255 : 0;
      const mid = countMid > 0 ? (sumMid / countMid) / 255 : 0;
      const treble = countTreble > 0 ? (sumTreble / countTreble) / 255 : 0;

      return { bass, mid, treble };
    } catch {
      return { bass: 0, mid: 0, treble: 0 };
    }
  }

  /**
   * Completely tears down audio manager, synth, active nodes, and event listeners.
   */
  public dispose(): void {
    this.stopCurrentAudio();

    if (this.synth) {
      this.synth.dispose();
      this.synth = null;
    }

    // Remove gesture unlock listeners
    const target = typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null);
    if (target && typeof (target as any).removeEventListener === 'function') {
      for (const { event, handler } of this.gestureListeners) {
        (target as any).removeEventListener(event, handler);
      }
    }
    this.gestureListeners = [];

    // Remove visibilitychange listener
    if (typeof document !== 'undefined' && this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }

    // Disconnect audio nodes
    if (this.analyser) {
      try {
        this.analyser.disconnect();
      } catch {}
      this.analyser = null;
    }

    if (this.masterGain) {
      try {
        this.masterGain.disconnect();
      } catch {}
      this.masterGain = null;
    }

    if (this.windGain) {
      try {
        this.windGain.disconnect();
      } catch {}
      this.windGain = null;
    }

    if (this.sourceGain) {
      try {
        this.sourceGain.disconnect();
      } catch {}
      this.sourceGain = null;
    }

    // Close AudioContext if open
    if (this.ctx && typeof this.ctx.close === 'function') {
      try {
        this.ctx.close().catch(() => {});
      } catch {}
    }
    this.ctx = null;
  }
}

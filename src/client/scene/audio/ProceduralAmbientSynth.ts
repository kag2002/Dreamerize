import { MusicGenre, MusicTrackId, MusicTrackMeta } from '../../../shared/types/space';

export type { MusicGenre, MusicTrackId, MusicTrackMeta };

export const MUSIC_TRACK_CATALOG: readonly MusicTrackMeta[] = [
  {
    id: 'auto',
    genre: 'auto',
    genreLabel: 'Tự động',
    title: 'Tự động theo không gian (Mặc định)',
    subtitle: 'Hòa âm & nhạc cụ phù hợp từng thế giới 3D',
    instruments: ['Auto Ensemble']
  },
  {
    id: 'jazz-midnight-cafe',
    genre: 'jazz',
    genreLabel: 'Jazz',
    title: 'Midnight Café Jazz Trio',
    subtitle: 'Piano 9th • Walking Upright Bass • Brushed Drums • Mellow Tenor Sax (74 BPM swing)',
    bpm: 74,
    instruments: ['Felt Piano', 'Walking Bass', 'Brushed Drums', 'Tenor Sax']
  },
  {
    id: 'jazz-velvet-swing',
    genre: 'jazz',
    genreLabel: 'Jazz',
    title: 'Velvet Rain Quartet',
    subtitle: 'Karplus-Strong Nylon Jazz Guitar • Muted Flugelhorn • Warm Piano • Walking Bass',
    bpm: 72,
    instruments: ['Nylon Jazz Guitar', 'Muted Flugelhorn', 'Warm Piano', 'Walking Bass', 'Brushed Drums']
  },
  {
    id: 'classical-clair-nocturne',
    genre: 'classical',
    genreLabel: 'Cổ điển',
    title: 'Clair de Rêve (Nocturne)',
    subtitle: 'Concert Grand Piano arpeggios • Karplus-Strong Concert Harp • Bowed Cello',
    bpm: 64,
    instruments: ['Concert Grand Piano', 'Concert Harp', 'Bowed Cello']
  },
  {
    id: 'classical-pastoral-adagio',
    genre: 'classical',
    genreLabel: 'Cổ điển',
    title: 'Pastoral Symphony Adagio',
    subtitle: 'Breathy Concert Flute • French Horn cantabile • Cello sustain • Classical Harp',
    bpm: 60,
    instruments: ['Concert Flute', 'French Horn', 'Bowed Cello', 'Classical Harp']
  },
  {
    id: 'chamber-salon-provence',
    genre: 'chamber',
    genreLabel: 'Thính phòng',
    title: 'Salon de Provence Quartet',
    subtitle: 'Classical Guitar • Bowed Cello • Chamber Piano • Lyrical Flute',
    bpm: 70,
    instruments: ['Classical Guitar', 'Bowed Cello', 'Chamber Piano', 'Lyrical Flute']
  },
  {
    id: 'chamber-sanctuary-vespers',
    genre: 'chamber',
    genreLabel: 'Thính phòng',
    title: 'Sanctuary Vespers',
    subtitle: 'Concert Harp • French Horn • Bowed Cello • Celestial Pad',
    bpm: 58,
    instruments: ['Concert Harp', 'French Horn', 'Bowed Cello', 'Celestial Pad']
  },
  {
    id: 'acoustic-coastal-waltz',
    genre: 'acoustic',
    genreLabel: 'Acoustic Chill',
    title: 'Coastal 3/4 Waltz',
    subtitle: 'Karplus-Strong Acoustic Guitar • Felt Piano • Flugelhorn • Bowed Cello',
    bpm: 104,
    instruments: ['Acoustic Guitar', 'Felt Piano', 'Flugelhorn', 'Bowed Cello']
  },
  {
    id: 'zen-forest-flute',
    genre: 'acoustic',
    genreLabel: 'Acoustic Chill',
    title: 'Zen Forest Meditation',
    subtitle: 'Fingerpicked Acoustic Guitar • Bamboo Flute • Cello • Soft Chimes',
    bpm: 62,
    instruments: ['Acoustic Guitar', 'Bamboo Flute', 'Bowed Cello', 'Soft Chimes']
  },
  {
    id: 'vietnam-lotus-serenade',
    genre: 'acoustic',
    genreLabel: 'Acoustic Chill',
    title: 'Hồn Việt Ngũ Cung (Đàn Tranh & Sáo Trúc)',
    subtitle: 'Karplus-Strong Đàn Tranh • Sáo Trúc Ngũ Cung • Felt Piano • Bowed Cello (66 BPM)',
    bpm: 66,
    instruments: ['Đàn Tranh', 'Sáo Trúc', 'Felt Piano', 'Bowed Cello']
  }
] as const;

type AudioScope = 'music' | 'nature';
type KarplusTimbre = 'nylon_guitar' | 'steel_guitar' | 'jazz_guitar' | 'concert_harp' | 'dan_tranh';

interface TrackableNode {
  stop?: () => void;
  disconnect: () => void;
}

/**
 * Pure Web Audio procedural generative study music + natural soundscape synthesizer.
 * Features:
 * - Karplus-Strong plucked string physical-modeling AudioBuffer synthesis (acoustic/classical/jazz guitar & concert harp)
 * - Expressive additive Concert Grand Piano & warm Felt Piano
 * - Jazz walking upright bass & filtered pink-noise brushed snare / swing ride drums
 * - Structured 8-bar melodic phrases for Tenor Sax, Flugelhorn, French Horn, Flute & Bowed Cello
 * - Independent `musicBus` (user-selectable Jazz / Classical / Chamber / Acoustic Chill or 'auto')
 *   and `natureBus` (driven cleanly by active `spaceSlug`) for click-free live track switching.
 */
export class ProceduralAmbientSynth {
  public static readonly MUSIC_TRACK_CATALOG = MUSIC_TRACK_CATALOG;

  private readonly ctx: AudioContext;
  private readonly outputNode: AudioNode;

  private isRunning: boolean = false;
  private activeSlug: string | null = null;
  private selectedTrackId: MusicTrackId = 'auto';

  private musicBus: GainNode | null = null;
  private natureBus: GainNode | null = null;
  private reverbNode: ConvolverNode | null = null;
  private musicLevel: number = 0.95;
  private natureLevel: number = 0.58;

  // Separate node & timer tracking so music tracks can switch live without interrupting nature ambience
  private sharedNodes: TrackableNode[] = [];
  private musicNodes: TrackableNode[] = [];
  private musicTimeouts: any[] = [];
  private natureNodes: TrackableNode[] = [];
  private natureTimeouts: any[] = [];
  private karplusCache = new Map<string, AudioBuffer>();

  constructor(ctx: AudioContext, outputNode: AudioNode) {
    this.ctx = ctx;
    this.outputNode = outputNode;
  }

  public get activeSpace(): string | null {
    return this.activeSlug;
  }

  public get playing(): boolean {
    return this.isRunning;
  }

  public getMusicTrack(): MusicTrackId {
    return this.selectedTrackId;
  }

  public setMusicTrack(trackId: MusicTrackId): void {
    const valid = MUSIC_TRACK_CATALOG.some((t) => t.id === trackId);
    const resolved: MusicTrackId = valid ? trackId : 'auto';
    this.selectedTrackId = resolved;

    if (!this.isRunning) return;
    if (!this.ctx || typeof this.ctx.createGain !== 'function' || !this.musicBus) return;

    this.stopMusicLayer();
    this.buildMusicForSelection(this.selectedTrackId, this.activeSlug || 'starry-night', this.musicBus, this.reverbNode);
  }

  public setMixBalance(musicLevel: number, natureLevel: number): void {
    this.musicLevel = Math.max(0, Math.min(1.5, musicLevel));
    this.natureLevel = Math.max(0, Math.min(1.5, natureLevel));
    if (!this.ctx) return;
    const now = this.ctx.currentTime ?? 0;
    if (this.musicBus?.gain) {
      try {
        this.musicBus.gain.setTargetAtTime(this.musicLevel, now, 0.08);
      } catch {
        this.musicBus.gain.value = this.musicLevel;
      }
    }
    if (this.natureBus?.gain) {
      try {
        this.natureBus.gain.setTargetAtTime(this.natureLevel, now, 0.08);
      } catch {
        this.natureBus.gain.value = this.natureLevel;
      }
    }
  }

  public getMixBalance(): { musicLevel: number; natureLevel: number } {
    return { musicLevel: this.musicLevel, natureLevel: this.natureLevel };
  }

  private pushNode(scope: AudioScope | 'shared', ...nodes: TrackableNode[]): void {
    const target =
      scope === 'shared' ? this.sharedNodes : scope === 'nature' ? this.natureNodes : this.musicNodes;
    for (const n of nodes) {
      if (n) target.push(n);
    }
  }

  private scheduleScopedTimeout(scope: AudioScope, fn: () => void, delayMs: number): void {
    if (!this.isRunning) return;
    const timerId = setTimeout(fn, delayMs);
    if (scope === 'nature') {
      this.natureTimeouts.push(timerId);
    } else {
      this.musicTimeouts.push(timerId);
    }
  }

  /**
   * Starts procedural ambient generation for the specified space.
   */
  public start(spaceSlug: string): void {
    this.stop();

    if (!this.ctx || typeof this.ctx.createGain !== 'function') {
      this.isRunning = true;
      this.activeSlug = spaceSlug;
      return;
    }

    this.isRunning = true;
    this.activeSlug = spaceSlug;

    const synthMasterGain = this.ctx.createGain();
    synthMasterGain.gain.setValueAtTime(0.95, this.ctx.currentTime);

    let masterOutput: AudioNode = this.outputNode;
    if (typeof this.ctx.createDynamicsCompressor === 'function') {
      const compressor = this.ctx.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-16, this.ctx.currentTime);
      compressor.knee.setValueAtTime(12, this.ctx.currentTime);
      compressor.ratio.setValueAtTime(4, this.ctx.currentTime);
      compressor.attack.setValueAtTime(0.008, this.ctx.currentTime);
      compressor.release.setValueAtTime(0.18, this.ctx.currentTime);

      const makeupGain = this.ctx.createGain();
      makeupGain.gain.setValueAtTime(1.85, this.ctx.currentTime);
      compressor.connect(makeupGain);
      makeupGain.connect(this.outputNode);
      this.pushNode('shared', compressor, makeupGain);
      masterOutput = compressor;
    }

    synthMasterGain.connect(masterOutput);
    this.pushNode('shared', synthMasterGain);

    this.musicBus = this.ctx.createGain();
    this.musicBus.gain.setValueAtTime(this.musicLevel, this.ctx.currentTime);
    this.musicBus.connect(synthMasterGain);
    this.pushNode('shared', this.musicBus);

    this.natureBus = this.ctx.createGain();
    this.natureBus.gain.setValueAtTime(this.natureLevel, this.ctx.currentTime);
    this.natureBus.connect(synthMasterGain);
    this.pushNode('shared', this.natureBus);

    this.reverbNode = this.createHallReverb(this.musicBus, 2.8, 0.36);
    const natureReverb = this.createHallReverb(this.natureBus, 2.2, 0.24);

    this.buildNatureForSpace(spaceSlug, this.natureBus, natureReverb);
    this.buildMusicForSelection(this.selectedTrackId, spaceSlug, this.musicBus, this.reverbNode);
  }

  private buildNatureForSpace(
    spaceSlug: string,
    natureDest: AudioNode,
    reverbNode: ConvolverNode | null
  ): void {
    const slug = (spaceSlug || '').toLowerCase();
    if (
      slug.includes('3dgs') ||
      slug.includes('custom_asset') ||
      slug.includes('custom-asset') ||
      slug.includes('splat') ||
      slug.includes('glb')
    ) {
      this.createOceanWavesLayer(natureDest, reverbNode, 0.10);
      this.createSweepingWindLayer(natureDest, 'lowpass', 580, 260, 0.95, 0.06, 0.14, 'nature');
      this.scheduleRealisticBirdsong(natureDest, reverbNode, 'meadow');
    } else if (slug.includes('vietnam')) {
      this.createOceanWavesLayer(natureDest, reverbNode, 0.11);
      this.createSweepingWindLayer(natureDest, 'lowpass', 600, 260, 0.95, 0.055, 0.12, 'nature');
      this.scheduleRealisticBirdsong(natureDest, reverbNode, 'meadow');
    } else if (slug.includes('cosmic') || slug.includes('blackhole')) {
      this.createSweepingWindLayer(natureDest, 'bandpass', 580, 340, 2.2, 0.045, 0.16, 'nature');
    } else if (slug.includes('forest') || slug.includes('mountain')) {
      this.createSweepingWindLayer(natureDest, 'lowpass', 540, 280, 1.0, 0.07, 0.16, 'nature');
      this.createBabblingBrookLayer(natureDest, reverbNode, 0.16);
      this.scheduleRealisticBirdsong(natureDest, reverbNode, 'forest');
    } else if (slug.includes('paradise') || slug.includes('sanctuary') || slug.includes('heaven')) {
      this.createSweepingWindLayer(natureDest, 'bandpass', 720, 320, 1.3, 0.04, 0.14, 'nature');
      this.createSweepingWindLayer(natureDest, 'lowpass', 480, 200, 0.85, 0.055, 0.12, 'nature');
    } else if (slug.includes('ghibli') || slug.includes('valley')) {
      this.createOceanWavesLayer(natureDest, reverbNode, 0.15);
      this.createSweepingWindLayer(natureDest, 'lowpass', 620, 300, 1.0, 0.065, 0.14, 'nature');
      this.scheduleRealisticBirdsong(natureDest, reverbNode, 'meadow');
    } else if (slug.includes('starry-night') || slug === 'space-1') {
      this.createSweepingWindLayer(natureDest, 'bandpass', 950, 480, 1.4, 0.055, 0.14, 'nature');
      this.scheduleNightCrickets(natureDest, reverbNode);
    } else {
      this.createSweepingWindLayer(natureDest, 'lowpass', 650, 380, 1.1, 0.08, 0.22, 'nature');
      this.createSweepingWindLayer(natureDest, 'bandpass', 1400, 550, 0.9, 0.13, 0.09, 'nature');
      this.createBabblingBrookLayer(natureDest, reverbNode, 0.09);
      this.scheduleRealisticBirdsong(natureDest, reverbNode, 'meadow');
    }
  }

  private buildMusicForSelection(
    trackId: MusicTrackId,
    spaceSlug: string,
    musicDest: AudioNode,
    reverbNode: ConvolverNode | null
  ): void {
    switch (trackId) {
      case 'jazz-midnight-cafe':
        this.buildJazzMidnightCafeMusic(musicDest, reverbNode);
        return;
      case 'jazz-velvet-swing':
        this.buildJazzVelvetSwingMusic(musicDest, reverbNode);
        return;
      case 'classical-clair-nocturne':
        this.buildClassicalClairNocturneMusic(musicDest, reverbNode);
        return;
      case 'classical-pastoral-adagio':
        this.buildClassicalPastoralAdagioMusic(musicDest, reverbNode);
        return;
      case 'chamber-salon-provence':
        this.buildChamberSalonProvenceMusic(musicDest, reverbNode);
        return;
      case 'chamber-sanctuary-vespers':
        this.buildChamberSanctuaryVespersMusic(musicDest, reverbNode);
        return;
      case 'acoustic-coastal-waltz':
        this.buildAcousticCoastalWaltzMusic(musicDest, reverbNode);
        return;
      case 'zen-forest-flute':
        this.buildZenForestFluteMusic(musicDest, reverbNode);
        return;
      case 'vietnam-lotus-serenade':
        this.buildVietnamLotusSerenadeMusic(musicDest, reverbNode);
        return;
      case 'auto':
      default:
        this.buildAutoSpaceMusic(spaceSlug, musicDest, reverbNode);
    }
  }

  private buildAutoSpaceMusic(
    spaceSlug: string,
    musicDest: AudioNode,
    reverbNode: ConvolverNode | null
  ): void {
    const slug = (spaceSlug || '').toLowerCase();
    if (
      slug.includes('3dgs') ||
      slug.includes('custom_asset') ||
      slug.includes('custom-asset') ||
      slug.includes('splat') ||
      slug.includes('glb')
    ) {
      this.buildCustomAssetMusic(musicDest, reverbNode);
    } else if (slug.includes('vietnam')) {
      this.buildVietnamLotusSerenadeMusic(musicDest, reverbNode);
    } else if (slug.includes('cosmic') || slug.includes('blackhole')) {
      this.buildCosmicBlackHoleMusic(musicDest, reverbNode);
    } else if (slug.includes('forest') || slug.includes('mountain')) {
      this.buildZenForestFluteMusic(musicDest, reverbNode);
    } else if (slug.includes('paradise') || slug.includes('sanctuary') || slug.includes('heaven')) {
      this.buildChamberSanctuaryVespersMusic(musicDest, reverbNode);
    } else if (slug.includes('ghibli') || slug.includes('valley')) {
      this.buildAcousticCoastalWaltzMusic(musicDest, reverbNode);
    } else if (slug.includes('starry-night') || slug === 'space-1') {
      this.buildStarryNightMusic(musicDest, reverbNode);
    } else {
      this.buildBreezyMeadowMusic(musicDest, reverbNode);
    }
  }

  // =========================================================================
  // Reverb, Noise & Physical-Modeling Karplus-Strong Plucked String Generators
  // =========================================================================

  private createHallReverb(destination: AudioNode, irDuration = 3.0, wetLevel = 0.42): ConvolverNode | null {
    if (typeof this.ctx.createConvolver !== 'function' || typeof this.ctx.createBuffer !== 'function') {
      return null;
    }

    try {
      const reverbNode = this.ctx.createConvolver();
      const irSampleRate = this.ctx.sampleRate || 44100;
      const irLength = Math.floor(irDuration * irSampleRate);
      const irBuffer = this.ctx.createBuffer(2, irLength, irSampleRate);

      for (let channel = 0; channel < 2; channel++) {
        const channelData = irBuffer.getChannelData(channel);
        let lp = 0;
        for (let i = 0; i < irLength; i++) {
          const t = i / irLength;
          const white = (Math.random() * 2 - 1) * Math.exp(-3.2 * t);
          lp = lp * 0.65 + white * 0.35;
          channelData[i] = lp;
        }
      }

      reverbNode.buffer = irBuffer;
      const reverbWetGain = this.ctx.createGain();
      reverbWetGain.gain.setValueAtTime(wetLevel, this.ctx.currentTime);
      reverbNode.connect(reverbWetGain);
      reverbWetGain.connect(destination);

      this.pushNode('shared', reverbNode, reverbWetGain);
      return reverbNode;
    } catch {
      return null;
    }
  }

  private createPinkNoiseBuffer(durationSec = 4.0, gainScale = 0.08): AudioBuffer | null {
    if (typeof this.ctx.createBuffer !== 'function') return null;
    try {
      const sampleRate = this.ctx.sampleRate || 44100;
      const bufferLength = Math.max(1, Math.floor(durationSec * sampleRate));
      const noiseBuffer = this.ctx.createBuffer(2, bufferLength, sampleRate);
      if (!noiseBuffer || typeof noiseBuffer.getChannelData !== 'function') return null;

      for (let channel = 0; channel < 2; channel++) {
        const data = noiseBuffer.getChannelData(channel);
        if (!data) continue;
        let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
        for (let i = 0; i < bufferLength; i++) {
          const white = Math.random() * 2 - 1;
          b0 = 0.99886 * b0 + white * 0.0555179;
          b1 = 0.99332 * b1 + white * 0.0750759;
          b2 = 0.96900 * b2 + white * 0.1538520;
          b3 = 0.86650 * b3 + white * 0.3104856;
          b4 = 0.55000 * b4 + white * 0.5329522;
          b5 = -0.7616 * b5 - white * 0.0168980;
          data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * gainScale;
          b6 = white * 0.115926;
        }
      }
      return noiseBuffer;
    } catch {
      return null;
    }
  }

  /**
   * Karplus-Strong physical-modeling plucked string waveguide AudioBuffer generator.
   * Seeds a tuned delay-line ring buffer with damped noise and runs an iterative lowpass string decay loop.
   * Safely returns null when `createBuffer` is missing or mocked without channel buffers.
   */
  private createKarplusStrongBuffer(
    freq: number,
    durationSec: number,
    timbre: KarplusTimbre
  ): AudioBuffer | null {
    if (!this.ctx || typeof this.ctx.createBuffer !== 'function') return null;
    const safeFreq = Math.max(55, Math.min(2400, freq));
    const cacheKey = `${timbre}:${safeFreq.toFixed(1)}:${durationSec.toFixed(1)}`;
    const cached = this.karplusCache.get(cacheKey);
    if (cached) return cached;

    try {
      const sampleRate = this.ctx.sampleRate || 44100;
      const totalSamples = Math.max(128, Math.floor(durationSec * sampleRate));
      const buffer = this.ctx.createBuffer(1, totalSamples, sampleRate);
      if (!buffer || typeof buffer.getChannelData !== 'function') return null;

      const out = buffer.getChannelData(0);
      if (!out || out.length === 0) return null;

      const period = Math.max(4, Math.round(sampleRate / safeFreq));
      const ring = new Float32Array(period);

      // Seed delay line with finger/pick excitation noise
      let prev = 0;
      const smoothPasses = timbre === 'jazz_guitar' ? 3 : timbre === 'nylon_guitar' ? 2 : 1;
      for (let i = 0; i < period; i++) {
        const phase = i / period;
        const triangleShape = 1 - Math.abs(2 * phase - 1);
        const noise = Math.random() * 2 - 1;
        ring[i] =
          timbre === 'concert_harp'
            ? noise * 0.45 + (triangleShape * 2 - 1) * 0.55
            : timbre === 'dan_tranh'
              ? noise * 0.62 + (triangleShape * 2 - 1) * 0.38
              : noise;
      }

      for (let p = 0; p < smoothPasses; p++) {
        prev = ring[period - 1];
        for (let i = 0; i < period; i++) {
          const cur = ring[i];
          ring[i] = 0.5 * (cur + prev);
          prev = cur;
        }
      }

      // Remove DC bias from seed burst so low strings remain clean
      let mean = 0;
      for (let i = 0; i < period; i++) mean += ring[i];
      mean /= period;
      for (let i = 0; i < period; i++) ring[i] -= mean;

      const blend =
        timbre === 'jazz_guitar'
          ? 0.34
          : timbre === 'nylon_guitar'
            ? 0.42
            : timbre === 'concert_harp'
              ? 0.46
              : timbre === 'dan_tranh'
                ? 0.48
                : 0.49;

      // Natural frequency-dependent waveguide damping
      const baseDecay =
        timbre === 'concert_harp'
          ? 0.9974
          : timbre === 'dan_tranh'
            ? 0.9972
            : timbre === 'steel_guitar'
              ? 0.9964
              : 0.9958;
      const decay = Math.max(0.986, Math.min(0.9982, baseDecay - (safeFreq - 120) * 0.0000038));

      const attackSamples = Math.min(Math.floor(sampleRate * 0.004), Math.floor(totalSamples * 0.05));
      const releaseSamples = Math.min(Math.floor(sampleRate * 0.03), Math.floor(totalSamples * 0.1));

      let idx = 0;
      let peak = 0;
      for (let i = 0; i < totalSamples; i++) {
        const nextIdx = (idx + 1) % period;
        const sample = decay * ((1 - blend) * ring[idx] + blend * ring[nextIdx]);
        ring[idx] = sample;
        idx = nextIdx;

        let env = 1.0;
        if (i < attackSamples) {
          env = i / Math.max(1, attackSamples);
        } else if (i > totalSamples - releaseSamples) {
          env = Math.max(0, (totalSamples - i) / Math.max(1, releaseSamples));
        }
        const val = sample * env;
        out[i] = val;
        const absVal = Math.abs(val);
        if (absVal > peak) peak = absVal;
      }

      if (peak > 1e-5) {
        const norm = 0.92 / peak;
        for (let i = 0; i < totalSamples; i++) {
          out[i] *= norm;
        }
      }

      this.karplusCache.set(cacheKey, buffer);
      return buffer;
    } catch {
      return null;
    }
  }

  private playKarplusPluck(
    freq: number,
    strikeTime: number,
    peakGain: number,
    durationSec: number,
    timbre: KarplusTimbre,
    bodyFilter: AudioNode,
    scope: AudioScope = 'music'
  ): boolean {
    if (typeof this.ctx.createBufferSource !== 'function') return false;
    const buffer = this.createKarplusStrongBuffer(freq, durationSec, timbre);
    if (!buffer) return false;

    try {
      const src = this.ctx.createBufferSource();
      src.buffer = buffer;

      const env = this.ctx.createGain();
      env.gain.setValueAtTime(peakGain, strikeTime);

      src.connect(env);
      env.connect(bodyFilter);
      src.start(strikeTime);
      src.stop(strikeTime + durationSec + 0.02);

      this.pushNode(scope, src, env);
      return true;
    } catch {
      return false;
    }
  }

  // =========================================================================
  // Curated Genre & Space Compositions (Structured 8-Bar Phrases)
  // =========================================================================

  /**
   * Auto Default for Space 1: "The Starry Night"
   */
  private buildStarryNightMusic(musicDest: AudioNode, reverbNode: ConvolverNode | null): void {
    this.buildWarmSubDrone(musicDest, [73.42, 110.0, 36.71], 0.26, 360);
    this.scheduleWarmCelloSustain(
      musicDest,
      reverbNode,
      [73.42, 58.27, 49.0, 55.0, 73.42, 65.41, 49.0, 55.0],
      6400,
      0.19
    );

    const starryChords = [
      [146.83, 220.0, 261.63, 329.63], // Dm9
      [116.54, 174.61, 220.0, 293.66], // Bbmaj7
      [98.0, 174.61, 220.0, 293.66],   // Gm9
      [110.0, 164.81, 220.0, 293.66],  // A7sus4
      [146.83, 220.0, 261.63, 349.23], // Dm7
      [130.81, 196.0, 246.94, 329.63], // Cmaj7
      [98.0, 174.61, 233.08, 293.66],  // Gm9
      [110.0, 164.81, 207.65, 293.66]  // A7sus4->A7
    ];
    this.scheduleFeltPianoProgression(musicDest, reverbNode, starryChords, 6400, 0.26);

    this.scheduleAcousticGuitarFingerpicking(
      musicDest,
      reverbNode,
      [
        [146.83, 220.0, 293.66, 349.23, 440.0, 329.63],
        [116.54, 174.61, 233.08, 293.66, 440.0, 349.23],
        [196.0, 233.08, 293.66, 392.0, 440.0, 349.23],
        [110.0, 164.81, 220.0, 293.66, 329.63, 440.0],
        [146.83, 220.0, 261.63, 349.23, 440.0, 392.0],
        [130.81, 196.0, 261.63, 329.63, 392.0, 329.63],
        [196.0, 233.08, 293.66, 349.23, 440.0, 349.23],
        [110.0, 164.81, 220.0, 277.18, 329.63, 440.0]
      ],
      400,
      0.20,
      'nylon_guitar'
    );

    this.scheduleMellowHornOrSaxPhrases(
      musicDest,
      reverbNode,
      [
        [293.66, 349.23, 440.0, 392.0, 329.63],
        [440.0, 523.25, 440.0, 349.23, 293.66],
        [261.63, 293.66, 349.23, 329.63, 293.66],
        [349.23, 392.0, 440.0, 587.33, 523.25],
        [440.0, 392.0, 349.23, 329.63, 293.66],
        [233.08, 293.66, 349.23, 392.0, 349.23],
        [329.63, 293.66, 261.63, 220.0, 293.66],
        [277.18, 329.63, 392.0, 349.23, 293.66]
      ],
      6400,
      0.17,
      'saxophone'
    );

    this.scheduleMelodyNotes(musicDest, reverbNode, [587.33, 698.46, 783.99, 880.0, 1046.5], 2800, 5200, 0.14, 'sine');
  }

  /**
   * Auto Default for Space 2: "Breezy Meadow"
   */
  private buildBreezyMeadowMusic(musicDest: AudioNode, reverbNode: ConvolverNode | null): void {
    this.scheduleFeltPianoProgression(
      musicDest,
      reverbNode,
      [
        [174.61, 220.0, 261.63, 329.63, 392.0], // Fmaj9
        [196.0, 246.94, 293.66, 329.63],        // G6
        [164.81, 196.0, 246.94, 293.66],        // Em7
        [110.0, 196.0, 246.94, 261.63, 329.63], // Am9
        [174.61, 220.0, 261.63, 329.63, 392.0], // Fmaj9
        [196.0, 246.94, 293.66, 392.0],         // G
        [146.83, 220.0, 261.63, 329.63],        // Dm9
        [196.0, 261.63, 293.66, 329.63]         // G6sus4
      ],
      5600,
      0.27
    );

    this.scheduleAcousticGuitarFingerpicking(
      musicDest,
      reverbNode,
      [
        [174.61, 261.63, 349.23, 440.0, 329.63, 392.0],
        [196.0, 293.66, 392.0, 493.88, 329.63, 392.0],
        [164.81, 246.94, 329.63, 392.0, 293.66, 329.63],
        [110.0, 220.0, 261.63, 329.63, 392.0, 329.63]
      ],
      350,
      0.21,
      'steel_guitar'
    );

    this.scheduleWoodwindFlutePhrases(
      musicDest,
      reverbNode,
      [
        [523.25, 587.33, 659.25, 783.99, 659.25],
        [880.0, 783.99, 659.25, 587.33, 523.25],
        [392.0, 440.0, 523.25, 659.25, 587.33],
        [659.25, 783.99, 880.0, 783.99, 659.25]
      ],
      6200,
      0.17
    );
    this.scheduleMellowHornOrSaxPhrases(
      musicDest,
      reverbNode,
      [
        [261.63, 293.66, 329.63, 392.0],
        [329.63, 293.66, 261.63, 220.0]
      ],
      11200,
      0.14,
      'french_horn'
    );
    this.scheduleMelodyNotes(musicDest, reverbNode, [523.25, 587.33, 659.25, 783.99, 880.0], 2600, 4800, 0.13, 'triangle');
  }

  /**
   * Auto Default for Space 3: "Cosmic Black Hole & Sun"
   */
  private buildCosmicBlackHoleMusic(musicDest: AudioNode, reverbNode: ConvolverNode | null): void {
    this.buildWarmSubDrone(musicDest, [65.41, 98.0, 32.7], 0.30, 320);
    this.scheduleWarmCelloSustain(musicDest, reverbNode, [65.41, 49.0, 55.0, 43.65], 6400, 0.20);

    this.scheduleFeltPianoProgression(
      musicDest,
      reverbNode,
      [
        [130.81, 196.0, 261.63, 293.66, 329.63],
        [98.0, 196.0, 246.94, 261.63, 293.66],
        [110.0, 164.81, 196.0, 261.63, 293.66],
        [87.31, 174.61, 220.0, 261.63, 329.63]
      ],
      6400,
      0.26
    );

    this.scheduleAcousticGuitarFingerpicking(
      musicDest,
      reverbNode,
      [
        [261.63, 392.0, 587.33, 659.25, 493.88, 392.0],
        [196.0, 293.66, 523.25, 587.33, 493.88, 392.0],
        [220.0, 329.63, 523.25, 587.33, 392.0, 329.63],
        [174.61, 261.63, 440.0, 523.25, 659.25, 440.0]
      ],
      533,
      0.19,
      'steel_guitar'
    );

    this.scheduleMellowHornOrSaxPhrases(
      musicDest,
      reverbNode,
      [
        [261.63, 392.0, 329.63, 293.66],
        [220.0, 329.63, 293.66, 261.63, 196.0]
      ],
      8200,
      0.18,
      'french_horn'
    );

    this.scheduleMelodyNotes(musicDest, reverbNode, [523.25, 659.25, 783.99, 987.77, 1174.66], 2200, 4400, 0.14, 'sine');
  }

  private buildCustomAssetMusic(musicDest: AudioNode, reverbNode: ConvolverNode | null): void {
    this.scheduleFeltPianoProgression(
      musicDest,
      reverbNode,
      [
        [130.81, 196.0, 246.94, 293.66, 329.63],
        [110.0, 196.0, 246.94, 261.63, 329.63],
        [87.31, 174.61, 220.0, 261.63, 329.63],
        [98.0, 196.0, 246.94, 293.66, 329.63]
      ],
      6200,
      0.28
    );
    this.scheduleMelodyNotes(musicDest, reverbNode, [523.25, 587.33, 659.25, 783.99, 880.0], 2300, 4400, 0.14, 'triangle');
  }

  /**
   * Jazz 1: Midnight Café Jazz Trio (74 BPM swing)
   * Piano 9th chords, upright walking bass, brushed ride/snare rhythm, lyrical Mellow Tenor Sax 8-bar solo phrases.
   */
  private buildJazzMidnightCafeMusic(musicDest: AudioNode, reverbNode: ConvolverNode | null): void {
    const beatMs = Math.round(60000 / 74); // ~811ms
    const barMs = beatMs * 4;              // ~3244ms

    // 8-bar ii-V-I-VI nocturnal jazz ballad in C minor/major colors
    const jazzChords = [
      [146.83, 220.0, 261.63, 329.63, 349.23], // Dm9
      [98.0, 185.0, 246.94, 293.66, 329.63],   // G13
      [130.81, 196.0, 246.94, 293.66, 329.63], // Cmaj9
      [110.0, 196.0, 261.63, 311.13, 349.23],  // A7#9/b13
      [146.83, 220.0, 261.63, 329.63, 349.23], // Dm9
      [98.0, 174.61, 246.94, 293.66, 329.63],  // G13
      [164.81, 246.94, 293.66, 392.0],         // Em7
      [110.0, 174.61, 207.65, 261.63, 349.23]  // A7alt
    ];
    this.scheduleFeltPianoProgression(musicDest, reverbNode, jazzChords, barMs, 0.25);

    // 8 bars of 4-beat upright walking bass
    const walkingBars = [
      [73.42, 87.31, 110.0, 103.83],  // Dm: D2 - F2 - A2 - Ab2
      [98.0, 123.47, 146.83, 138.59], // G13: G2 - B2 - D3 - Db3
      [65.41, 82.41, 98.0, 123.47],   // Cmaj9: C2 - E2 - G2 - B2
      [110.0, 103.83, 98.0, 82.41],   // A7: A2 - Ab2 - G2 - E2
      [73.42, 82.41, 87.31, 92.5],    // Dm: D2 - E2 - F2 - F#2
      [98.0, 110.0, 123.47, 116.54],  // G13: G2 - A2 - B2 - Bb2
      [82.41, 98.0, 123.47, 116.54],  // Em7: E2 - G2 - B2 - Bb2
      [110.0, 87.31, 82.41, 77.78]    // A7alt: A2 - F2 - E2 - Eb2
    ];
    this.scheduleJazzWalkingBass(musicDest, reverbNode, walkingBars, beatMs, 0.34);

    // Brushed snare & swing ride cymbal
    this.scheduleJazzBrushedDrums(musicDest, reverbNode, beatMs, 0.14);

    // Structured 8-bar lyrical Mellow Tenor Sax solo phrases
    this.scheduleMellowHornOrSaxPhrases(
      musicDest,
      reverbNode,
      [
        [349.23, 392.0, 440.0, 523.25, 493.88],
        [440.0, 392.0, 329.63, 293.66],
        [329.63, 392.0, 493.88, 440.0, 392.0],
        [349.23, 329.63, 293.66, 261.63],
        [293.66, 349.23, 440.0, 523.25, 587.33],
        [523.25, 493.88, 440.0, 392.0],
        [392.0, 493.88, 440.0, 329.63],
        [349.23, 329.63, 277.18, 293.66]
      ],
      barMs * 2,
      0.19,
      'saxophone'
    );
  }

  /**
   * Jazz 2: Velvet Rain Quartet (72 BPM swing)
   * Karplus-Strong Nylon Jazz Guitar comping, Muted Flugelhorn ballad, warm piano, walking upright bass, brushed drums.
   */
  private buildJazzVelvetSwingMusic(musicDest: AudioNode, reverbNode: ConvolverNode | null): void {
    const beatMs = Math.round(60000 / 72); // ~833ms
    const barMs = beatMs * 4;              // ~3332ms

    const velvetChords = [
      [174.61, 220.0, 261.63, 329.63, 392.0], // Fmaj9
      [146.83, 185.0, 261.63, 311.13],        // D7#9
      [196.0, 233.08, 293.66, 349.23, 440.0], // Gm9
      [130.81, 233.08, 293.66, 329.63, 440.0],// C13
      [110.0, 196.0, 261.63, 329.63],         // Am7
      [146.83, 185.0, 261.63, 311.13],        // D7b9
      [196.0, 233.08, 293.66, 349.23],        // Gm7
      [130.81, 233.08, 293.66, 349.23]        // C9sus4
    ];
    this.scheduleFeltPianoProgression(musicDest, reverbNode, velvetChords, barMs, 0.24);

    this.scheduleAcousticGuitarFingerpicking(
      musicDest,
      reverbNode,
      [
        [174.61, 261.63, 329.63, 440.0, 392.0, 329.63],
        [146.83, 261.63, 311.13, 370.0, 311.13, 261.63],
        [196.0, 293.66, 349.23, 440.0, 349.23, 293.66],
        [130.81, 233.08, 293.66, 440.0, 329.63, 293.66],
        [220.0, 261.63, 329.63, 392.0, 329.63, 261.63],
        [146.83, 246.94, 311.13, 370.0, 311.13, 246.94],
        [196.0, 233.08, 293.66, 349.23, 293.66, 233.08],
        [130.81, 233.08, 293.66, 349.23, 293.66, 233.08]
      ],
      Math.round(beatMs * 0.66),
      0.22,
      'jazz_guitar'
    );

    const walkingBars = [
      [87.31, 110.0, 130.81, 123.47], // Fmaj9
      [73.42, 92.5, 110.0, 103.83],   // D7
      [98.0, 116.54, 146.83, 138.59], // Gm9
      [65.41, 82.41, 98.0, 103.83],   // C13
      [110.0, 130.81, 164.81, 155.56],// Am7
      [73.42, 87.31, 92.5, 98.0],     // D7b9
      [98.0, 116.54, 130.81, 138.59], // Gm7
      [65.41, 98.0, 116.54, 92.5]     // C9sus4
    ];
    this.scheduleJazzWalkingBass(musicDest, reverbNode, walkingBars, beatMs, 0.32);
    this.scheduleJazzBrushedDrums(musicDest, reverbNode, beatMs, 0.13);

    this.scheduleMellowHornOrSaxPhrases(
      musicDest,
      reverbNode,
      [
        [349.23, 440.0, 392.0, 329.63],
        [370.0, 392.0, 440.0, 349.23],
        [392.0, 466.16, 440.0, 349.23],
        [329.63, 293.66, 261.63, 293.66],
        [440.0, 523.25, 493.88, 392.0],
        [370.0, 349.23, 311.13, 293.66],
        [293.66, 349.23, 392.0, 440.0],
        [392.0, 349.23, 329.63, 293.66]
      ],
      barMs * 2,
      0.19,
      'flugelhorn'
    );
  }

  /**
   * Classical 1: Clair de Rêve (Nocturne)
   * Expressive additive Concert Grand Piano arpeggios, Karplus-Strong Concert Harp, Bowed Cello.
   */
  private buildClassicalClairNocturneMusic(musicDest: AudioNode, reverbNode: ConvolverNode | null): void {
    const barMs = 5600;
    const grandArpeggios = [
      [174.61, 261.63, 329.63, 440.0, 523.25, 440.0, 329.63, 261.63], // Fmaj9
      [146.83, 220.0, 293.66, 392.0, 440.0, 392.0, 293.66, 220.0],  // Dm9
      [116.54, 174.61, 233.08, 293.66, 440.0, 349.23, 293.66, 233.08], // Bbmaj7
      [130.81, 196.0, 261.63, 349.23, 392.0, 349.23, 293.66, 261.63], // C9sus4
      [110.0, 164.81, 261.63, 329.63, 392.0, 329.63, 261.63, 196.0],  // Am7
      [146.83, 220.0, 261.63, 349.23, 440.0, 349.23, 261.63, 220.0],  // Dm7
      [98.0, 174.61, 233.08, 293.66, 392.0, 349.23, 293.66, 233.08],  // Gm9
      [130.81, 196.0, 261.63, 329.63, 440.0, 392.0, 329.63, 261.63]   // C13
    ];
    this.scheduleConcertGrandArpeggio(musicDest, reverbNode, grandArpeggios, barMs, 0.25);

    const harpPatterns = [
      [261.63, 349.23, 440.0, 523.25, 659.25, 783.99, 880.0],
      [220.0, 293.66, 392.0, 440.0, 587.33, 659.25, 783.99],
      [233.08, 293.66, 349.23, 440.0, 587.33, 698.46, 880.0],
      [196.0, 261.63, 349.23, 392.0, 523.25, 659.25, 783.99]
    ];
    this.scheduleHarpArpeggios(musicDest, reverbNode, harpPatterns, barMs, 0.22);

    this.scheduleWarmCelloSustain(
      musicDest,
      reverbNode,
      [87.31, 73.42, 58.27, 65.41, 55.0, 73.42, 49.0, 65.41],
      barMs,
      0.19
    );
  }

  /**
   * Classical 2: Pastoral Symphony Adagio
   * Breathy Concert Flute, French Horn cantabile, Cello sustain, Classical Harp.
   */
  private buildClassicalPastoralAdagioMusic(musicDest: AudioNode, reverbNode: ConvolverNode | null): void {
    const barMs = 6000;
    this.scheduleWarmCelloSustain(
      musicDest,
      reverbNode,
      [98.0, 82.41, 65.41, 73.42, 61.74, 82.41, 55.0, 73.42],
      barMs,
      0.20
    );

    const harpPatterns = [
      [196.0, 246.94, 293.66, 392.0, 493.88, 587.33, 739.99], // Gmaj7
      [164.81, 246.94, 293.66, 369.99, 440.0, 493.88, 659.25],// Em9
      [261.63, 329.63, 392.0, 493.88, 587.33, 659.25, 783.99],// Cmaj9
      [146.83, 220.0, 293.66, 392.0, 440.0, 587.33, 659.25]   // D6sus4
    ];
    this.scheduleHarpArpeggios(musicDest, reverbNode, harpPatterns, barMs, 0.21);

    this.scheduleWoodwindFlutePhrases(
      musicDest,
      reverbNode,
      [
        [587.33, 659.25, 739.99, 783.99, 659.25],
        [783.99, 739.99, 659.25, 587.33, 493.88],
        [523.25, 587.33, 659.25, 783.99, 739.99],
        [659.25, 587.33, 523.25, 493.88, 440.0],
        [493.88, 587.33, 659.25, 739.99, 783.99],
        [880.0, 783.99, 739.99, 659.25, 587.33],
        [523.25, 493.88, 440.0, 392.0, 440.0],
        [587.33, 659.25, 587.33, 493.88, 392.0]
      ],
      barMs,
      0.19
    );

    this.scheduleMellowHornOrSaxPhrases(
      musicDest,
      reverbNode,
      [
        [293.66, 369.99, 392.0, 329.63],
        [261.63, 293.66, 329.63, 293.66],
        [246.94, 293.66, 369.99, 329.63],
        [220.0, 261.63, 293.66, 246.94]
      ],
      barMs * 2,
      0.18,
      'french_horn'
    );
  }

  /**
   * Chamber 1: Salon de Provence Quartet
   * Classical Guitar, Bowed Cello, Chamber Piano, Lyrical Flute.
   */
  private buildChamberSalonProvenceMusic(musicDest: AudioNode, reverbNode: ConvolverNode | null): void {
    const barMs = 5200;
    const chamberChords = [
      [110.0, 196.0, 246.94, 261.63, 329.63], // Am9
      [146.83, 220.0, 261.63, 329.63],        // Dm9
      [98.0, 174.61, 246.94, 293.66, 329.63], // G13
      [130.81, 196.0, 246.94, 293.66, 329.63],// Cmaj9
      [174.61, 220.0, 261.63, 329.63],        // Fmaj7
      [123.47, 174.61, 220.0, 293.66],        // Bm7b5
      [164.81, 220.0, 246.94, 293.66],        // E7sus4
      [110.0, 164.81, 246.94, 261.63, 329.63] // Am9
    ];
    this.scheduleConcertGrandArpeggio(
      musicDest,
      reverbNode,
      chamberChords.map((c) => [...c, c[2], c[1]]),
      barMs,
      0.22
    );

    this.scheduleWarmCelloSustain(
      musicDest,
      reverbNode,
      [110.0, 73.42, 98.0, 65.41, 87.31, 61.74, 82.41, 55.0],
      barMs,
      0.19
    );

    this.scheduleAcousticGuitarFingerpicking(
      musicDest,
      reverbNode,
      [
        [110.0, 164.81, 261.63, 329.63, 246.94, 196.0],
        [146.83, 220.0, 261.63, 349.23, 329.63, 220.0],
        [196.0, 246.94, 293.66, 392.0, 329.63, 246.94],
        [130.81, 196.0, 246.94, 329.63, 293.66, 196.0],
        [174.61, 220.0, 261.63, 329.63, 261.63, 220.0],
        [123.47, 174.61, 220.0, 293.66, 220.0, 174.61],
        [164.81, 220.0, 246.94, 329.63, 293.66, 246.94],
        [110.0, 164.81, 246.94, 329.63, 261.63, 196.0]
      ],
      430,
      0.22,
      'nylon_guitar'
    );

    this.scheduleWoodwindFlutePhrases(
      musicDest,
      reverbNode,
      [
        [523.25, 493.88, 440.0, 392.0, 440.0],
        [440.0, 523.25, 587.33, 659.25, 523.25],
        [587.33, 659.25, 587.33, 493.88, 392.0],
        [523.25, 659.25, 587.33, 523.25, 440.0],
        [440.0, 523.25, 659.25, 587.33, 523.25],
        [493.88, 440.0, 392.0, 349.23, 392.0],
        [329.63, 392.0, 440.0, 493.88, 440.0],
        [523.25, 493.88, 440.0, 329.63, 440.0]
      ],
      barMs,
      0.18
    );
  }

  /**
   * Chamber 2: Sanctuary Vespers (also Auto default for Paradise Sanctuary)
   * Concert Harp, French Horn, Bowed Cello, Celestial Pad.
   */
  private buildChamberSanctuaryVespersMusic(musicDest: AudioNode, reverbNode: ConvolverNode | null): void {
    const barMs = 6800;
    const paradiseChords = [
      [130.81, 196.0, 246.94, 293.66, 329.63], // Cmaj9
      [110.0, 196.0, 246.94, 261.63, 329.63],  // Am9
      [87.31, 174.61, 220.0, 261.63, 329.63],  // Fmaj9
      [98.0, 196.0, 261.63, 293.66, 329.63],   // G6sus4
      [130.81, 196.0, 246.94, 329.63],         // Cmaj7
      [164.81, 246.94, 293.66, 392.0],         // Em7
      [146.83, 220.0, 261.63, 329.63],         // Dm9
      [98.0, 196.0, 246.94, 293.66, 329.63]    // G6
    ];

    this.scheduleEtherealChoirPad(musicDest, reverbNode, paradiseChords, barMs, 0.14);
    this.scheduleWarmCelloSustain(
      musicDest,
      reverbNode,
      [65.41, 110.0, 87.31, 98.0, 65.41, 82.41, 73.42, 98.0],
      barMs,
      0.18
    );

    const harpPatterns = [
      [261.63, 329.63, 392.0, 493.88, 587.33, 659.25, 783.99],
      [220.0, 261.63, 329.63, 392.0, 493.88, 523.25, 659.25],
      [174.61, 220.0, 261.63, 329.63, 440.0, 523.25, 659.25],
      [196.0, 261.63, 293.66, 329.63, 440.0, 587.33, 659.25]
    ];
    this.scheduleHarpArpeggios(musicDest, reverbNode, harpPatterns, barMs, 0.21);

    this.scheduleMellowHornOrSaxPhrases(
      musicDest,
      reverbNode,
      [
        [329.63, 392.0, 440.0, 392.0],
        [261.63, 329.63, 392.0, 329.63],
        [293.66, 349.23, 392.0, 329.63],
        [246.94, 293.66, 392.0, 293.66]
      ],
      barMs * 1.5,
      0.17,
      'french_horn'
    );
    this.scheduleMelodyNotes(musicDest, reverbNode, [783.99, 987.77, 1046.5, 1174.66, 1318.51], 2800, 5400, 0.12, 'sine');
  }

  /**
   * Acoustic Chill 1: Coastal 3/4 Waltz (also Auto default for Ghibli Valley)
   * Karplus-Strong Acoustic Guitar + Felt Piano + Flugelhorn + Cello.
   */
  private buildAcousticCoastalWaltzMusic(musicDest: AudioNode, reverbNode: ConvolverNode | null): void {
    const beatMs = 1150;
    this.scheduleWaltzPianoProgression(
      musicDest,
      reverbNode,
      [
        [174.61, 220.0, 261.63, 329.63],        // Fmaj7
        [164.81, 196.0, 246.94, 293.66],        // Em7
        [146.83, 220.0, 261.63, 329.63],        // Dm9
        [130.81, 196.0, 246.94, 293.66, 329.63],// Cmaj9
        [116.54, 174.61, 220.0, 293.66],        // Bbmaj7
        [110.0, 196.0, 261.63, 329.63],         // Am7
        [98.0, 174.61, 233.08, 293.66],         // Gm9
        [130.81, 196.0, 261.63, 349.23]         // C9sus4
      ],
      beatMs,
      0.26
    );
    this.scheduleWarmCelloSustain(
      musicDest,
      reverbNode,
      [87.31, 82.41, 73.42, 65.41, 58.27, 55.0, 49.0, 65.41],
      beatMs * 3,
      0.18
    );

    this.scheduleAcousticGuitarFingerpicking(
      musicDest,
      reverbNode,
      [
        [174.61, 261.63, 329.63, 440.0, 329.63, 261.63],
        [164.81, 246.94, 293.66, 392.0, 293.66, 246.94],
        [146.83, 220.0, 261.63, 329.63, 261.63, 220.0],
        [130.81, 196.0, 246.94, 329.63, 246.94, 196.0],
        [116.54, 174.61, 233.08, 293.66, 233.08, 174.61],
        [110.0, 196.0, 261.63, 329.63, 261.63, 196.0],
        [196.0, 233.08, 293.66, 349.23, 293.66, 233.08],
        [130.81, 196.0, 261.63, 349.23, 293.66, 196.0]
      ],
      575,
      0.22,
      'nylon_guitar'
    );

    this.scheduleMellowHornOrSaxPhrases(
      musicDest,
      reverbNode,
      [
        [329.63, 392.0, 440.0, 523.25, 440.0],
        [392.0, 349.23, 329.63, 293.66, 261.63],
        [293.66, 329.63, 392.0, 440.0, 392.0],
        [349.23, 392.0, 440.0, 349.23, 329.63]
      ],
      6900,
      0.18,
      'flugelhorn'
    );
    this.scheduleMelodyNotes(musicDest, reverbNode, [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5], 2400, 4400, 0.13, 'triangle');
  }

  /**
   * Acoustic Chill 2: Zen Forest Meditation (also Auto default for Misty Forest)
   * Fingerpicked Acoustic Guitar + Bamboo Flute + Cello + Soft Chimes.
   */
  private buildZenForestFluteMusic(musicDest: AudioNode, reverbNode: ConvolverNode | null): void {
    const barMs = 6000;
    this.scheduleFeltPianoProgression(
      musicDest,
      reverbNode,
      [
        [110.0, 164.81, 246.94, 261.63, 329.63], // Am9
        [87.31, 174.61, 220.0, 261.63, 329.63],  // Fmaj7
        [130.81, 196.0, 246.94, 293.66, 329.63], // Cmaj9
        [98.0, 196.0, 246.94, 293.66, 329.63],   // G6
        [146.83, 220.0, 261.63, 329.63],         // Dm9
        [110.0, 164.81, 246.94, 261.63, 329.63], // Am9
        [87.31, 174.61, 220.0, 293.66, 329.63],  // Fmaj9
        [164.81, 220.0, 246.94, 329.63]          // Esus4
      ],
      barMs,
      0.26
    );
    this.scheduleWarmCelloSustain(
      musicDest,
      reverbNode,
      [110.0, 87.31, 65.41, 98.0, 73.42, 55.0, 87.31, 82.41],
      barMs,
      0.18
    );

    this.scheduleAcousticGuitarFingerpicking(
      musicDest,
      reverbNode,
      [
        [110.0, 164.81, 220.0, 261.63, 329.63, 246.94],
        [174.61, 220.0, 261.63, 329.63, 440.0, 261.63],
        [130.81, 196.0, 261.63, 329.63, 392.0, 293.66],
        [196.0, 246.94, 293.66, 392.0, 329.63, 246.94],
        [146.83, 220.0, 261.63, 329.63, 440.0, 329.63],
        [110.0, 164.81, 246.94, 261.63, 329.63, 246.94],
        [174.61, 220.0, 293.66, 329.63, 440.0, 329.63],
        [164.81, 220.0, 246.94, 329.63, 293.66, 246.94]
      ],
      375,
      0.22,
      'steel_guitar'
    );

    this.scheduleWoodwindFlutePhrases(
      musicDest,
      reverbNode,
      [
        [440.0, 523.25, 587.33, 659.25, 523.25],
        [659.25, 587.33, 523.25, 440.0, 392.0],
        [329.63, 392.0, 440.0, 523.25, 440.0],
        [523.25, 659.25, 783.99, 659.25, 587.33],
        [587.33, 523.25, 440.0, 392.0, 440.0],
        [440.0, 523.25, 659.25, 587.33, 523.25],
        [392.0, 440.0, 523.25, 440.0, 329.63],
        [329.63, 392.0, 440.0, 392.0, 329.63]
      ],
      barMs,
      0.19
    );
    this.scheduleMelodyNotes(musicDest, reverbNode, [440.0, 523.25, 587.33, 659.25, 783.99], 2600, 4900, 0.13, 'sine');
  }

  /**
   * Acoustic Chill 3: Hồn Việt Ngũ Cung (Đàn Tranh & Sáo Trúc, 66 BPM)
   * Also Auto default for Space 7 (`vietnam-heritage`).
   * Karplus-Strong Đàn Tranh pentatonic glissandi, Sáo Trúc Ngũ Cung phrases, Felt Piano & Bowed Cello.
   */
  private buildVietnamLotusSerenadeMusic(musicDest: AudioNode, reverbNode: ConvolverNode | null): void {
    const beatMs = Math.round(60000 / 66); // ~909ms
    const barMs = beatMs * 4;              // ~3636ms

    // Pentatonic modal quartal/quintal harmonies (D - E - G - A - B / C - D - F - G - A)
    const vietChords = [
      [146.83, 220.0, 293.66, 329.63, 392.0], // Dsus4/9 (D-A-D-E-G)
      [196.0, 293.66, 329.63, 392.0, 440.0],  // G6sus2 (G-D-E-G-A)
      [110.0, 164.81, 220.0, 293.66, 329.63], // A7sus4 (A-E-A-D-E)
      [146.83, 196.0, 220.0, 293.66, 440.0],  // D5add11
      [130.81, 196.0, 261.63, 293.66, 392.0], // Csus2 (C-G-C-D-G)
      [196.0, 246.94, 293.66, 392.0, 440.0],  // Gadd9
      [110.0, 196.0, 246.94, 293.66, 329.63], // Am11
      [146.83, 220.0, 293.66, 392.0, 440.0]   // Dsus4
    ];
    this.scheduleFeltPianoProgression(musicDest, reverbNode, vietChords, barMs, 0.24);

    this.scheduleWarmCelloSustain(
      musicDest,
      reverbNode,
      [73.42, 98.0, 55.0, 73.42, 65.41, 98.0, 55.0, 73.42],
      barMs,
      0.18
    );

    // Đàn Tranh (Karplus-Strong bright zither) pentatonic cascading ornaments
    this.scheduleAcousticGuitarFingerpicking(
      musicDest,
      reverbNode,
      [
        [293.66, 329.63, 392.0, 440.0, 587.33, 440.0, 392.0, 329.63],
        [392.0, 440.0, 493.88, 587.33, 659.25, 587.33, 493.88, 440.0],
        [220.0, 293.66, 329.63, 440.0, 493.88, 440.0, 329.63, 293.66],
        [293.66, 392.0, 440.0, 587.33, 659.25, 587.33, 440.0, 392.0],
        [261.63, 293.66, 392.0, 440.0, 523.25, 440.0, 392.0, 293.66],
        [392.0, 440.0, 493.88, 587.33, 783.99, 659.25, 587.33, 440.0],
        [220.0, 261.63, 293.66, 392.0, 440.0, 392.0, 293.66, 261.63],
        [293.66, 329.63, 392.0, 440.0, 587.33, 659.25, 587.33, 440.0]
      ],
      Math.round(beatMs * 0.5),
      0.23,
      'dan_tranh'
    );

    // Sáo Trúc Ngũ Cung (Vietnamese Bamboo Flute pentatonic melody: D-E-G-A-B-D)
    this.scheduleWoodwindFlutePhrases(
      musicDest,
      reverbNode,
      [
        [587.33, 659.25, 783.99, 880.0, 783.99],
        [880.0, 783.99, 659.25, 587.33, 440.0],
        [440.0, 587.33, 659.25, 783.99, 659.25],
        [587.33, 783.99, 880.0, 987.77, 880.0],
        [783.99, 659.25, 587.33, 493.88, 440.0],
        [587.33, 659.25, 783.99, 659.25, 587.33]
      ],
      barMs,
      0.20
    );

    this.scheduleMelodyNotes(musicDest, reverbNode, [587.33, 659.25, 783.99, 880.0, 987.77, 1174.66], 2200, 4400, 0.14, 'sine');
  }

  // =========================================================================
  // Instrument Schedulers
  // =========================================================================

  /**
   * Acoustic Walking Upright Bass for Jazz Trio / Quartet.
   */
  private scheduleJazzWalkingBass(
    dryDest: AudioNode,
    reverbDest: ConvolverNode | null,
    walkingBars: number[][],
    beatMs: number,
    peakGain: number
  ): void {
    if (typeof this.ctx.createOscillator !== 'function') return;

    const bassFilter = this.ctx.createBiquadFilter();
    bassFilter.type = 'lowpass';
    bassFilter.frequency.setValueAtTime(950, this.ctx.currentTime);
    bassFilter.Q.setValueAtTime(1.1, this.ctx.currentTime);
    bassFilter.connect(dryDest);
    if (reverbDest) bassFilter.connect(reverbDest);
    this.pushNode('music', bassFilter);

    let barIdx = 0;
    let beatIdx = 0;
    const beatSec = beatMs / 1000;

    const stepBass = () => {
      if (!this.isRunning) return;
      const bar = walkingBars[barIdx % walkingBars.length];
      const freq = bar[beatIdx % bar.length];
      beatIdx++;
      if (beatIdx >= bar.length) {
        beatIdx = 0;
        barIdx++;
      }

      try {
        const now = this.ctx.currentTime;
        // Pluck attack transient (950 Hz -> 450 Hz) for woody upright bass fingerboard bite
        bassFilter.frequency.setValueAtTime(950, now);
        bassFilter.frequency.exponentialRampToValueAtTime(450, now + Math.min(0.18, beatSec * 0.45));

        const fundOsc = this.ctx.createOscillator();
        fundOsc.type = 'sine';
        fundOsc.frequency.setValueAtTime(freq, now);

        const bodyOsc = this.ctx.createOscillator();
        bodyOsc.type = 'triangle';
        bodyOsc.frequency.setValueAtTime(freq * 2.0, now);

        const bodyGain = this.ctx.createGain();
        bodyGain.gain.setValueAtTime(0.36, now);
        bodyGain.gain.exponentialRampToValueAtTime(0.04, now + beatSec * 0.65);

        const env = this.ctx.createGain();
        env.gain.setValueAtTime(0.0001, now);
        env.gain.linearRampToValueAtTime(peakGain, now + 0.016);
        env.gain.setTargetAtTime(peakGain * 0.38, now + 0.08, beatSec * 0.42);
        env.gain.linearRampToValueAtTime(0.0001, now + beatSec * 0.96);

        fundOsc.connect(env);
        bodyOsc.connect(bodyGain);
        bodyGain.connect(env);
        env.connect(bassFilter);

        fundOsc.start(now);
        bodyOsc.start(now);
        fundOsc.stop(now + beatSec);
        bodyOsc.stop(now + beatSec);

        this.pushNode('music', fundOsc, bodyOsc, bodyGain, env);
      } catch {}

      this.scheduleScopedTimeout('music', stepBass, beatMs);
    };

    stepBass();
  }

  /**
   * Filtered Pink-Noise Brushed Snare & Swing Ride Cymbal Rhythm.
   */
  private scheduleJazzBrushedDrums(
    dryDest: AudioNode,
    reverbDest: ConvolverNode | null,
    beatMs: number,
    peakGain: number
  ): void {
    if (typeof this.ctx.createBufferSource !== 'function') return;
    const brushBuffer = this.createPinkNoiseBuffer(1.0, 0.38);
    if (!brushBuffer) return;

    const beatSec = beatMs / 1000;
    let beatCount = 0;

    const triggerBrushNoise = (
      startTime: number,
      filterType: BiquadFilterType,
      freqHz: number,
      q: number,
      durSec: number,
      gainVal: number
    ) => {
      try {
        const src = this.ctx.createBufferSource();
        src.buffer = brushBuffer;

        const filt = this.ctx.createBiquadFilter();
        filt.type = filterType;
        filt.frequency.setValueAtTime(freqHz, startTime);
        filt.Q.setValueAtTime(q, startTime);

        const env = this.ctx.createGain();
        env.gain.setValueAtTime(0.0001, startTime);
        env.gain.linearRampToValueAtTime(gainVal, startTime + 0.012);
        env.gain.exponentialRampToValueAtTime(0.0001, startTime + durSec);

        src.connect(filt);
        filt.connect(env);
        env.connect(dryDest);
        if (reverbDest) env.connect(reverbDest);

        src.start(startTime);
        src.stop(startTime + durSec + 0.02);
        this.pushNode('music', src, filt, env);
      } catch {}
    };

    const tickBeat = () => {
      if (!this.isRunning) return;
      const now = this.ctx.currentTime;
      const beatInBar = beatCount % 4;
      beatCount++;

      // Swing ride tap on every quarter beat
      triggerBrushNoise(now, 'highpass', 5400, 0.8, 0.22, peakGain * 0.65);

      // Swing triplet skip note on beats 2 and 4 ("ding - ding-da")
      if (beatInBar === 1 || beatInBar === 3) {
        triggerBrushNoise(now + beatSec * 0.66, 'highpass', 6200, 1.0, 0.12, peakGain * 0.42);
        // Warm brushed snare swish on 2 & 4
        triggerBrushNoise(now, 'bandpass', 1850, 1.1, 0.16, peakGain * 0.90);
      }

      this.scheduleScopedTimeout('music', tickBeat, beatMs);
    };

    tickBeat();
  }

  /**
   * Expressive additive Concert Grand Piano arpeggiator for Classical & Chamber styles.
   */
  private scheduleConcertGrandArpeggio(
    dryDest: AudioNode,
    reverbDest: ConvolverNode | null,
    arpeggioBars: number[][],
    barIntervalMs: number,
    peakGain: number
  ): void {
    if (typeof this.ctx.createOscillator !== 'function') return;

    const grandFilter = this.ctx.createBiquadFilter();
    grandFilter.type = 'lowpass';
    grandFilter.frequency.setValueAtTime(3300, this.ctx.currentTime);
    grandFilter.Q.setValueAtTime(0.55, this.ctx.currentTime);
    grandFilter.connect(dryDest);
    if (reverbDest) grandFilter.connect(reverbDest);
    this.pushNode('music', grandFilter);

    let barIdx = 0;
    const playBar = () => {
      if (!this.isRunning) return;
      const notes = arpeggioBars[barIdx % arpeggioBars.length];
      barIdx++;

      const baseTime = this.ctx.currentTime;
      const stepSec = (barIntervalMs / 1000) / Math.max(1, notes.length);

      notes.forEach((freq, idx) => {
        try {
          const t0 = baseTime + idx * stepSec;
          const dur = Math.min(3.8, stepSec * 3.4);

          const h1 = this.ctx.createOscillator();
          h1.type = 'sine';
          h1.frequency.setValueAtTime(freq, t0);

          const h2 = this.ctx.createOscillator();
          h2.type = 'sine';
          h2.frequency.setValueAtTime(freq * 2.0008, t0);
          const h2Gain = this.ctx.createGain();
          h2Gain.gain.setValueAtTime(0.36, t0);
          h2Gain.gain.exponentialRampToValueAtTime(0.05, t0 + dur * 0.55);

          const h3 = this.ctx.createOscillator();
          h3.type = 'triangle';
          h3.frequency.setValueAtTime(freq * 3.0, t0);
          const h3Gain = this.ctx.createGain();
          h3Gain.gain.setValueAtTime(0.14, t0);
          h3Gain.gain.exponentialRampToValueAtTime(0.01, t0 + 0.42);

          const env = this.ctx.createGain();
          const notePeak = peakGain * (idx === 0 ? 1.05 : 0.82);
          env.gain.setValueAtTime(0.0001, t0);
          env.gain.linearRampToValueAtTime(notePeak, t0 + 0.016);
          env.gain.setTargetAtTime(notePeak * 0.38, t0 + 0.12, 0.72);
          env.gain.linearRampToValueAtTime(0.0001, t0 + dur);

          h1.connect(env);
          h2.connect(h2Gain);
          h2Gain.connect(env);
          h3.connect(h3Gain);
          h3Gain.connect(env);
          env.connect(grandFilter);

          h1.start(t0);
          h2.start(t0);
          h3.start(t0);
          h1.stop(t0 + dur + 0.05);
          h2.stop(t0 + dur + 0.05);
          h3.stop(t0 + dur + 0.05);

          this.pushNode('music', h1, h2, h2Gain, h3, h3Gain, env);
        } catch {}
      });

      this.scheduleScopedTimeout('music', playBar, barIntervalMs);
    };

    playBar();
  }

  /**
   * Lush crossfaded ethereal choir/pad voices.
   */
  private scheduleEtherealChoirPad(
    dryDest: AudioNode,
    reverbDest: ConvolverNode | null,
    chords: number[][],
    intervalMs: number,
    voicePeakGain: number
  ): void {
    if (typeof this.ctx.createOscillator !== 'function') return;

    const choirFilter = this.ctx.createBiquadFilter();
    choirFilter.type = 'lowpass';
    choirFilter.frequency.setValueAtTime(1450, this.ctx.currentTime);
    choirFilter.Q.setValueAtTime(0.85, this.ctx.currentTime);
    choirFilter.connect(dryDest);
    if (reverbDest) choirFilter.connect(reverbDest);
    this.pushNode('music', choirFilter);

    const shimmerLfo = this.ctx.createOscillator();
    const shimmerGain = this.ctx.createGain();
    shimmerLfo.type = 'sine';
    shimmerLfo.frequency.setValueAtTime(0.11, this.ctx.currentTime);
    shimmerGain.gain.setValueAtTime(220, this.ctx.currentTime);
    shimmerLfo.connect(shimmerGain);
    shimmerGain.connect(choirFilter.frequency);
    shimmerLfo.start();
    this.pushNode('music', shimmerLfo, shimmerGain);

    let chordIndex = 0;
    const playChoirChord = () => {
      if (!this.isRunning) return;
      const chord = chords[chordIndex % chords.length];
      chordIndex++;

      const baseTime = this.ctx.currentTime;
      const duration = intervalMs / 1000 + 2.4;

      chord.forEach((freq, idx) => {
        try {
          const osc1 = this.ctx.createOscillator();
          osc1.type = 'sine';
          osc1.frequency.setValueAtTime(freq, baseTime);

          const osc2 = this.ctx.createOscillator();
          osc2.type = 'triangle';
          osc2.frequency.setValueAtTime(freq * 1.003, baseTime);

          const triGain = this.ctx.createGain();
          triGain.gain.setValueAtTime(0.22, baseTime);

          const env = this.ctx.createGain();
          const peak = voicePeakGain * (idx === 0 ? 0.85 : 0.68);
          env.gain.setValueAtTime(0.0001, baseTime);
          env.gain.linearRampToValueAtTime(peak, baseTime + 0.55);
          env.gain.setTargetAtTime(peak * 0.72, baseTime + 1.5, 1.8);
          env.gain.linearRampToValueAtTime(0.0001, baseTime + duration);

          osc1.connect(env);
          osc2.connect(triGain);
          triGain.connect(env);
          env.connect(choirFilter);

          osc1.start(baseTime);
          osc2.start(baseTime);
          osc1.stop(baseTime + duration + 0.05);
          osc2.stop(baseTime + duration + 0.05);

          this.pushNode('music', osc1, osc2, triGain, env);
        } catch {}
      });

      this.scheduleScopedTimeout('music', playChoirChord, intervalMs);
    };

    playChoirChord();
  }

  /**
   * Plucked concert harp arpeggios using Karplus-Strong waveguide strings with oscillator fallback.
   */
  private scheduleHarpArpeggios(
    dryDest: AudioNode,
    reverbDest: ConvolverNode | null,
    arpeggioPatterns: number[][],
    barIntervalMs: number,
    peakGain: number
  ): void {
    const harpBodyFilter = this.ctx.createBiquadFilter();
    harpBodyFilter.type = 'lowpass';
    harpBodyFilter.frequency.setValueAtTime(3450, this.ctx.currentTime);
    harpBodyFilter.Q.setValueAtTime(0.7, this.ctx.currentTime);
    harpBodyFilter.connect(dryDest);
    if (reverbDest) harpBodyFilter.connect(reverbDest);
    this.pushNode('music', harpBodyFilter);

    let patternIdx = 0;
    const playArpeggioBar = () => {
      if (!this.isRunning) return;
      const pattern = arpeggioPatterns[patternIdx % arpeggioPatterns.length];
      patternIdx++;

      const baseTime = this.ctx.currentTime;
      pattern.forEach((freq, noteIdx) => {
        try {
          const strikeTime = baseTime + 0.02 + noteIdx * 0.28;
          const notePeak = peakGain * (0.95 - noteIdx * 0.04);

          if (this.playKarplusPluck(freq, strikeTime, notePeak * 1.35, 2.8, 'concert_harp', harpBodyFilter, 'music')) {
            return;
          }

          if (typeof this.ctx.createOscillator !== 'function') return;
          const osc = this.ctx.createOscillator();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, strikeTime);

          const harmonic = this.ctx.createOscillator();
          harmonic.type = 'sine';
          harmonic.frequency.setValueAtTime(freq * 2.0, strikeTime);

          const harmGain = this.ctx.createGain();
          harmGain.gain.setValueAtTime(0.24, strikeTime);

          const pluckFilter = this.ctx.createBiquadFilter();
          pluckFilter.type = 'lowpass';
          pluckFilter.frequency.setValueAtTime(3200, strikeTime);
          pluckFilter.frequency.exponentialRampToValueAtTime(900, strikeTime + 1.6);

          const env = this.ctx.createGain();
          env.gain.setValueAtTime(0.0001, strikeTime);
          env.gain.linearRampToValueAtTime(notePeak, strikeTime + 0.018);
          env.gain.setTargetAtTime(0.0001, strikeTime + 0.04, 0.72);

          osc.connect(pluckFilter);
          harmonic.connect(harmGain);
          harmGain.connect(pluckFilter);
          pluckFilter.connect(env);
          env.connect(harpBodyFilter);

          osc.start(strikeTime);
          harmonic.start(strikeTime);
          osc.stop(strikeTime + 3.1);
          harmonic.stop(strikeTime + 3.1);

          this.pushNode('music', osc, harmonic, harmGain, pluckFilter, env);
        } catch {}
      });

      this.scheduleScopedTimeout('music', playArpeggioBar, barIntervalMs);
    };

    playArpeggioBar();
  }

  /**
   * Nostalgic 3/4 waltz felt-piano progression.
   */
  private scheduleWaltzPianoProgression(
    dryDest: AudioNode,
    reverbDest: ConvolverNode | null,
    chords: number[][],
    beatMs: number,
    voicePeakGain: number
  ): void {
    if (typeof this.ctx.createOscillator !== 'function') return;

    const pianoFilter = this.ctx.createBiquadFilter();
    pianoFilter.type = 'lowpass';
    pianoFilter.frequency.setValueAtTime(2850, this.ctx.currentTime);
    pianoFilter.Q.setValueAtTime(0.65, this.ctx.currentTime);
    pianoFilter.connect(dryDest);
    if (reverbDest) pianoFilter.connect(reverbDest);
    this.pushNode('music', pianoFilter);

    const strikeFeltNote = (freq: number, strikeTime: number, peak: number, sustainSec: number) => {
      try {
        const sineOsc = this.ctx.createOscillator();
        sineOsc.type = 'sine';
        sineOsc.frequency.setValueAtTime(freq, strikeTime);

        const warmOsc = this.ctx.createOscillator();
        warmOsc.type = 'triangle';
        warmOsc.frequency.setValueAtTime(freq * 1.0012, strikeTime);

        const warmGain = this.ctx.createGain();
        warmGain.gain.setValueAtTime(0.28, strikeTime);

        const overtoneOsc = this.ctx.createOscillator();
        overtoneOsc.type = 'sine';
        overtoneOsc.frequency.setValueAtTime(freq * 2.0, strikeTime);

        const overtoneGain = this.ctx.createGain();
        overtoneGain.gain.setValueAtTime(0.18, strikeTime);
        overtoneGain.gain.exponentialRampToValueAtTime(0.015, strikeTime + 0.55);

        const env = this.ctx.createGain();
        env.gain.setValueAtTime(0.0001, strikeTime);
        env.gain.linearRampToValueAtTime(peak, strikeTime + 0.04);
        env.gain.setTargetAtTime(peak * 0.42, strikeTime + 0.16, 0.9);
        env.gain.linearRampToValueAtTime(0.0001, strikeTime + sustainSec);

        sineOsc.connect(env);
        warmOsc.connect(warmGain);
        warmGain.connect(env);
        overtoneOsc.connect(overtoneGain);
        overtoneGain.connect(env);
        env.connect(pianoFilter);

        sineOsc.start(strikeTime);
        warmOsc.start(strikeTime);
        overtoneOsc.start(strikeTime);
        sineOsc.stop(strikeTime + sustainSec + 0.05);
        warmOsc.stop(strikeTime + sustainSec + 0.05);
        overtoneOsc.stop(strikeTime + sustainSec + 0.05);

        this.pushNode('music', sineOsc, warmOsc, warmGain, overtoneOsc, overtoneGain, env);
      } catch {}
    };

    let chordIndex = 0;
    const beatSec = beatMs / 1000;
    const playWaltzBar = () => {
      if (!this.isRunning) return;

      const chord = chords[chordIndex % chords.length];
      chordIndex++;

      const baseTime = this.ctx.currentTime;
      const rootFreq = chord[0];
      const upperVoicing = chord.slice(1);

      strikeFeltNote(rootFreq, baseTime, voicePeakGain * 1.05, beatSec * 3.1);

      [1, 2].forEach((beatNum) => {
        const beatTime = baseTime + beatNum * beatSec;
        const beatGain = beatNum === 1 ? voicePeakGain * 0.72 : voicePeakGain * 0.58;
        upperVoicing.forEach((f, idx) => {
          strikeFeltNote(f, beatTime + idx * 0.035, beatGain, beatSec * 1.8);
        });
      });

      this.scheduleScopedTimeout('music', playWaltzBar, beatMs * 3);
    };

    playWaltzBar();
  }

  private createOceanWavesLayer(
    natureDest: AudioNode,
    reverbDest: ConvolverNode | null,
    level: number
  ): void {
    if (typeof this.ctx.createBufferSource !== 'function' || typeof this.ctx.createOscillator !== 'function') return;
    const noiseBuffer = this.createPinkNoiseBuffer(4.0, 0.085);
    if (!noiseBuffer) return;

    try {
      const source = this.ctx.createBufferSource();
      source.buffer = noiseBuffer;
      source.loop = true;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(420, this.ctx.currentTime);
      filter.Q.setValueAtTime(0.75, this.ctx.currentTime);

      const waveGain = this.ctx.createGain();
      waveGain.gain.setValueAtTime(level * 0.65, this.ctx.currentTime);

      const swellLfo = this.ctx.createOscillator();
      swellLfo.type = 'sine';
      swellLfo.frequency.setValueAtTime(0.087, this.ctx.currentTime);

      const freqModGain = this.ctx.createGain();
      freqModGain.gain.setValueAtTime(260, this.ctx.currentTime);
      swellLfo.connect(freqModGain);
      freqModGain.connect(filter.frequency);

      const ampModGain = this.ctx.createGain();
      ampModGain.gain.setValueAtTime(level * 0.35, this.ctx.currentTime);
      swellLfo.connect(ampModGain);
      ampModGain.connect(waveGain.gain);

      source.connect(filter);
      filter.connect(waveGain);
      waveGain.connect(natureDest);
      if (reverbDest) waveGain.connect(reverbDest);

      swellLfo.start();
      source.start();

      this.pushNode('nature', source, filter, waveGain, swellLfo, freqModGain, ampModGain);
    } catch {}
  }

  private buildWarmSubDrone(destination: AudioNode, freqs: number[], gainAmount: number, cutoffHz: number): void {
    if (typeof this.ctx.createOscillator !== 'function') return;

    const droneGain = this.ctx.createGain();
    droneGain.gain.setValueAtTime(gainAmount, this.ctx.currentTime);
    droneGain.connect(destination);
    this.pushNode('music', droneGain);

    const droneFilter = this.ctx.createBiquadFilter();
    droneFilter.type = 'lowpass';
    droneFilter.frequency.setValueAtTime(cutoffHz, this.ctx.currentTime);
    droneFilter.Q.setValueAtTime(1.5, this.ctx.currentTime);
    droneFilter.connect(droneGain);
    this.pushNode('music', droneFilter);

    const droneLfo = this.ctx.createOscillator();
    const droneLfoGain = this.ctx.createGain();
    droneLfo.type = 'sine';
    droneLfo.frequency.setValueAtTime(0.05, this.ctx.currentTime);
    droneLfoGain.gain.setValueAtTime(55, this.ctx.currentTime);
    droneLfo.connect(droneLfoGain);
    droneLfoGain.connect(droneFilter.frequency);
    droneLfo.start();
    this.pushNode('music', droneLfo, droneLfoGain);

    freqs.forEach((f, idx) => {
      const osc = this.ctx.createOscillator();
      osc.type = idx === 1 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(f, this.ctx.currentTime);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(idx === freqs.length - 1 ? 0.45 : 0.7, this.ctx.currentTime);
      osc.connect(g);
      g.connect(droneFilter);
      osc.start();
      this.pushNode('music', osc, g);
    });
  }

  private scheduleFeltPianoProgression(
    dryDest: AudioNode,
    reverbDest: ConvolverNode | null,
    chords: number[][],
    intervalMs: number,
    voicePeakGain: number
  ): void {
    if (typeof this.ctx.createOscillator !== 'function') return;

    const pianoFilter = this.ctx.createBiquadFilter();
    pianoFilter.type = 'lowpass';
    pianoFilter.frequency.setValueAtTime(2850, this.ctx.currentTime);
    pianoFilter.Q.setValueAtTime(0.7, this.ctx.currentTime);
    pianoFilter.connect(dryDest);
    if (reverbDest) pianoFilter.connect(reverbDest);
    this.pushNode('music', pianoFilter);

    let chordIndex = 0;
    const playNextChord = () => {
      if (!this.isRunning) return;

      const chord = chords[chordIndex % chords.length];
      chordIndex++;

      const baseTime = this.ctx.currentTime;
      const duration = intervalMs / 1000 + 1.8;

      chord.forEach((freq, noteIdx) => {
        try {
          const strikeTime = baseTime + noteIdx * 0.06;

          const sineOsc = this.ctx.createOscillator();
          sineOsc.type = 'sine';
          sineOsc.frequency.setValueAtTime(freq, strikeTime);

          const warmOsc = this.ctx.createOscillator();
          warmOsc.type = 'triangle';
          warmOsc.frequency.setValueAtTime(freq * 1.001, strikeTime);

          const warmSubGain = this.ctx.createGain();
          warmSubGain.gain.setValueAtTime(0.28, strikeTime);

          const overtoneOsc = this.ctx.createOscillator();
          overtoneOsc.type = 'sine';
          overtoneOsc.frequency.setValueAtTime(freq * 2.0, strikeTime);

          const overtoneGain = this.ctx.createGain();
          overtoneGain.gain.setValueAtTime(0.18, strikeTime);
          overtoneGain.gain.exponentialRampToValueAtTime(0.015, strikeTime + 0.6);

          const env = this.ctx.createGain();
          env.gain.setValueAtTime(0.0001, strikeTime);
          env.gain.linearRampToValueAtTime(voicePeakGain * (1.0 - noteIdx * 0.06), strikeTime + 0.05);
          env.gain.setTargetAtTime(voicePeakGain * 0.45, strikeTime + 0.22, 1.4);
          env.gain.linearRampToValueAtTime(0.0001, strikeTime + duration);

          sineOsc.connect(env);
          warmOsc.connect(warmSubGain);
          warmSubGain.connect(env);
          overtoneOsc.connect(overtoneGain);
          overtoneGain.connect(env);
          env.connect(pianoFilter);

          sineOsc.start(strikeTime);
          warmOsc.start(strikeTime);
          overtoneOsc.start(strikeTime);
          sineOsc.stop(strikeTime + duration + 0.05);
          warmOsc.stop(strikeTime + duration + 0.05);
          overtoneOsc.stop(strikeTime + duration + 0.05);

          this.pushNode('music', sineOsc, warmOsc, warmSubGain, overtoneOsc, overtoneGain, env);
        } catch {}
      });

      this.scheduleScopedTimeout('music', playNextChord, intervalMs);
    };

    playNextChord();
  }

  private scheduleMelodyNotes(
    dryDest: AudioNode,
    reverbDest: ConvolverNode | null,
    scaleFreqs: number[],
    minDelayMs: number,
    maxDelayMs: number,
    peakGain: number,
    waveType: OscillatorType
  ): void {
    if (typeof this.ctx.createOscillator !== 'function') return;

    const triggerNote = () => {
      if (!this.isRunning) return;

      try {
        const freq = scaleFreqs[Math.floor(Math.random() * scaleFreqs.length)];
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const noteGain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        osc.type = waveType;
        osc.frequency.setValueAtTime(freq, now);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(2850, now);

        noteGain.gain.setValueAtTime(0.0001, now);
        noteGain.gain.linearRampToValueAtTime(peakGain, now + 0.02);
        noteGain.gain.setTargetAtTime(0.00001, now + 0.03, 0.85);

        osc.connect(filter);
        filter.connect(noteGain);
        noteGain.connect(dryDest);
        if (reverbDest) noteGain.connect(reverbDest);

        osc.start(now);
        osc.stop(now + 3.8);
        this.pushNode('music', osc, filter, noteGain);
      } catch {}

      const delay = minDelayMs + Math.random() * (maxDelayMs - minDelayMs);
      this.scheduleScopedTimeout('music', triggerNote, delay);
    };

    this.scheduleScopedTimeout('music', triggerNote, 80);
  }

  private createSweepingWindLayer(
    destination: AudioNode,
    filterType: BiquadFilterType,
    baseFreq: number,
    sweepDepth: number,
    q: number,
    lfoRate: number,
    gainAmount: number,
    scope: AudioScope = 'nature'
  ): void {
    if (typeof this.ctx.createBufferSource !== 'function') return;
    const noiseBuffer = this.createPinkNoiseBuffer(4.0, 0.08);
    if (!noiseBuffer) return;

    try {
      const source = this.ctx.createBufferSource();
      source.buffer = noiseBuffer;
      source.loop = true;

      const filter = this.ctx.createBiquadFilter();
      filter.type = filterType;
      filter.frequency.setValueAtTime(baseFreq, this.ctx.currentTime);
      filter.Q.setValueAtTime(q, this.ctx.currentTime);

      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();
      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(lfoRate, this.ctx.currentTime);
      lfoGain.gain.setValueAtTime(sweepDepth, this.ctx.currentTime);
      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);
      lfo.start();

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(gainAmount, this.ctx.currentTime);

      source.connect(filter);
      filter.connect(gain);
      gain.connect(destination);
      source.start();

      this.pushNode(scope, source, filter, lfo, lfoGain, gain);
    } catch {}
  }

  private createBabblingBrookLayer(
    natureDest: AudioNode,
    reverbDest: ConvolverNode | null,
    level: number
  ): void {
    this.createSweepingWindLayer(natureDest, 'bandpass', 780, 260, 0.85, 0.23, level, 'nature');

    if (typeof this.ctx.createOscillator !== 'function') return;

    const triggerDroplet = () => {
      if (!this.isRunning) return;
      try {
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        const f0 = 620 + Math.random() * 650;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(f0, now);
        osc.frequency.exponentialRampToValueAtTime(f0 * 1.45, now + 0.045);

        g.gain.setValueAtTime(0.0001, now);
        g.gain.linearRampToValueAtTime(level * 0.25, now + 0.008);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.075);

        osc.connect(g);
        g.connect(natureDest);
        if (reverbDest) g.connect(reverbDest);

        osc.start(now);
        osc.stop(now + 0.09);
        this.pushNode('nature', osc, g);
      } catch {}

      this.scheduleScopedTimeout('nature', triggerDroplet, 700 + Math.random() * 1900);
    };

    this.scheduleScopedTimeout('nature', triggerDroplet, 900);
  }

  private scheduleRealisticBirdsong(
    natureDest: AudioNode,
    reverbDest: ConvolverNode | null,
    biome: 'meadow' | 'forest'
  ): void {
    if (typeof this.ctx.createOscillator !== 'function') return;

    const playBirdPhrase = () => {
      if (!this.isRunning) return;

      try {
        const now = this.ctx.currentTime;
        const variant = Math.random();

        if (biome === 'forest' && variant < 0.28) {
          const notes = [1080, 860];
          notes.forEach((f, idx) => {
            const t0 = now + idx * 0.28;
            const osc = this.ctx.createOscillator();
            const g = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(f, t0);
            osc.frequency.exponentialRampToValueAtTime(f * 0.96, t0 + 0.16);

            g.gain.setValueAtTime(0.0001, t0);
            g.gain.linearRampToValueAtTime(0.038, t0 + 0.03);
            g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.19);

            osc.connect(g);
            g.connect(natureDest);
            if (reverbDest) g.connect(reverbDest);
            osc.start(t0);
            osc.stop(t0 + 0.22);
            this.pushNode('nature', osc, g);
          });
        } else if (variant < 0.65) {
          const basePitch = 2100 + Math.random() * 650;
          const syllableOffsets = [0, 0.16, 0.34];
          syllableOffsets.forEach((offset, idx) => {
            const t0 = now + offset;
            const osc = this.ctx.createOscillator();
            const g = this.ctx.createGain();
            const fStart = basePitch * (idx === 1 ? 1.18 : 1.0);
            const fEnd = fStart * (idx === 2 ? 0.88 : 1.24);

            osc.type = 'sine';
            osc.frequency.setValueAtTime(fStart, t0);
            osc.frequency.exponentialRampToValueAtTime(fEnd, t0 + 0.095);

            g.gain.setValueAtTime(0.0001, t0);
            g.gain.linearRampToValueAtTime(0.032, t0 + 0.018);
            g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.11);

            osc.connect(g);
            g.connect(natureDest);
            if (reverbDest) g.connect(reverbDest);
            osc.start(t0);
            osc.stop(t0 + 0.13);
            this.pushNode('nature', osc, g);
          });
        } else {
          const carrier = this.ctx.createOscillator();
          const mod = this.ctx.createOscillator();
          const modGain = this.ctx.createGain();
          const g = this.ctx.createGain();

          const fCenter = 2850 + Math.random() * 750;
          carrier.type = 'sine';
          carrier.frequency.setValueAtTime(fCenter, now);
          carrier.frequency.exponentialRampToValueAtTime(fCenter * 1.18, now + 0.14);
          carrier.frequency.exponentialRampToValueAtTime(fCenter * 0.94, now + 0.28);

          mod.frequency.setValueAtTime(24, now);
          modGain.gain.setValueAtTime(140, now);
          mod.connect(modGain);
          modGain.connect(carrier.frequency);

          g.gain.setValueAtTime(0.0001, now);
          g.gain.linearRampToValueAtTime(0.026, now + 0.03);
          g.gain.exponentialRampToValueAtTime(0.0001, now + 0.30);

          carrier.connect(g);
          g.connect(natureDest);
          if (reverbDest) g.connect(reverbDest);

          mod.start(now);
          carrier.start(now);
          carrier.stop(now + 0.32);
          mod.stop(now + 0.32);
          this.pushNode('nature', carrier, mod, modGain, g);
        }
      } catch {}

      this.scheduleScopedTimeout('nature', playBirdPhrase, 2600 + Math.random() * 4200);
    };

    this.scheduleScopedTimeout('nature', playBirdPhrase, 1400);
  }

  private scheduleNightCrickets(natureDest: AudioNode, reverbDest: ConvolverNode | null): void {
    if (typeof this.ctx.createOscillator !== 'function') return;

    const playCricketBurst = () => {
      if (!this.isRunning) return;
      try {
        const now = this.ctx.currentTime;
        const pulses = 3;
        for (let i = 0; i < pulses; i++) {
          const t0 = now + i * 0.065;
          const osc = this.ctx.createOscillator();
          const g = this.ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(3850, t0);

          g.gain.setValueAtTime(0.0001, t0);
          g.gain.linearRampToValueAtTime(0.009, t0 + 0.01);
          g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.045);

          osc.connect(g);
          g.connect(natureDest);
          if (reverbDest) g.connect(reverbDest);
          osc.start(t0);
          osc.stop(t0 + 0.05);
          this.pushNode('nature', osc, g);
        }
      } catch {}

      this.scheduleScopedTimeout('nature', playCricketBurst, 1900 + Math.random() * 2800);
    };

    this.scheduleScopedTimeout('nature', playCricketBurst, 2200);
  }

  /**
   * Plucked Acoustic / Nylon / Jazz Guitar fingerpicking using Karplus-Strong waveguide buffers
   * with automatic oscillator synthesis fallback when AudioBuffer is unavailable.
   */
  private scheduleAcousticGuitarFingerpicking(
    dryDest: AudioNode,
    reverbDest: ConvolverNode | null,
    chordPatterns: number[][],
    stepMs: number,
    peakGain: number,
    timbre: KarplusTimbre = 'nylon_guitar'
  ): void {
    const bodyResonance = this.ctx.createBiquadFilter();
    bodyResonance.type = 'lowpass';
    bodyResonance.frequency.setValueAtTime(
      timbre === 'jazz_guitar'
        ? 2650
        : timbre === 'nylon_guitar'
          ? 3050
          : timbre === 'dan_tranh'
            ? 3550
            : 3450,
      this.ctx.currentTime
    );
    bodyResonance.Q.setValueAtTime(1.0, this.ctx.currentTime);
    bodyResonance.connect(dryDest);
    if (reverbDest) bodyResonance.connect(reverbDest);
    this.pushNode('music', bodyResonance);

    let barIdx = 0;
    let noteStep = 0;

    const pluckNote = () => {
      if (!this.isRunning) return;

      const pattern = chordPatterns[barIdx % chordPatterns.length];
      const freq = pattern[noteStep % pattern.length];
      noteStep++;
      if (noteStep >= pattern.length) {
        noteStep = 0;
        barIdx++;
      }

      try {
        const now = this.ctx.currentTime + Math.random() * 0.012;
        const isThumbBass = noteStep === 1;
        const notePeak = peakGain * (isThumbBass ? 1.08 : 0.86);

        if (this.playKarplusPluck(freq, now, notePeak * 1.4, 2.2, timbre, bodyResonance, 'music')) {
          this.scheduleScopedTimeout('music', pluckNote, stepMs);
          return;
        }

        if (typeof this.ctx.createOscillator === 'function') {
          const bodyOsc = this.ctx.createOscillator();
          bodyOsc.type = 'triangle';
          bodyOsc.frequency.setValueAtTime(freq, now);

          const harm2Osc = this.ctx.createOscillator();
          harm2Osc.type = 'sine';
          harm2Osc.frequency.setValueAtTime(freq * 2.0, now);

          const harm2Gain = this.ctx.createGain();
          harm2Gain.gain.setValueAtTime(0.32, now);
          harm2Gain.gain.exponentialRampToValueAtTime(0.01, now + 0.38);

          const pluckFilter = this.ctx.createBiquadFilter();
          pluckFilter.type = 'lowpass';
          pluckFilter.frequency.setValueAtTime(3400, now);
          pluckFilter.frequency.exponentialRampToValueAtTime(950, now + 0.36);

          const env = this.ctx.createGain();
          env.gain.setValueAtTime(0.0001, now);
          env.gain.linearRampToValueAtTime(notePeak, now + 0.012);
          env.gain.setTargetAtTime(notePeak * 0.28, now + 0.04, 0.36);
          env.gain.linearRampToValueAtTime(0.0001, now + 2.2);

          bodyOsc.connect(pluckFilter);
          harm2Osc.connect(harm2Gain);
          harm2Gain.connect(pluckFilter);
          pluckFilter.connect(env);
          env.connect(bodyResonance);

          bodyOsc.start(now);
          harm2Osc.start(now);
          bodyOsc.stop(now + 2.3);
          harm2Osc.stop(now + 2.3);

          this.pushNode('music', bodyOsc, harm2Osc, harm2Gain, pluckFilter, env);
        }
      } catch {}

      this.scheduleScopedTimeout('music', pluckNote, stepMs);
    };

    pluckNote();
  }

  private scheduleMellowHornOrSaxPhrases(
    dryDest: AudioNode,
    reverbDest: ConvolverNode | null,
    phrases: number[][],
    phraseIntervalMs: number,
    peakGain: number,
    timbre: 'flugelhorn' | 'saxophone' | 'french_horn'
  ): void {
    if (typeof this.ctx.createOscillator !== 'function') return;

    let phraseIdx = 0;

    const playPhrase = () => {
      if (!this.isRunning) return;

      const notes = phrases[phraseIdx % phrases.length];
      phraseIdx++;

      try {
        const baseTime = this.ctx.currentTime;
        const noteDur = 1.02;
        const totalDur = notes.length * noteDur + 1.2;

        const leadOsc = this.ctx.createOscillator();
        leadOsc.type = timbre === 'saxophone' ? 'sawtooth' : 'triangle';
        leadOsc.frequency.setValueAtTime(notes[0], baseTime);

        const subWarmOsc = this.ctx.createOscillator();
        subWarmOsc.type = 'sine';
        subWarmOsc.frequency.setValueAtTime(notes[0], baseTime);

        const subWarmGain = this.ctx.createGain();
        subWarmGain.gain.setValueAtTime(timbre === 'french_horn' ? 0.65 : 0.48, baseTime);

        notes.forEach((f, idx) => {
          const tNote = baseTime + idx * noteDur;
          leadOsc.frequency.setValueAtTime(f, tNote);
          subWarmOsc.frequency.setValueAtTime(f, tNote);
          if (idx < notes.length - 1) {
            const nextF = notes[idx + 1];
            leadOsc.frequency.exponentialRampToValueAtTime(nextF, tNote + noteDur - 0.04);
            subWarmOsc.frequency.exponentialRampToValueAtTime(nextF, tNote + noteDur - 0.04);
          }
        });

        const vibLfo = this.ctx.createOscillator();
        const vibGain = this.ctx.createGain();
        vibLfo.type = 'sine';
        vibLfo.frequency.setValueAtTime(5.1, baseTime);
        vibGain.gain.setValueAtTime(0.4, baseTime);
        vibGain.gain.linearRampToValueAtTime(timbre === 'saxophone' ? 3.4 : 2.2, baseTime + 0.6);
        vibLfo.connect(vibGain);
        vibGain.connect(leadOsc.frequency);

        const bellFilter = this.ctx.createBiquadFilter();
        bellFilter.type = 'lowpass';
        const baseCutoff = timbre === 'french_horn' ? 1950 : timbre === 'flugelhorn' ? 2350 : 2750;
        bellFilter.frequency.setValueAtTime(baseCutoff * 0.65, baseTime);
        bellFilter.frequency.linearRampToValueAtTime(baseCutoff, baseTime + 0.25);
        bellFilter.frequency.setTargetAtTime(baseCutoff * 0.78, baseTime + totalDur * 0.6, 0.9);
        bellFilter.Q.setValueAtTime(timbre === 'saxophone' ? 1.8 : 1.3, baseTime);

        const env = this.ctx.createGain();
        env.gain.setValueAtTime(0.0001, baseTime);
        env.gain.linearRampToValueAtTime(peakGain, baseTime + 0.16);
        env.gain.setTargetAtTime(peakGain * 0.8, baseTime + 0.35, 1.4);
        env.gain.linearRampToValueAtTime(0.0001, baseTime + totalDur);

        leadOsc.connect(bellFilter);
        subWarmOsc.connect(subWarmGain);
        subWarmGain.connect(bellFilter);
        bellFilter.connect(env);
        env.connect(dryDest);
        if (reverbDest) env.connect(reverbDest);

        vibLfo.start(baseTime);
        leadOsc.start(baseTime);
        subWarmOsc.start(baseTime);
        vibLfo.stop(baseTime + totalDur + 0.05);
        leadOsc.stop(baseTime + totalDur + 0.05);
        subWarmOsc.stop(baseTime + totalDur + 0.05);

        this.pushNode('music', leadOsc, subWarmOsc, subWarmGain, vibLfo, vibGain, bellFilter, env);
      } catch {}

      this.scheduleScopedTimeout('music', playPhrase, phraseIntervalMs);
    };

    this.scheduleScopedTimeout('music', playPhrase, 60);
  }

  private scheduleWoodwindFlutePhrases(
    dryDest: AudioNode,
    reverbDest: ConvolverNode | null,
    phrases: number[][],
    phraseIntervalMs: number,
    peakGain: number
  ): void {
    if (typeof this.ctx.createOscillator !== 'function') return;

    let phraseIdx = 0;

    const playFlutePhrase = () => {
      if (!this.isRunning) return;

      const notes = phrases[phraseIdx % phrases.length];
      phraseIdx++;

      const baseTime = this.ctx.currentTime;
      const noteStepSec = 0.78;

      notes.forEach((freq, idx) => {
        try {
          const t0 = baseTime + idx * noteStepSec;
          const dur = noteStepSec * 1.15;

          const mainOsc = this.ctx.createOscillator();
          mainOsc.type = 'sine';
          mainOsc.frequency.setValueAtTime(freq, t0);

          const overtoneOsc = this.ctx.createOscillator();
          overtoneOsc.type = 'triangle';
          overtoneOsc.frequency.setValueAtTime(freq * 2.0, t0);

          const overtoneGain = this.ctx.createGain();
          overtoneGain.gain.setValueAtTime(0.18, t0);

          const vibLfo = this.ctx.createOscillator();
          const vibGain = this.ctx.createGain();
          vibLfo.type = 'sine';
          vibLfo.frequency.setValueAtTime(4.8, t0);
          vibGain.gain.setValueAtTime(2.4, t0);
          vibLfo.connect(vibGain);
          vibGain.connect(mainOsc.frequency);

          const fluteFilter = this.ctx.createBiquadFilter();
          fluteFilter.type = 'lowpass';
          fluteFilter.frequency.setValueAtTime(2550, t0);

          const env = this.ctx.createGain();
          env.gain.setValueAtTime(0.0001, t0);
          env.gain.linearRampToValueAtTime(peakGain, t0 + 0.08);
          env.gain.setTargetAtTime(peakGain * 0.68, t0 + 0.16, 0.35);
          env.gain.linearRampToValueAtTime(0.0001, t0 + dur);

          mainOsc.connect(fluteFilter);
          overtoneOsc.connect(overtoneGain);
          overtoneGain.connect(fluteFilter);
          fluteFilter.connect(env);
          env.connect(dryDest);
          if (reverbDest) env.connect(reverbDest);

          vibLfo.start(t0);
          mainOsc.start(t0);
          overtoneOsc.start(t0);
          vibLfo.stop(t0 + dur + 0.04);
          mainOsc.stop(t0 + dur + 0.04);
          overtoneOsc.stop(t0 + dur + 0.04);

          this.pushNode('music', mainOsc, overtoneOsc, overtoneGain, vibLfo, vibGain, fluteFilter, env);
        } catch {}
      });

      this.scheduleScopedTimeout('music', playFlutePhrase, phraseIntervalMs);
    };

    this.scheduleScopedTimeout('music', playFlutePhrase, 60);
  }

  private scheduleWarmCelloSustain(
    dryDest: AudioNode,
    reverbDest: ConvolverNode | null,
    rootNotes: number[],
    barIntervalMs: number,
    peakGain: number
  ): void {
    if (typeof this.ctx.createOscillator !== 'function') return;

    const celloBodyFilter = this.ctx.createBiquadFilter();
    celloBodyFilter.type = 'lowpass';
    celloBodyFilter.frequency.setValueAtTime(1150, this.ctx.currentTime);
    celloBodyFilter.Q.setValueAtTime(1.15, this.ctx.currentTime);
    celloBodyFilter.connect(dryDest);
    if (reverbDest) celloBodyFilter.connect(reverbDest);
    this.pushNode('music', celloBodyFilter);

    let noteIdx = 0;
    const bowNextNote = () => {
      if (!this.isRunning) return;

      const freq = rootNotes[noteIdx % rootNotes.length];
      noteIdx++;

      try {
        const now = this.ctx.currentTime;
        const dur = barIntervalMs / 1000 + 1.4;

        const sawOsc = this.ctx.createOscillator();
        sawOsc.type = 'sawtooth';
        sawOsc.frequency.setValueAtTime(freq, now);

        const triOsc = this.ctx.createOscillator();
        triOsc.type = 'triangle';
        triOsc.frequency.setValueAtTime(freq * 1.0015, now);

        const env = this.ctx.createGain();
        env.gain.setValueAtTime(0.0001, now);
        env.gain.linearRampToValueAtTime(peakGain, now + 0.35);
        env.gain.setTargetAtTime(peakGain * 0.74, now + 0.75, 1.5);
        env.gain.linearRampToValueAtTime(0.0001, now + dur);

        sawOsc.connect(env);
        triOsc.connect(env);
        env.connect(celloBodyFilter);

        sawOsc.start(now);
        triOsc.start(now);
        sawOsc.stop(now + dur + 0.05);
        triOsc.stop(now + dur + 0.05);

        this.pushNode('music', sawOsc, triOsc, env);
      } catch {}

      this.scheduleScopedTimeout('music', bowNextNote, barIntervalMs);
    };

    bowNextNote();
  }

  private stopNodeList(nodes: TrackableNode[]): void {
    for (const node of nodes) {
      try {
        if (typeof node.stop === 'function') {
          node.stop();
        }
      } catch {}
      try {
        if (typeof node.disconnect === 'function') {
          node.disconnect();
        }
      } catch {}
    }
    nodes.length = 0;
  }

  private stopMusicLayer(): void {
    for (const id of this.musicTimeouts) {
      clearTimeout(id);
    }
    this.musicTimeouts = [];
    this.stopNodeList(this.musicNodes);
    this.karplusCache.clear();
  }

  private stopNatureLayer(): void {
    for (const id of this.natureTimeouts) {
      clearTimeout(id);
    }
    this.natureTimeouts = [];
    this.stopNodeList(this.natureNodes);
  }

  /**
   * Stops all active audio generation and clears scheduled timers.
   */
  public stop(): void {
    this.isRunning = false;
    this.activeSlug = null;

    this.stopMusicLayer();
    this.stopNatureLayer();
    this.stopNodeList(this.sharedNodes);

    this.musicBus = null;
    this.natureBus = null;
    this.reverbNode = null;
  }

  public dispose(): void {
    this.stop();
  }
}

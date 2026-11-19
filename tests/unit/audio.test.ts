import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  AudioManager,
  calculateLogarithmicGain,
  applyCosineSeamCrossfade,
  MUSIC_TRACK_CATALOG
} from '../../src/client/scene/audio/AudioManager';
import {
  ProceduralAmbientSynth,
  MUSIC_TRACK_CATALOG as SYNTH_CATALOG
} from '../../src/client/scene/audio/ProceduralAmbientSynth';
import { AudioConfig } from '../../src/shared/types/space';

// Web Audio Test Mock Factory
class MockAudioParam {
  public value: number;
  public setValueAtTime = vi.fn((v: number) => { this.value = v; });
  public linearRampToValueAtTime = vi.fn((v: number) => { this.value = v; });
  public exponentialRampToValueAtTime = vi.fn((v: number) => { this.value = v; });
  public setTargetAtTime = vi.fn((v: number) => { this.value = v; });

  constructor(initialValue: number = 1.0) {
    this.value = initialValue;
  }
}

class MockAudioNode {
  public connect = vi.fn((dest: any) => dest);
  public disconnect = vi.fn();
}

class MockGainNode extends MockAudioNode {
  public gain = new MockAudioParam(1.0);
}

class MockOscillatorNode extends MockAudioNode {
  public type: string = 'sine';
  public frequency = new MockAudioParam(440);
  public start = vi.fn();
  public stop = vi.fn();
}

class MockBiquadFilterNode extends MockAudioNode {
  public type: string = 'lowpass';
  public frequency = new MockAudioParam(350);
  public Q = new MockAudioParam(1.0);
}

class MockAnalyserNode extends MockAudioNode {
  public fftSize: number = 64;
  public frequencyBinCount: number = 32;
  public smoothingTimeConstant: number = 0.8;
  public getByteFrequencyData = vi.fn((array: Uint8Array) => {
    // Fill dummy frequency pattern
    for (let i = 0; i < array.length; i++) {
      if (i < 4) array[i] = 200; // Bass
      else if (i < 16) array[i] = 100; // Mid
      else array[i] = 50; // Treble
    }
  });
}

class MockAudioBufferSourceNode extends MockAudioNode {
  public buffer: any = null;
  public loop: boolean = false;
  public start = vi.fn();
  public stop = vi.fn();
}

class MockConvolverNode extends MockAudioNode {
  public buffer: any = null;
}

class MockDynamicsCompressorNode extends MockAudioNode {
  public threshold = new MockAudioParam(-16);
  public knee = new MockAudioParam(12);
  public ratio = new MockAudioParam(4);
  public attack = new MockAudioParam(0.008);
  public release = new MockAudioParam(0.18);
}

function createMockAudioContext(initialState: 'running' | 'suspended' = 'running') {
  const destination = new MockAudioNode();

  const ctx: any = {
    currentTime: 1.0,
    sampleRate: 44100,
    state: initialState,
    destination,
    createGain: vi.fn(() => new MockGainNode()),
    createOscillator: vi.fn(() => new MockOscillatorNode()),
    createBiquadFilter: vi.fn(() => new MockBiquadFilterNode()),
    createAnalyser: vi.fn(() => new MockAnalyserNode()),
    createBufferSource: vi.fn(() => new MockAudioBufferSourceNode()),
    createConvolver: vi.fn(() => new MockConvolverNode()),
    createDynamicsCompressor: vi.fn(() => new MockDynamicsCompressorNode()),
    createBuffer: vi.fn((channels: number, length: number, sampleRate: number) => {
      const channelData: Float32Array[] = [];
      for (let c = 0; c < channels; c++) {
        channelData.push(new Float32Array(length));
      }
      return {
        sampleRate,
        length,
        duration: length / sampleRate,
        numberOfChannels: channels,
        getChannelData: (ch: number) => channelData[ch]
      };
    }),
    decodeAudioData: vi.fn().mockImplementation(async (arrayBuffer: ArrayBuffer) => {
      return ctx.createBuffer(2, 44100, 44100);
    }),
    resume: vi.fn().mockImplementation(async () => {
      ctx.state = 'running';
    }),
    close: vi.fn().mockResolvedValue(undefined)
  };

  return ctx as AudioContext;
}

describe('Seamless Looped Audio System', () => {
  describe('Logarithmic Volume Mapping & Mathematical Seam Crossfade', () => {
    it('calculates logarithmic gain according to Gain = (slider / 100)^2.2', () => {
      // 0 slider -> 0 gain
      expect(calculateLogarithmicGain(0)).toBe(0);
      // 100 slider (or 1.0 volume) -> 1.0 gain
      expect(calculateLogarithmicGain(100)).toBe(1.0);
      expect(calculateLogarithmicGain(1.0)).toBe(1.0);

      // 50% slider: (0.5)^2.2 = ~0.2176
      const halfGain = calculateLogarithmicGain(50);
      expect(halfGain).toBeCloseTo(Math.pow(0.5, 2.2), 4);
      expect(halfGain).toBeCloseTo(0.2176, 3);

      // Works with both [0.0 - 1.0] and [0 - 100] scale
      expect(calculateLogarithmicGain(0.8)).toBeCloseTo(calculateLogarithmicGain(80), 4);
      expect(calculateLogarithmicGain(0.2)).toBeCloseTo(calculateLogarithmicGain(20), 4);

      // Clamping limits
      expect(calculateLogarithmicGain(-10)).toBe(0);
      expect(calculateLogarithmicGain(120)).toBe(1.0);
    });

    it('applies equal-power cosine window seam crossfade to eliminate buffer loop clicks', () => {
      const sampleRate = 44100;
      const bufferLength = 4410; // 100ms
      const buffer = {
        sampleRate,
        length: bufferLength,
        duration: bufferLength / sampleRate,
        numberOfChannels: 1,
        channelData: [new Float32Array(bufferLength)],
        getChannelData: (ch: number) => buffer.channelData[ch]
      } as unknown as AudioBuffer;

      const pcm = buffer.getChannelData(0);
      // Create artificial boundary seam jump:
      // Start is at +0.8, End is at -0.8 (audible 1.6 step discontinuity click)
      pcm[0] = 0.8;
      pcm[1] = 0.8;
      pcm[bufferLength - 1] = -0.8;
      pcm[bufferLength - 2] = -0.8;

      // Apply 50ms cosine seam crossfade
      applyCosineSeamCrossfade(buffer, 0.05);

      // At boundary i = 0 (t = 0):
      // fadeStart = (1 - cos(0))/2 = 0
      // fadeEnd = (1 + cos(0))/2 = 1
      // blended = 0.8 * 0 + (-0.8) * 1 = -0.8
      // Both pcm[0] and pcm[bufferLength - seamSamples] match smoothly without click
      const seamSamples = Math.floor(0.05 * sampleRate);
      expect(pcm[0]).toBeCloseTo(pcm[bufferLength - seamSamples], 4);
      expect(Number.isFinite(pcm[0])).toBe(true);
    });
  });

  describe('ProceduralAmbientSynth', () => {
    let mockCtx: any;
    let mockOutput: any;

    beforeEach(() => {
      mockCtx = createMockAudioContext();
      mockOutput = new MockAudioNode();
    });

    it('creates D Dorian drone, pink noise vortex, and chimes for Space 1 (Starry Night)', () => {
      const synth = new ProceduralAmbientSynth(mockCtx, mockOutput);
      expect(synth.playing).toBe(false);

      synth.start('starry-night');
      expect(synth.playing).toBe(true);
      expect(synth.activeSpace).toBe('starry-night');

      // Verify that oscillators, filters, gain nodes, and buffer sources were instantiated
      expect(mockCtx.createGain).toHaveBeenCalled();
      expect(mockCtx.createBiquadFilter).toHaveBeenCalled();
      expect(mockCtx.createOscillator).toHaveBeenCalled();
      expect(mockCtx.createBuffer).toHaveBeenCalled();
      expect(mockCtx.createBufferSource).toHaveBeenCalled();

      synth.stop();
      expect(synth.playing).toBe(false);
      expect(synth.activeSpace).toBeNull();
      synth.dispose();
    });

    it('creates felt piano pads, breeze, and FM birdsong for Space 2 (Breezy Meadow)', () => {
      const synth = new ProceduralAmbientSynth(mockCtx, mockOutput);

      synth.start('breezy-meadow');
      expect(synth.playing).toBe(true);
      expect(synth.activeSpace).toBe('breezy-meadow');

      // Check pad oscillators and breeze buffers
      expect(mockCtx.createOscillator).toHaveBeenCalled();
      expect(mockCtx.createBiquadFilter).toHaveBeenCalled();
      expect(mockCtx.createBuffer).toHaveBeenCalled();

      synth.dispose();
      expect(synth.playing).toBe(false);
    });

    it('handles headless degradation gracefully when Web Audio methods are missing', () => {
      const bareCtx = {} as AudioContext;
      const bareOutput = {} as AudioNode;
      const synth = new ProceduralAmbientSynth(bareCtx, bareOutput);

      expect(() => synth.start('starry-night')).not.toThrow();
      expect(() => synth.stop()).not.toThrow();
      expect(() => synth.dispose()).not.toThrow();
    });
  });

  describe('AudioManager', () => {
    let mockCtx: any;
    let audioManager: AudioManager;

    beforeEach(() => {
      mockCtx = createMockAudioContext();
      audioManager = new AudioManager(mockCtx);
    });

    it('initializes with default volume (0.8) and unmuted state', () => {
      expect(audioManager.getVolume()).toBe(0.8);
      expect(audioManager.isMuted()).toBe(false);
      expect(audioManager.getAudioContext()).toBe(mockCtx);
    });

    it('updates volume via logarithmic mapping and triggers 100ms micro-fade', () => {
      audioManager.setVolume(0.5); // 50%
      expect(audioManager.getVolume()).toBe(0.5);

      // Verify micro-fade setTargetAtTime was called on masterGain
      const masterGain = (audioManager as any).masterGain;
      expect(masterGain.gain.setTargetAtTime).toHaveBeenCalled();

      const expectedGain = calculateLogarithmicGain(0.5);
      expect(masterGain.gain.setTargetAtTime).toHaveBeenCalledWith(
        expectedGain,
        mockCtx.currentTime,
        0.05
      );
    });

    it('executes click-free mute and unmute with micro-fades', () => {
      audioManager.setVolume(0.7);

      // Mute
      audioManager.setMute(true);
      expect(audioManager.isMuted()).toBe(true);
      const masterGain = (audioManager as any).masterGain;
      expect(masterGain.gain.setTargetAtTime).toHaveBeenCalledWith(0, mockCtx.currentTime, 0.05);

      // Unmute restores previous logarithmic volume
      audioManager.setMute(false);
      expect(audioManager.isMuted()).toBe(false);
      const expectedGain = calculateLogarithmicGain(0.7);
      expect(masterGain.gain.setTargetAtTime).toHaveBeenCalledWith(expectedGain, mockCtx.currentTime, 0.05);
    });

    it('plays procedural generative ambient synth for procedural_synth audio mode', async () => {
      const config: AudioConfig = {
        trackId: 'starry-night',
        name: 'The Starry Night Ambient',
        sourceUrl: '',
        defaultVolume: 0.75,
        loop: true,
        ambientType: 'procedural_synth'
      };

      await audioManager.loadAndPlay(config);
      const synth = audioManager.getProceduralSynth();
      expect(synth).not.toBeNull();
      expect(synth!.playing).toBe(true);
      expect(synth!.activeSpace).toBe('starry-night');
    });

    it('calculates real-time FFT energy across bass, mid, and treble frequency bands', () => {
      const energy = audioManager.getFFTEnergy();
      expect(energy).toBeDefined();
      expect(energy.bass).toBeGreaterThan(0);
      expect(energy.mid).toBeGreaterThan(0);
      expect(energy.treble).toBeGreaterThan(0);

      expect(energy.bass).toBeLessThanOrEqual(1.0);
      expect(energy.mid).toBeLessThanOrEqual(1.0);
      expect(energy.treble).toBeLessThanOrEqual(1.0);

      // In our mock pattern: Bass (200) > Mid (100) > Treble (50)
      expect(energy.bass).toBeGreaterThan(energy.mid);
      expect(energy.mid).toBeGreaterThan(energy.treble);
    });

    it('unlocks suspended AudioContext on user interaction gestures', () => {
      const mockEventTarget = new EventTarget();
      vi.stubGlobal('window', mockEventTarget);

      const suspendedCtx = createMockAudioContext('suspended');
      const suspendedManager = new AudioManager(suspendedCtx);

      expect(suspendedCtx.state).toBe('suspended');

      // Dispatch simulated user interaction gesture
      mockEventTarget.dispatchEvent(new Event('click'));

      expect(suspendedCtx.resume).toHaveBeenCalled();
      suspendedManager.dispose();
      vi.unstubAllGlobals();
    });

    it('auto-fades volume to 0 when tab is hidden and restores when focused', () => {
      const mockDoc = new EventTarget();
      (mockDoc as any).hidden = false;
      vi.stubGlobal('document', mockDoc);

      const manager = new AudioManager(mockCtx);
      manager.setVolume(0.6);

      const masterGain = (manager as any).masterGain;
      masterGain.gain.setTargetAtTime.mockClear();

      // Tab backgrounded
      (mockDoc as any).hidden = true;
      mockDoc.dispatchEvent(new Event('visibilitychange'));
      expect(masterGain.gain.setTargetAtTime).toHaveBeenCalledWith(0, mockCtx.currentTime, 0.08);

      masterGain.gain.setTargetAtTime.mockClear();

      // Tab focused again
      (mockDoc as any).hidden = false;
      mockDoc.dispatchEvent(new Event('visibilitychange'));
      const restoredGain = calculateLogarithmicGain(0.6);
      expect(masterGain.gain.setTargetAtTime).toHaveBeenCalledWith(restoredGain, mockCtx.currentTime, 0.08);

      manager.dispose();
      vi.unstubAllGlobals();
    });

    it('loads and plays sampled audio buffer with loop seam crossfading (Mode B)', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(1024))
      });
      vi.stubGlobal('fetch', mockFetch);

      const bufferConfig: AudioConfig = {
        trackId: 'meadow-loop',
        name: 'Meadow Chill Loop',
        sourceUrl: 'https://example.com/audio/meadow.ogg',
        defaultVolume: 0.85,
        loop: true,
        ambientType: 'audio_buffer'
      };

      await audioManager.loadAndPlay(bufferConfig);
      expect(mockFetch).toHaveBeenCalledWith('https://example.com/audio/meadow.ogg');
      expect(mockCtx.decodeAudioData).toHaveBeenCalled();
      expect(mockCtx.createBufferSource).toHaveBeenCalled();

      vi.unstubAllGlobals();
    });

    it('cleans up resources, active nodes, and event listeners on dispose', () => {
      audioManager.dispose();
      expect(mockCtx.close).toHaveBeenCalled();
    });

    it('exposes complete multi-genre MUSIC_TRACK_CATALOG across auto, jazz, classical, chamber, and acoustic', () => {
      expect(AudioManager.MUSIC_TRACK_CATALOG).toBe(SYNTH_CATALOG);
      expect(MUSIC_TRACK_CATALOG).toBe(SYNTH_CATALOG);
      expect(ProceduralAmbientSynth.MUSIC_TRACK_CATALOG).toBe(SYNTH_CATALOG);

      const ids = MUSIC_TRACK_CATALOG.map((t) => t.id);
      expect(ids).toEqual([
        'auto',
        'jazz-midnight-cafe',
        'jazz-velvet-swing',
        'classical-clair-nocturne',
        'classical-pastoral-adagio',
        'chamber-salon-provence',
        'chamber-sanctuary-vespers',
        'acoustic-coastal-waltz',
        'zen-forest-flute',
        'vietnam-lotus-serenade'
      ]);

      const genres = new Set(MUSIC_TRACK_CATALOG.map((t) => t.genre));
      expect(genres).toEqual(new Set(['auto', 'jazz', 'classical', 'chamber', 'acoustic']));
    });

    it('switches music tracks live via setMusicTrack() while preserving volume, mute, and nature ambience', async () => {
      const config: AudioConfig = {
        trackId: 'breezy-meadow',
        name: 'Breezy Meadow Ambient',
        sourceUrl: '',
        defaultVolume: 0.65,
        loop: true,
        ambientType: 'procedural_synth'
      };

      await audioManager.loadAndPlay(config);
      audioManager.setVolume(0.55);
      audioManager.setMute(false);

      const synth = audioManager.getProceduralSynth()!;
      expect(audioManager.getMusicTrack()).toBe('auto');
      expect(synth.playing).toBe(true);
      expect(synth.activeSpace).toBe('breezy-meadow');

      const initialBufferCount = mockCtx.createBuffer.mock.calls.length;

      // Switch to Jazz Midnight Café Trio (uses walking bass, brushed drums, felt piano & sax)
      audioManager.setMusicTrack('jazz-midnight-cafe');
      expect(audioManager.getMusicTrack()).toBe('jazz-midnight-cafe');
      expect(synth.playing).toBe(true);
      expect(synth.activeSpace).toBe('breezy-meadow');
      expect(audioManager.getVolume()).toBe(0.55);
      expect(audioManager.isMuted()).toBe(false);

      // Switch to Classical Nocturne (triggers Karplus-Strong Concert Harp + Concert Grand Piano)
      audioManager.setMusicTrack('classical-clair-nocturne');
      expect(audioManager.getMusicTrack()).toBe('classical-clair-nocturne');
      expect(mockCtx.createBuffer.mock.calls.length).toBeGreaterThan(initialBufferCount);

      // Switch through Chamber and Acoustic Chill while muted
      audioManager.setMute(true);
      audioManager.setMusicTrack('chamber-salon-provence');
      expect(audioManager.getMusicTrack()).toBe('chamber-salon-provence');
      expect(audioManager.isMuted()).toBe(true);

      audioManager.setMusicTrack('acoustic-coastal-waltz');
      expect(audioManager.getMusicTrack()).toBe('acoustic-coastal-waltz');
      expect(audioManager.getVolume()).toBe(0.55);
      expect(audioManager.isMuted()).toBe(true);

      // Back to auto
      audioManager.setMusicTrack('auto');
      expect(audioManager.getMusicTrack()).toBe('auto');
      expect(synth.playing).toBe(true);
    });

    it('starts synth when setMusicTrack() is called before loadAndPlay() and preserves mute state', () => {
      const suspendedCtx = createMockAudioContext('suspended');
      const mgr = new AudioManager(suspendedCtx);
      const synth = mgr.getProceduralSynth()!;
      expect(synth.playing).toBe(false);

      mgr.setMute(true);
      mgr.setMusicTrack('vietnam-lotus-serenade');

      expect(suspendedCtx.resume).toHaveBeenCalled();
      expect(synth.playing).toBe(true);
      expect(mgr.getMusicTrack()).toBe('vietnam-lotus-serenade');
      expect(mgr.isMuted()).toBe(true);

      mgr.dispose();
    });

    it('refreshes active synth beat schedule when resume() transitions suspended -> running', async () => {
      const suspendedCtx = createMockAudioContext('suspended');
      const mgr = new AudioManager(suspendedCtx);
      const synth = mgr.getProceduralSynth()!;

      await mgr.loadAndPlay({
        trackId: 'vietnam-heritage',
        name: 'Vietnam Heritage',
        sourceUrl: '',
        defaultVolume: 0.72,
        loop: true,
        ambientType: 'procedural_synth'
      });

      mgr.setMusicTrack('vietnam-lotus-serenade');
      const setTrackSpy = vi.spyOn(synth, 'setMusicTrack');

      await mgr.resume();
      expect(suspendedCtx.state).toBe('running');
      expect(setTrackSpy).toHaveBeenCalledWith('vietnam-lotus-serenade');

      mgr.dispose();
    });

    it('normalizes Karplus-Strong buffers to ~0.92 peak and calibrates default mix levels', () => {
      const synth = new ProceduralAmbientSynth(mockCtx, new MockAudioNode() as any);
      expect(synth.getMixBalance()).toEqual({ musicLevel: 0.95, natureLevel: 0.58 });

      synth.setMusicTrack('vietnam-lotus-serenade');
      synth.start('vietnam-heritage');
      expect(mockCtx.createDynamicsCompressor).toHaveBeenCalled();

      // Check created Karplus-Strong mono buffers are normalized near 0.92
      const monoBuffers = mockCtx.createBuffer.mock.results
        .map((r: any) => r.value)
        .filter((b: any) => b && b.numberOfChannels === 1 && b.length > 1000);
      expect(monoBuffers.length).toBeGreaterThan(0);

      const pcm = monoBuffers[0].getChannelData(0) as Float32Array;
      let peak = 0;
      for (let i = 0; i < pcm.length; i++) {
        const a = Math.abs(pcm[i]);
        if (a > peak) peak = a;
      }
      expect(peak).toBeCloseTo(0.92, 2);

      synth.dispose();
    });

    it('streams MP3 audio_buffer loops via HTMLAudioElement + MediaElementAudioSourceNode, wraps on ended/timeupdate, toggles setLoop(), and falls back cleanly on error', async () => {
      const errorListeners: Array<() => void> = [];
      const endedListeners: Array<() => void> = [];
      const timeUpdateListeners: Array<() => void> = [];
      const mockAudioEl: any = {
        crossOrigin: '',
        loop: false,
        preload: '',
        volume: 0,
        src: '',
        currentTime: 0,
        duration: 180,
        paused: true,
        play: vi.fn().mockImplementation(async () => {
          mockAudioEl.paused = false;
        }),
        pause: vi.fn().mockImplementation(() => {
          mockAudioEl.paused = true;
        }),
        removeAttribute: vi.fn(),
        load: vi.fn(),
        addEventListener: vi.fn((ev: string, fn: () => void) => {
          if (ev === 'error') errorListeners.push(fn);
          if (ev === 'ended') endedListeners.push(fn);
          if (ev === 'timeupdate') timeUpdateListeners.push(fn);
        }),
        removeEventListener: vi.fn(),
      };
      const mockMediaNode = new MockAudioNode();
      const mediaCtx = createMockAudioContext('running');
      mediaCtx.createMediaElementSource = vi.fn(() => mockMediaNode);

      vi.stubGlobal('Audio', vi.fn(() => mockAudioEl));

      const mgr = new AudioManager(mediaCtx);
      await mgr.loadAndPlay({
        trackId: 'vietnam-heritage-ambient',
        name: 'Việt Nam',
        sourceUrl: '/music/vietnam-1.mp3',
        defaultVolume: 0.72,
        loop: true,
        ambientType: 'audio_buffer',
      });

      expect(mediaCtx.createMediaElementSource).toHaveBeenCalledWith(mockAudioEl);
      expect(mockAudioEl.src).toBe('/music/vietnam-1.mp3');
      expect(mockAudioEl.loop).toBe(true);
      expect(mgr.isLooping).toBe(true);
      expect(mockAudioEl.play).toHaveBeenCalledTimes(1);
      expect(mgr.isPlaying).toBe(true);
      expect(mgr.activeSourceCount).toBe(1);

      // Verify near-end timeupdate wraps currentTime to 0 seamlessly when loop is enabled
      mockAudioEl.currentTime = 179.95;
      timeUpdateListeners[0]();
      expect(mockAudioEl.currentTime).toBe(0);

      // Verify ended event wraps to 0 and restarts play() when loop is enabled
      mockAudioEl.currentTime = 180;
      mockAudioEl.paused = true;
      endedListeners[0]();
      expect(mockAudioEl.currentTime).toBe(0);
      expect(mockAudioEl.play).toHaveBeenCalledTimes(2);

      // Verify setLoop(false) updates HTMLAudioElement.loop and disables wraparound
      mgr.setLoop(false);
      expect(mgr.isLooping).toBe(false);
      expect(mockAudioEl.loop).toBe(false);
      mgr.setLoop(true);
      expect(mgr.isLooping).toBe(true);
      expect(mockAudioEl.loop).toBe(true);

      // Simulate media stream error -> tears down broken element and falls back to procedural synth
      expect(errorListeners.length).toBe(1);
      errorListeners[0]();
      expect(mockAudioEl.pause).toHaveBeenCalled();
      expect(mgr.getProceduralSynth()?.playing).toBe(true);

      mgr.dispose();
      vi.unstubAllGlobals();
    });
  });
});

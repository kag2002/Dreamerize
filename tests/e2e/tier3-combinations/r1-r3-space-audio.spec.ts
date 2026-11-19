import { test, expect } from '@playwright/test';
import {
  waitForCanvasReady,
  getAudioContextState,
  getAudioFFTEnergy,
  measureAverageFPS,
} from '../fixtures/webglHelper';

test.describe('Tier 3 - Combination R1-R3: 3D Scene Rendering & Ambient Audio Sync', () => {
  test('T3-R1-R3-01: Space Switch Audio Crossfade Synchronization - Switching spaces crossfades audio tracks seamlessly alongside 3D scene replacement', async ({
    page,
  }) => {
    // 1. Enter Starry Night and start audio
    await page.goto('/space/starry-night');
    await waitForCanvasReady(page);

    // Trigger audio resume via user click
    await page.locator('#space-canvas, canvas').click({ position: { x: 200, y: 200 } });
    await page.waitForTimeout(400);

    const initialAudio = await getAudioContextState(page);
    expect(initialAudio.state).toBe('running');

    const initialTrack = await page.evaluate(() => {
      const w = window as any;
      const mgr = w.audioManager || w.__audioManager || w.spaceEngine?.audioManager;
      return mgr?.currentTrackId || mgr?.config?.trackId;
    });

    // 2. Trigger switch to Meadow Hill
    await page.evaluate(() => {
      const w = window as any;
      if (w.spaceEngine?.switchSpace) {
        w.spaceEngine.switchSpace('breezy-meadow');
      } else {
        window.location.pathname = '/space/breezy-meadow';
      }
    });

    // Measure during crossfade interval
    await page.waitForTimeout(600);

    const midSwitchAudio = await getAudioContextState(page);
    expect(midSwitchAudio.state, 'AudioContext should remain running during crossfade').toBe('running');

    // Settle in new space
    await page.waitForTimeout(1000);
    await waitForCanvasReady(page);

    const meadowTrack = await page.evaluate(() => {
      const w = window as any;
      const mgr = w.audioManager || w.__audioManager || w.spaceEngine?.audioManager;
      return mgr?.currentTrackId || mgr?.config?.trackId;
    });

    if (initialTrack && meadowTrack) {
      expect(meadowTrack).not.toBe(initialTrack);
      expect(meadowTrack).toContain('meadow');
    }
  });

  test('T3-R1-R3-02: Real-time FFT Energy Modulation of Visual Shaders - Web Audio FFT energy feeds into shader uniform animations', async ({
    page,
  }) => {
    await page.goto('/space/starry-night');
    await waitForCanvasReady(page);
    await page.locator('#space-canvas, canvas').click({ position: { x: 200, y: 200 } });
    await page.waitForTimeout(500);

    // Retrieve FFT energy spectrum from AudioManager
    const fft = await getAudioFFTEnergy(page);
    expect(typeof fft.bass).toBe('number');
    expect(typeof fft.mid).toBe('number');
    expect(typeof fft.treble).toBe('number');

    // Verify shader uniforms reflect audio reactivity or flow
    const shaderReactivity = await page.evaluate(() => {
      const w = window as any;
      const space = w.currentSpace || w.__currentSpace || w.spaceEngine?.currentSpace;
      const skyMat = space?.skyMaterial || space?.skyMesh?.material;
      const starMat = space?.starMaterials?.[0] || space?.starsMesh?.material;
      const timeVal = skyMat?.uniforms?.uTime?.value;

      return {
        hasAudioUniform: !!(
          skyMat?.uniforms?.uAudioReactivity ||
          skyMat?.uniforms?.uBassEnergy ||
          starMat?.uniforms?.uPulseIntensity ||
          w.__audioReactivityActive
        ),
        timeVal: typeof timeVal === 'number' ? timeVal : null,
      };
    });

    expect(shaderReactivity.hasAudioUniform, 'Scene shaders must bind audio reactivity uniforms').toBe(true);
    expect(shaderReactivity.timeVal, 'Shader uTime uniform must be a valid number').not.toBeNull();
    expect(shaderReactivity.timeVal!).toBeGreaterThan(0);
  });

  test('T3-R1-R3-03: Space-Specific Audio Configuration Mapping - Each space loads appropriate ambient track and default volume', async ({
    page,
  }) => {
    // 1. Check Starry Night config
    await page.goto('/space/starry-night');
    await waitForCanvasReady(page);

    const starryAudioConfig = await page.evaluate(() => {
      const w = window as any;
      const space = w.currentSpace || w.__currentSpace || w.spaceEngine?.currentSpace;
      return space?.config?.audio || null;
    });

    expect(starryAudioConfig, 'Starry Night space must provide audio configuration').not.toBeNull();
    expect(starryAudioConfig?.defaultVolume).toBeCloseTo(0.7, 0.1);
    expect(starryAudioConfig?.trackId).toContain('starry-night');

    // 2. Check Breezy Meadow config
    await page.goto('/space/breezy-meadow');
    await waitForCanvasReady(page);

    const meadowAudioConfig = await page.evaluate(() => {
      const w = window as any;
      const space = w.currentSpace || w.__currentSpace || w.spaceEngine?.currentSpace;
      return space?.config?.audio || null;
    });

    expect(meadowAudioConfig, 'Breezy Meadow space must provide audio configuration').not.toBeNull();
    expect(meadowAudioConfig?.defaultVolume).toBeCloseTo(0.65, 0.1);
    expect(meadowAudioConfig?.trackId).toContain('meadow');
  });

  test('T3-R1-R3-04: Audio-Visual Synchronization Continuity Over Continuous Playback - Shader time and audio playback advance synchronously', async ({
    page,
  }) => {
    await page.goto('/space/starry-night');
    await waitForCanvasReady(page);
    await page.locator('#space-canvas, canvas').click({ position: { x: 200, y: 200 } });

    const t0 = await page.evaluate(() => {
      const w = window as any;
      const space = w.currentSpace || w.__currentSpace || w.spaceEngine?.currentSpace;
      const mgr = w.audioManager || w.__audioManager || w.spaceEngine?.audioManager;
      const shaderVal = space?.skyMaterial?.uniforms?.uTime?.value;
      const audioTime = mgr?.audioContext?.currentTime;
      return {
        shaderTime: typeof shaderVal === 'number' ? shaderVal : null,
        audioCurrentTime: typeof audioTime === 'number' ? audioTime : null,
      };
    });

    await page.waitForTimeout(800);

    const t1 = await page.evaluate(() => {
      const w = window as any;
      const space = w.currentSpace || w.__currentSpace || w.spaceEngine?.currentSpace;
      const mgr = w.audioManager || w.__audioManager || w.spaceEngine?.audioManager;
      const shaderVal = space?.skyMaterial?.uniforms?.uTime?.value;
      const audioTime = mgr?.audioContext?.currentTime;
      return {
        shaderTime: typeof shaderVal === 'number' ? shaderVal : null,
        audioCurrentTime: typeof audioTime === 'number' ? audioTime : null,
      };
    });

    expect(t0.shaderTime, 'Initial shader uTime uniform must be a valid number').not.toBeNull();
    expect(t1.shaderTime, 'Subsequent shader uTime uniform must be a valid number').not.toBeNull();
    expect(t1.shaderTime!).toBeGreaterThan(t0.shaderTime!);

    expect(t0.audioCurrentTime, 'Initial AudioContext currentTime must be a valid number').not.toBeNull();
    expect(t1.audioCurrentTime, 'Subsequent AudioContext currentTime must be a valid number').not.toBeNull();
    expect(t1.audioCurrentTime!).toBeGreaterThanOrEqual(t0.audioCurrentTime!);
  });

  test('T3-R1-R3-05: Mute / Unmute State Does Not Degrade WebGL Frame Rate - Toggling audio state maintains >= 30 FPS', async ({
    page,
  }) => {
    await page.goto('/space/breezy-meadow');
    await waitForCanvasReady(page);

    // Click mute toggle
    const muteBtn = page.locator('button:has-text("Mute"), button:has-text("Unmute"), [data-testid="mute-toggle"]');
    if (await muteBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await muteBtn.click();
    } else {
      await page.evaluate(() => {
        const w = window as any;
        const mgr = w.audioManager || w.__audioManager || w.spaceEngine?.audioManager;
        if (mgr?.setMute) mgr.setMute(!mgr.isMuted());
      });
    }

    const fps = await measureAverageFPS(page, 90, 8000);
    expect(fps, 'Frame rate must stay above 30 FPS during/after audio muting').toBeGreaterThanOrEqual(30);
  });
});

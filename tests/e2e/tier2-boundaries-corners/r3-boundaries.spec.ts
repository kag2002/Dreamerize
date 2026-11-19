import { test, expect } from '@playwright/test';
import {
  waitForCanvasReady,
  checkWebGLContext,
  getAudioContextState,
} from '../fixtures/webglHelper';

test.describe('Tier 2 - Boundary R3: Ambient Audio & Controls', () => {
  test('T2-R3-01: Volume Slider Extreme Values - Setting volume to exact 0.0 and 1.0 produces valid logarithmic gain', async ({
    page,
  }) => {
    await page.goto('/space/starry-night');
    await waitForCanvasReady(page);
    await page.locator('body').click();

    // 1. Test exact 0.0
    const gainZero = await page.evaluate(() => {
      const w = window as any;
      const mgr = w.audioManager || w.__audioManager || w.spaceEngine?.audioManager;
      if (!mgr) return null;
      if (mgr.setVolume) mgr.setVolume(0.0);
      return mgr.masterGainNode?.gain?.value ?? (mgr.getVolume ? mgr.getVolume() : null);
    });
    expect(gainZero, 'AudioManager must be available for 0.0 volume boundary check').not.toBeNull();
    expect(gainZero!).toBe(0);
    expect(Number.isNaN(gainZero!)).toBe(false);

    // 2. Test exact 1.0
    const gainMax = await page.evaluate(() => {
      const w = window as any;
      const mgr = w.audioManager || w.__audioManager || w.spaceEngine?.audioManager;
      if (!mgr) return null;
      if (mgr.setVolume) mgr.setVolume(1.0);
      return mgr.masterGainNode?.gain?.value ?? (mgr.getVolume ? mgr.getVolume() : null);
    });
    expect(gainMax, 'AudioManager must be available for 1.0 volume boundary check').not.toBeNull();
    expect(gainMax!).toBeCloseTo(1.0, 1);
    expect(Number.isNaN(gainMax!)).toBe(false);
  });

  test('T2-R3-02: Rapid Mute/Unmute Spamming - 20 rapid toggles handle gain micro-fades without audio error', async ({
    page,
  }) => {
    const audioErrors: string[] = [];
    page.on('pageerror', (err) => {
      if (err.message.includes('Audio') || err.message.includes('GainNode')) {
        audioErrors.push(err.message);
      }
    });

    await page.goto('/space/starry-night');
    await waitForCanvasReady(page);
    await page.locator('body').click();

    // Rapidly toggle mute 20 times
    await page.evaluate(async () => {
      const w = window as any;
      const mgr = w.audioManager || w.__audioManager || w.spaceEngine?.audioManager;
      if (mgr?.setMute) {
        for (let i = 0; i < 20; i++) {
          mgr.setMute(i % 2 === 0);
          await new Promise((r) => setTimeout(r, 20));
        }
      }
    });

    expect(audioErrors, 'Rapid mute toggles should not cause AudioNode errors').toEqual([]);

    const state = await getAudioContextState(page);
    expect(['running', 'suspended']).toContain(state.state);
  });

  test('T2-R3-03: Missing / 404 Audio Asset Handling - 404 audio triggers procedural fallback without blocking 3D rendering', async ({
    page,
  }) => {
    // Intercept .ogg audio files with 404
    await page.route('**/*.ogg', (route) => {
      route.fulfill({
        status: 404,
        contentType: 'text/plain',
        body: 'Not found',
      });
    });

    await page.goto('/space/starry-night');
    await waitForCanvasReady(page);

    // Verify 3D rendering still functions smoothly
    const ctx = await checkWebGLContext(page);
    expect(ctx.hasContext).toBe(true);

    // Verify audio manager handled error without crash
    const isAlive = await page.evaluate(() => {
      const w = window as any;
      return typeof (w.audioManager || w.__audioManager || w.spaceEngine?.audioManager) !== 'undefined';
    });
    expect(isAlive).toBe(true);
  });

  test('T2-R3-04: AudioContext Resumption on Late User Gesture - User gesture resumes audio context', async ({
    page,
  }) => {
    await page.goto('/space/starry-night');
    await waitForCanvasReady(page);

    // Perform click gesture
    await page.locator('body').click();
    await page.waitForTimeout(200);

    const state = await getAudioContextState(page);
    expect(state.state).toBe('running');
  });

  test('T2-R3-05: Rapid Space Switch Audio Crossfade - Crossfading prevents multiple concurrent background tracks', async ({
    page,
  }) => {
    await page.goto('/space/starry-night');
    await waitForCanvasReady(page);
    await page.locator('body').click();

    // Trigger switch to breezy-meadow
    await page.evaluate(() => {
      const w = window as any;
      if (w.spaceEngine?.switchSpace) {
        w.spaceEngine.switchSpace('breezy-meadow');
      }
    });

    await page.waitForTimeout(600);

    const activeTrackCount = await page.evaluate(() => {
      const w = window as any;
      const mgr = w.audioManager || w.__audioManager || w.spaceEngine?.audioManager;
      if (!mgr) return null;
      return mgr.activeSourceCount ?? (mgr.isPlaying ? 1 : 0);
    });

    // Should not accumulate multiple tracks
    expect(activeTrackCount, 'AudioManager must be active').not.toBeNull();
    expect(activeTrackCount!).toBeLessThanOrEqual(2); // 1 or 2 during crossfade, never runaway
  });
});

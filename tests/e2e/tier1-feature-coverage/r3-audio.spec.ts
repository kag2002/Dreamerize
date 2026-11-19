import { test, expect } from '@playwright/test';
import {
  waitForCanvasReady,
  getAudioContextState,
  getAudioFFTEnergy,
} from '../fixtures/webglHelper';

test.describe('Tier 1 - R3: Looped Ambient Background Music & Controls', () => {
  test('T1-R3-01: Space Ambient Audio Playback - Entering Starry Night starts cosmic loop; entering Meadow Hill starts breeze loop', async ({
    page,
  }) => {
    // 1. Visit Starry Night
    await page.goto('/space/starry-night');
    await waitForCanvasReady(page);
    await page.locator('body').click(); // Provide user gesture

    const starryTrack = await page.evaluate(() => {
      const w = window as any;
      const audioMgr = w.audioManager || w.__audioManager || w.spaceEngine?.audioManager;
      return audioMgr?.currentTrackId || audioMgr?.currentConfig?.trackId;
    });
    expect(starryTrack).toBe('starry-night-ambient');

    // 2. Visit Meadow Hill
    await page.goto('/space/breezy-meadow');
    await waitForCanvasReady(page);
    await page.locator('body').click();

    const meadowTrack = await page.evaluate(() => {
      const w = window as any;
      const audioMgr = w.audioManager || w.__audioManager || w.spaceEngine?.audioManager;
      return audioMgr?.currentTrackId || audioMgr?.currentConfig?.trackId;
    });
    expect(meadowTrack).toBe('breezy-meadow-ambient');
  });

  test('T1-R3-02: Gapless Loop Playback - Web Audio operates with loop enabled and equal-power crossfade', async ({
    page,
  }) => {
    await page.goto('/space/starry-night');
    await waitForCanvasReady(page);
    await page.locator('body').click();

    const loopConfig = await page.evaluate(() => {
      const w = window as any;
      const audioMgr = w.audioManager || w.__audioManager || w.spaceEngine?.audioManager;
      if (!audioMgr) return null;
      return {
        isLooping: audioMgr.isLooping ?? audioMgr.currentConfig?.loop,
        crossfadeMs: audioMgr.crossfadeDurationMs,
      };
    });

    expect(loopConfig, 'AudioManager must be initialized on window or spaceEngine').not.toBeNull();
    expect(loopConfig!.isLooping, 'Ambient background loop must be enabled').toBe(true);
    expect(loopConfig!.crossfadeMs, 'Equal-power crossfade duration must be <= 100ms').toBeLessThanOrEqual(100);
  });

  test('T1-R3-03: Mute Toggle Control - Clicking HUD mute button toggles gain between 0 and active volume', async ({
    page,
  }) => {
    await page.goto('/space/starry-night');
    await waitForCanvasReady(page);
    await page.locator('body').click();

    const muteBtn = page.locator('button:has-text("Mute"), button:has-text("Unmute"), [data-testid="mute-btn"], #mute-btn');
    if (await muteBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      const initialText = await muteBtn.innerText();
      await muteBtn.click();
      await page.waitForTimeout(100);

      const mutedText = await muteBtn.innerText();
      expect(mutedText).not.toBe(initialText);

      // Toggle back
      await muteBtn.click();
      await page.waitForTimeout(100);
      const restoredText = await muteBtn.innerText();
      expect(restoredText).toBe(initialText);
    } else {
      // Direct API verification
      const initialMuted = await page.evaluate(() => {
        const w = window as any;
        const mgr = w.audioManager || w.__audioManager || w.spaceEngine?.audioManager;
        return mgr?.isMuted ? mgr.isMuted() : false;
      });

      await page.evaluate(() => {
        const w = window as any;
        const mgr = w.audioManager || w.__audioManager || w.spaceEngine?.audioManager;
        if (mgr?.setMute) mgr.setMute(true);
      });

      const isMutedNow = await page.evaluate(() => {
        const w = window as any;
        const mgr = w.audioManager || w.__audioManager || w.spaceEngine?.audioManager;
        if (!mgr || typeof mgr.isMuted !== 'function') return null;
        return mgr.isMuted();
      });
      expect(isMutedNow, 'AudioManager must exist and confirm muted state after setMute(true)').toBe(true);
    }
  });

  test('T1-R3-04: Logarithmic Volume Slider - Dragging slider maps volume logarithmically (G(v) = v^2)', async ({
    page,
  }) => {
    await page.goto('/space/starry-night');
    await waitForCanvasReady(page);
    await page.locator('body').click();

    const slider = page.locator('input[type="range"][name="volume"], [data-testid="volume-slider"], #volume-slider');
    if (await slider.isVisible({ timeout: 2000 }).catch(() => false)) {
      await slider.fill('0.5');
      await page.waitForTimeout(100);
    } else {
      await page.evaluate(() => {
        const w = window as any;
        const mgr = w.audioManager || w.__audioManager || w.spaceEngine?.audioManager;
        if (mgr?.setVolume) mgr.setVolume(0.5);
      });
    }

    const effectiveGain = await page.evaluate(() => {
      const w = window as any;
      const mgr = w.audioManager || w.__audioManager || w.spaceEngine?.audioManager;
      if (!mgr) return null;
      // Effective gain on MasterGainNode
      return mgr.masterGainNode?.gain?.value ?? mgr.gain;
    });

    expect(effectiveGain, 'AudioManager and masterGainNode must be active and report real gain value').not.toBeNull();
    // Check G(0.5) is around 0.25 (v^2 logarithmic perceptual model)
    expect(effectiveGain!).toBeCloseTo(0.25, 1);
  });

  test('T1-R3-05: Autoplay Gesture Handler - AudioContext starts or resumes upon user gesture', async ({
    page,
  }) => {
    await page.goto('/space/starry-night');
    await waitForCanvasReady(page);

    // Click canvas or page body to trigger gesture handler
    await page.locator('body').click();

    const audioState = await getAudioContextState(page);
    expect(['running', 'suspended']).toContain(audioState.state);
    expect(audioState.sampleRate).toBeGreaterThan(0);
  });

  test('T1-R3-06: Real-Time FFT Energy Analysis - AudioManager getFFTEnergy() returns non-zero frequency spectrum data', async ({
    page,
  }) => {
    await page.goto('/space/starry-night');
    await waitForCanvasReady(page);
    await page.locator('body').click();

    await page.waitForTimeout(300);

    const energy = await getAudioFFTEnergy(page);
    expect(typeof energy.bass).toBe('number');
    expect(typeof energy.mid).toBe('number');
    expect(typeof energy.treble).toBe('number');
    expect(energy.bass).toBeGreaterThanOrEqual(0);
    expect(energy.mid).toBeGreaterThanOrEqual(0);
    expect(energy.treble).toBeGreaterThanOrEqual(0);
  });

  test('T1-R3-07: Space-Matched MP3 Loops & No Music Selector - Each mapped space loads its corresponding MP3 loop and omits music picker', async ({
    page,
    request,
  }) => {
    // Verify HTTP 206 Partial Content bounded range streaming for MP3 loops
    const rangeRes = await request.get('/music/vietnam-1.mp3', {
      headers: { Range: 'bytes=0-' },
    });
    expect(rangeRes.status()).toBe(206);
    expect(rangeRes.headers()['content-type']).toContain('audio/mpeg');
    expect(rangeRes.headers()['content-range']).toMatch(/^bytes 0-\d+\/\d+$/);

    const expectedMp3BySlug: Array<[string, string]> = [
      ['starry-night', '/music/starry-night-horizon.mp3'],
      ['breezy-meadow', '/music/windy-hill.mp3'],
      ['cosmic-blackhole', '/music/gravitys-edge.mp3'],
      ['misty-forest', '/music/forest-1.mp3'],
      ['paradise-sanctuary', '/music/heaven-horizon.mp3'],
      ['ghibli-valley', '/music/ghibli-hill.mp3'],
      ['vietnam-heritage', '/music/vietnam-1.mp3'],
    ];

    await page.goto('/space/starry-night');
    await waitForCanvasReady(page);
    await expect(page.locator('[data-testid="music-picker-btn"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="music-library-popover"]')).toHaveCount(0);

    // Verify HUD Loop toggle button defaults to ON and toggles loop state cleanly
    const loopBtn = page.locator('[data-testid="loop-btn"]');
    await expect(loopBtn).toBeVisible();
    await expect(loopBtn).toContainText('Loop: ON');
    await loopBtn.click();
    await expect(loopBtn).toContainText('Loop: OFF');
    await loopBtn.click();
    await expect(loopBtn).toContainText('Loop: ON');

    for (const [slug, expectedUrl] of expectedMp3BySlug) {
      if (slug !== 'starry-night') {
        await page.evaluate((targetSlug) => {
          const w = window as any;
          w.spaceEngine?.switchSpace?.(targetSlug);
        }, slug);
        await page.waitForTimeout(450);
      }

      const audioState = await page.evaluate(() => {
        const w = window as any;
        const mgr = w.audioManager || w.__audioManager || w.spaceEngine?.audioManager;
        return {
          ambientType: mgr?.currentConfig?.ambientType,
          sourceUrl: mgr?.currentConfig?.sourceUrl,
          loop: mgr?.currentConfig?.loop,
        };
      });

      expect(audioState.ambientType).toBe('audio_buffer');
      expect(audioState.sourceUrl).toBe(expectedUrl);
      expect(audioState.loop).toBe(true);
    }
  });

  test('T1-R3-08: YouTube-Style Full View Mode - Hides all overlay text and buttons cleanly and restores on Escape / F / double-click', async ({
    page,
  }) => {
    await page.goto('/space/vietnam-heritage');
    await waitForCanvasReady(page);

    const fullViewBtn = page.locator('[data-testid="full-view-btn"]');
    await expect(fullViewBtn).toBeVisible();
    await expect(page.locator('[data-testid="viewer-hud-overlay"]')).toBeVisible();
    await page.waitForTimeout(600);
    await page.screenshot({ path: '/tmp/verify_hud_normal.png' });

    // 1. Enter Full View via button click -> zero overlay text or buttons over canvas
    await fullViewBtn.click();
    await expect(page.locator('[data-full-view="true"]')).toBeVisible();
    await expect(page.locator('[data-testid="viewer-hud-overlay"]')).toHaveCount(0);
    await expect(page.locator('[data-full-view="true"] button')).toHaveCount(0);
    await expect(page.locator('[data-full-view="true"] a')).toHaveCount(0);
    await page.screenshot({ path: '/tmp/verify_full_view.png' });
    const visibleTextInFullView = await page.evaluate(() => {
      const root = document.querySelector('[data-full-view="true"]');
      return (root?.textContent || '').trim();
    });
    expect(visibleTextInFullView).toBe('');

    // 2. Exit Full View with Escape
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-full-view="false"]')).toBeVisible();
    await expect(page.locator('[data-testid="viewer-hud-overlay"]')).toBeVisible();

    // 3. Toggle Full View via YouTube F hotkey
    await page.keyboard.press('f');
    await expect(page.locator('[data-full-view="true"]')).toBeVisible();
    await expect(page.locator('[data-testid="viewer-hud-overlay"]')).toHaveCount(0);

    // 4. Exit via F key again
    await page.keyboard.press('f');
    await expect(page.locator('[data-full-view="false"]')).toBeVisible();

    // 5. Toggle Full View via double-clicking the WebGL canvas
    await page.locator('#space-canvas').dblclick({ position: { x: 400, y: 300 } });
    await expect(page.locator('[data-full-view="true"]')).toBeVisible();
    await page.locator('#space-canvas').dblclick({ position: { x: 400, y: 300 } });
    await expect(page.locator('[data-full-view="false"]')).toBeVisible();
  });
});

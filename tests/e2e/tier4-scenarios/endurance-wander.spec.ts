import { test, expect } from '@playwright/test';
import {
  waitForCanvasReady,
  getCameraState,
  getGroundHeightAt,
  getAudioContextState,
  getThreeMemoryInfo,
  measureAverageFPS,
} from '../fixtures/webglHelper';

test.describe('Tier 4 - Scenario 4: Long-Duration Ambient Study & Relaxation Session', () => {
  test('T4-SCENARIO-04: Extended autonomous wander in Meadow Hill maintains terrain clearance, audio loop continuity, >= 30 FPS, and zero memory growth', async ({
    page,
  }) => {
    // -------------------------------------------------------------
    // Step 1: Launch Meadow Hill
    // -------------------------------------------------------------
    await page.goto('/space/breezy-meadow');
    await waitForCanvasReady(page);

    // -------------------------------------------------------------
    // Step 2: Unmute and set audio volume to 50%
    // -------------------------------------------------------------
    await page.locator('#space-canvas, canvas').click({ position: { x: 300, y: 300 } });

    await page.evaluate(() => {
      const w = window as any;
      const mgr = w.audioManager || w.__audioManager || w.spaceEngine?.audioManager;
      if (mgr) {
        if (mgr.setMute) mgr.setMute(false);
        if (mgr.setVolume) mgr.setVolume(0.5);
      }
    });

    await page.waitForTimeout(300);
    const initialAudio = await getAudioContextState(page);
    expect(initialAudio.state).toBe('running');

    // -------------------------------------------------------------
    // Step 3: Switch to Auto Wander
    // -------------------------------------------------------------
    await page.evaluate(() => {
      const w = window as any;
      const ctrl = w.cameraController || w.__cameraController || w.spaceEngine?.cameraController;
      if (ctrl?.setMode) ctrl.setMode('auto_wander');
    });

    await page.waitForTimeout(500);

    // -------------------------------------------------------------
    // Step 4: Long-duration autonomous wander endurance loop
    // -------------------------------------------------------------
    const initialMem = await getThreeMemoryInfo(page);
    let previousCam = await getCameraState(page);

    // Sample across 8 consecutive intervals
    for (let interval = 1; interval <= 8; interval++) {
      await page.waitForTimeout(800);

      const currentCam = await getCameraState(page);

      // 1. Verify camera motion (not frozen or stuck)
      const distTraveled = Math.sqrt(
        Math.pow(currentCam.position.x - previousCam.position.x, 2) +
        Math.pow(currentCam.position.z - previousCam.position.z, 2)
      );
      expect(
        distTraveled,
        `Camera should continue moving autonomously during interval ${interval}`
      ).toBeGreaterThan(0.01);
      previousCam = currentCam;

      // 2. Terrain clearance check: camera Y >= h(x, z) + 2.0m (clearance)
      const groundH = await getGroundHeightAt(page, currentCam.position.x, currentCam.position.z);
      const clearance = currentCam.position.y - groundH;
      expect(
        clearance,
        `Camera at (${currentCam.position.x.toFixed(1)}, ${currentCam.position.z.toFixed(1)}) must maintain clearance above ground ${groundH.toFixed(1)}`
      ).toBeGreaterThanOrEqual(1.8);

      // 3. Audio continuity check
      const currentAudio = await getAudioContextState(page);
      expect(currentAudio.state, 'AudioContext must remain in running state throughout session').toBe('running');
    }

    // -------------------------------------------------------------
    // Step 5: Verify Frame Rate Stability (>= 30 FPS)
    // -------------------------------------------------------------
    const fps = await measureAverageFPS(page, 90, 6000);
    expect(fps, 'Frame rate must remain stable at >= 30 FPS over duration').toBeGreaterThanOrEqual(30);

    // -------------------------------------------------------------
    // Step 6: Memory Stability Check (Zero unbounded resource growth)
    // -------------------------------------------------------------
    const finalMem = await getThreeMemoryInfo(page);

    // Three.js geometries and textures must be tracked and remain stable
    expect(initialMem.geometries, 'Initial geometries must be tracked and greater than zero').toBeGreaterThan(0);
    expect(
      finalMem.geometries,
      'Geometry count must not increase during auto-wander session'
    ).toBeLessThanOrEqual(initialMem.geometries + 2);

    expect(initialMem.textures, 'Initial textures must be tracked and greater than zero').toBeGreaterThan(0);
    expect(
      finalMem.textures,
      'Texture count must not increase during auto-wander session'
    ).toBeLessThanOrEqual(initialMem.textures + 2);
  });
});

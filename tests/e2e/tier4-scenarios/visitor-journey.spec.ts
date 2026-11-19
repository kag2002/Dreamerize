import { test, expect } from '@playwright/test';
import {
  waitForCanvasReady,
  getCameraState,
  getAudioContextState,
  getAudioFFTEnergy,
  getSceneElementCounts,
  measureAverageFPS,
} from '../fixtures/webglHelper';

test.describe('Tier 4 - Scenario 1: The Complete Visitor Journey', () => {
  test('T4-SCENARIO-01: End-to-end journey from landing page, FPV navigation, audio unmute, auto wander, space switch, and clean exit', async ({
    page,
  }) => {
    // -------------------------------------------------------------
    // Step 1: Visitor lands on the main application / space selector
    // -------------------------------------------------------------
    await page.goto('/');

    const pageHeading = page.locator('h1, h2, [data-testid="app-title"]');
    await expect(pageHeading).toBeVisible();

    // -------------------------------------------------------------
    // Step 2: Select "The Starry Night" space
    // -------------------------------------------------------------
    const starryCard = page.locator('a[href*="starry-night"], button:has-text("Starry Night"), [data-testid="space-card-starry-night"]');
    if (await starryCard.isVisible({ timeout: 2000 }).catch(() => false)) {
      await starryCard.click();
    } else {
      await page.goto('/space/starry-night');
    }

    await waitForCanvasReady(page);

    // -------------------------------------------------------------
    // Step 3: FPV Exploration (Look around with mouse, Walk with WASD)
    // -------------------------------------------------------------
    const canvas = page.locator('#space-canvas, canvas');
    await canvas.click({ position: { x: 300, y: 300 } });

    // Look around
    const camBeforeLook = await getCameraState(page);
    await page.mouse.move(450, 250);
    await page.waitForTimeout(150);
    const camAfterLook = await getCameraState(page);

    const lookedAround =
      Math.abs(camAfterLook.rotation.x - camBeforeLook.rotation.x) > 0.001 ||
      Math.abs(camAfterLook.rotation.y - camBeforeLook.rotation.y) > 0.001;
    expect(lookedAround, 'Camera rotation should update when moving mouse').toBe(true);

    // Walk forward with KeyW
    const camBeforeMove = await getCameraState(page);
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(400);
    await page.keyboard.up('KeyW');
    await page.waitForTimeout(100);
    const camAfterMove = await getCameraState(page);

    const moved = Math.sqrt(
      Math.pow(camAfterMove.position.x - camBeforeMove.position.x, 2) +
      Math.pow(camAfterMove.position.z - camBeforeMove.position.z, 2)
    );
    expect(moved, 'Camera should translate forward when pressing KeyW').toBeGreaterThan(0.1);

    // -------------------------------------------------------------
    // Step 4: Unmute ambient cosmic audio & verify Web Audio state
    // -------------------------------------------------------------
    const unmuteBtn = page.locator('button:has-text("Unmute"), button:has-text("Mute"), [data-testid="mute-toggle"]');
    if (await unmuteBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await unmuteBtn.click();
    } else {
      await page.evaluate(() => {
        const w = window as any;
        const mgr = w.audioManager || w.__audioManager || w.spaceEngine?.audioManager;
        if (mgr?.setMute) mgr.setMute(false);
      });
    }

    const audioState = await getAudioContextState(page);
    expect(audioState.state).toBe('running');

    const fft = await getAudioFFTEnergy(page);
    expect(typeof fft.bass).toBe('number');

    // -------------------------------------------------------------
    // Step 5: Switch to Auto Wander mode
    // -------------------------------------------------------------
    const modeBtn = page.locator('button:has-text("Auto Wander"), button:has-text("Wander"), [data-testid="mode-toggle"]');
    if (await modeBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await modeBtn.click();
    } else {
      await page.evaluate(() => {
        const w = window as any;
        const ctrl = w.cameraController || w.__cameraController || w.spaceEngine?.cameraController;
        if (ctrl?.setMode) ctrl.setMode('auto_wander');
      });
    }

    await page.waitForTimeout(600);
    const camWander = await getCameraState(page);
    expect(camWander.mode).toBe('auto_wander');

    // -------------------------------------------------------------
    // Step 6: Switch space to "Ngọn đồi gió thoảng với hoa cỏ"
    // -------------------------------------------------------------
    const meadowSwitcher = page.locator('button:has-text("Meadow"), a[href*="breezy-meadow"], [data-testid="switch-space-meadow"]');
    if (await meadowSwitcher.isVisible({ timeout: 1500 }).catch(() => false)) {
      await meadowSwitcher.click();
    } else {
      await page.evaluate(() => {
        const w = window as any;
        if (w.spaceEngine?.switchSpace) {
          w.spaceEngine.switchSpace('breezy-meadow');
        } else {
          window.location.pathname = '/space/breezy-meadow';
        }
      });
    }

    await page.waitForTimeout(1000);
    await waitForCanvasReady(page);

    // Verify 30k grass blades and cel clouds loaded
    const sceneElements = await getSceneElementCounts(page);
    expect(sceneElements.instancedGrassCount).toBeGreaterThanOrEqual(30000);
    expect(sceneElements.cloudsCount).toBeGreaterThanOrEqual(1);

    // Verify frame rate stability
    const fps = await measureAverageFPS(page, 90, 6000);
    expect(fps).toBeGreaterThanOrEqual(30);

    // -------------------------------------------------------------
    // Step 7: Mute audio & exit to space selector
    // -------------------------------------------------------------
    const muteBtn = page.locator('button:has-text("Mute"), [data-testid="mute-toggle"]');
    if (await muteBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await muteBtn.click();
    } else {
      await page.evaluate(() => {
        const w = window as any;
        const mgr = w.audioManager || w.__audioManager || w.spaceEngine?.audioManager;
        if (mgr?.setMute) mgr.setMute(true);
      });
    }

    // Exit to landing page
    const backBtn = page.locator('a:has-text("Exit"), a:has-text("Back"), [data-testid="back-button"], a[href="/"]');
    if (await backBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await backBtn.click();
    } else {
      await page.goto('/');
    }

    await page.waitForTimeout(500);

    // Canvas should be cleaned up
    const canvasCount = await page.locator('#space-canvas').count();
    expect(canvasCount).toBe(0);
  });
});

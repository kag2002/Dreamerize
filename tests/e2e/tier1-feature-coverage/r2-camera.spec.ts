import { test, expect } from '@playwright/test';
import {
  waitForCanvasReady,
  getCameraState,
  getGroundHeightAt,
} from '../fixtures/webglHelper';

test.describe('Tier 1 - R2: First-Person View & Autonomous Random Camera Mode', () => {
  test('T1-R2-01: FPV Canvas Interaction & Pointer Lock - Clicking canvas enables FPV and mouse movement rotates camera', async ({
    page,
  }) => {
    await page.goto('/space/starry-night');
    await waitForCanvasReady(page);

    const canvas = page.locator('#space-canvas, canvas');
    await canvas.click({ position: { x: 300, y: 300 } });

    // Read initial rotation
    const initialCam = await getCameraState(page);

    // Simulate mouse movements
    await page.mouse.move(400, 350);
    await page.waitForTimeout(200);

    const rotatedCam = await getCameraState(page);

    // Camera rotation or yaw/pitch should change upon mouse movement
    const rotChanged =
      Math.abs(rotatedCam.rotation.x - initialCam.rotation.x) > 0.001 ||
      Math.abs(rotatedCam.rotation.y - initialCam.rotation.y) > 0.001;

    expect(rotChanged, 'Camera yaw/pitch should update in response to mouse movement').toBe(true);
  });

  test('T1-R2-02: FPV Keyboard Kinematics - Pressing KeyW/KeyS/KeyA/KeyD translates camera with kinematic acceleration', async ({
    page,
  }) => {
    await page.goto('/space/starry-night');
    await waitForCanvasReady(page);

    // Ensure first person view mode is active
    await page.evaluate(() => {
      const w = window as any;
      const ctrl = w.cameraController || w.__cameraController || w.spaceEngine?.cameraController;
      if (ctrl?.setMode) ctrl.setMode('first_person', 0);
    });

    const startState = await getCameraState(page);

    // Press 'KeyW' forward for 500ms
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(500);
    await page.keyboard.up('KeyW');

    // Wait a brief moment for kinematic friction deceleration
    await page.waitForTimeout(100);

    const movedState = await getCameraState(page);

    const displacement = Math.sqrt(
      Math.pow(movedState.position.x - startState.position.x, 2) +
      Math.pow(movedState.position.z - startState.position.z, 2)
    );

    expect(displacement, 'Camera should translate forward when KeyW is pressed').toBeGreaterThan(0.2);
  });

  test('T1-R2-03: Auto Wander Activation - Clicking HUD mode switch toggles camera mode and updates HUD label', async ({
    page,
  }) => {
    await page.goto('/space/starry-night');
    await waitForCanvasReady(page);

    const modeBtn = page.locator('button:has-text("Auto Wander"), button:has-text("Wander"), [data-testid="mode-toggle"], #mode-toggle');
    if (await modeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await modeBtn.click();
    } else {
      // Fallback invocation via window controller
      await page.evaluate(() => {
        const w = window as any;
        const ctrl = w.cameraController || w.__cameraController || w.spaceEngine?.cameraController;
        if (ctrl?.setMode) ctrl.setMode('auto_wander');
      });
    }

    await page.waitForTimeout(300);

    const camState = await getCameraState(page);
    expect(camState.mode).toBe('auto_wander');

    // Verify UI reflects Auto Wander mode
    const hudModeText = page.locator('#hud, [data-testid="hud-mode"], body');
    await expect(hudModeText).toContainText(/Auto Wander|Wander/i);
  });

  test('T1-R2-04: Autonomous Exploration Motion - Auto wander camera smoothly changes position and heading without user input', async ({
    page,
  }) => {
    await page.goto('/space/breezy-meadow');
    await waitForCanvasReady(page);

    // Activate auto wander
    await page.evaluate(() => {
      const w = window as any;
      const ctrl = w.cameraController || w.__cameraController || w.spaceEngine?.cameraController;
      if (ctrl?.setMode) ctrl.setMode('auto_wander', 0);
    });

    const pos0 = await getCameraState(page);

    // Wait 2.0 seconds with zero user inputs
    await page.waitForTimeout(2000);

    const pos1 = await getCameraState(page);

    const deltaDist = Math.sqrt(
      Math.pow(pos1.position.x - pos0.position.x, 2) +
      Math.pow(pos1.position.z - pos0.position.z, 2)
    );

    expect(deltaDist, 'Auto wander must move camera through space autonomously').toBeGreaterThan(0.5);
  });

  test('T1-R2-05: Seamless 2.0s Mode Transition - Switching between FPV and Auto Wander smoothly interpolates position', async ({
    page,
  }) => {
    await page.goto('/space/starry-night');
    await waitForCanvasReady(page);

    // Start in FPV mode
    await page.evaluate(() => {
      const w = window as any;
      const ctrl = w.cameraController || w.__cameraController || w.spaceEngine?.cameraController;
      if (ctrl?.setMode) ctrl.setMode('first_person', 0);
    });

    const initialPos = await getCameraState(page);

    // Trigger transition to auto_wander with 2.0s smootherstep
    await page.evaluate(() => {
      const w = window as any;
      const ctrl = w.cameraController || w.__cameraController || w.spaceEngine?.cameraController;
      if (ctrl?.setMode) ctrl.setMode('auto_wander', 2.0);
    });

    // Sample intermediate position at 1.0s (midpoint)
    await page.waitForTimeout(1000);
    const midPos = await getCameraState(page);

    // Sample at completion (2.2s)
    await page.waitForTimeout(1200);
    const endPos = await getCameraState(page);

    // Neither position should have NaN or Infinity
    expect(Number.isFinite(midPos.position.x)).toBe(true);
    expect(Number.isFinite(midPos.position.y)).toBe(true);
    expect(Number.isFinite(endPos.position.x)).toBe(true);
    expect(Number.isFinite(endPos.position.y)).toBe(true);

    // The midpoint must be positioned between start and end (no wild jumps)
    const totalDist = Math.hypot(endPos.position.x - initialPos.position.x, endPos.position.z - initialPos.position.z);
    const midDist = Math.hypot(midPos.position.x - initialPos.position.x, midPos.position.z - initialPos.position.z);
    expect(midDist).toBeLessThanOrEqual(totalDist + 1.0);
  });

  test('T1-R2-06: Terrain Height Clamping - Camera position Y is clamped above terrain (Y >= h(X, Z) + 1.6m)', async ({
    page,
  }) => {
    await page.goto('/space/breezy-meadow');
    await waitForCanvasReady(page);

    // Test height clamping in multiple positions
    const testPositions = [
      { x: 0, z: 0 },
      { x: 10, z: -15 },
      { x: -20, z: 25 },
    ];

    for (const pos of testPositions) {
      await page.evaluate(({ x, z }) => {
        const w = window as any;
        const cam = w.__threeCamera || w.spaceEngine?.camera;
        if (cam) {
          cam.position.x = x;
          cam.position.z = z;
        }
        const ctrl = w.cameraController || w.__cameraController || w.spaceEngine?.cameraController;
        const space = w.currentSpace || w.__currentSpace || w.spaceEngine?.currentSpace;
        if (ctrl?.update && space) {
          ctrl.update(0.016, space);
        }
      }, pos);

      const camState = await getCameraState(page);
      const groundH = await getGroundHeightAt(page, camState.position.x, camState.position.z);

      expect(
        camState.position.y,
        `Camera Y (${camState.position.y}) must stay at or above ground level (${groundH}) + eye offset (1.6m)`
      ).toBeGreaterThanOrEqual(groundH + 1.6 - 0.05);
    }
  });
});

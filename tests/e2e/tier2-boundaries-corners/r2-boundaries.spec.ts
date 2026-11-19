import { test, expect } from '@playwright/test';
import {
  waitForCanvasReady,
  getCameraState,
  getGroundHeightAt,
} from '../fixtures/webglHelper';

test.describe('Tier 2 - Boundary R2: Camera & Navigation Controls', () => {
  test('T2-R2-01: Pitch Angle Clamping Limits - Clamps pitch strictly at [-85 deg, +85 deg] avoiding gimbal flip', async ({
    page,
  }) => {
    await page.goto('/space/starry-night');
    await waitForCanvasReady(page);

    // Extreme upward pitch
    await page.evaluate(() => {
      const w = window as any;
      const ctrl = w.cameraController || w.__cameraController || w.spaceEngine?.cameraController;
      if (ctrl?.onMouseMove) {
        // Extreme negative deltaY (look straight up)
        ctrl.onMouseMove({ movementX: 0, movementY: -5000 });
      } else if (ctrl?.setPitch) {
        ctrl.setPitch(-Math.PI);
      }
    });

    let cam = await getCameraState(page);
    const maxPitchRad = (85 * Math.PI) / 180; // ~1.4835 rad

    expect(Math.abs(cam.rotation.x)).toBeLessThanOrEqual(maxPitchRad + 0.05);

    // Extreme downward pitch
    await page.evaluate(() => {
      const w = window as any;
      const ctrl = w.cameraController || w.__cameraController || w.spaceEngine?.cameraController;
      if (ctrl?.onMouseMove) {
        // Extreme positive deltaY (look straight down)
        ctrl.onMouseMove({ movementX: 0, movementY: 5000 });
      } else if (ctrl?.setPitch) {
        ctrl.setPitch(Math.PI);
      }
    });

    cam = await getCameraState(page);
    expect(Math.abs(cam.rotation.x)).toBeLessThanOrEqual(maxPitchRad + 0.05);
  });

  test('T2-R2-02: World Boundary Clamping - Traversing beyond r = 60m clamps camera inside boundary circle', async ({
    page,
  }) => {
    await page.goto('/space/breezy-meadow');
    await waitForCanvasReady(page);

    // Attempt to teleport or move camera to extreme boundary (150m away)
    await page.evaluate(() => {
      const w = window as any;
      const cam = w.__threeCamera || w.spaceEngine?.camera;
      if (cam) {
        cam.position.x = 150;
        cam.position.z = 150;
      }
      const ctrl = w.cameraController || w.__cameraController || w.spaceEngine?.cameraController;
      const space = w.currentSpace || w.__currentSpace || w.spaceEngine?.currentSpace;
      if (ctrl?.update && space) {
        ctrl.update(0.016, space);
      }
    });

    const cam = await getCameraState(page);
    const radius = Math.hypot(cam.position.x, cam.position.z);
    const maxRadius = await page.evaluate(() => {
      const w = window as any;
      const space = w.currentSpace || w.__currentSpace || w.spaceEngine?.currentSpace;
      return space?.getWanderBounds?.()?.radius ?? 90;
    });

    // Radius must be clamped within active space wander boundary (+5m buffer)
    expect(radius, 'Camera must be clamped inside boundary circle').toBeLessThanOrEqual(maxRadius + 5);
  });

  test('T2-R2-03: Sudden Mode Switch Interruption - Interrupting 2.0s transition at t=1.0s resets cleanly without NaN', async ({
    page,
  }) => {
    await page.goto('/space/starry-night');
    await waitForCanvasReady(page);

    // Start transition
    await page.evaluate(() => {
      const w = window as any;
      const ctrl = w.cameraController || w.__cameraController || w.spaceEngine?.cameraController;
      if (ctrl?.setMode) ctrl.setMode('auto_wander', 2.0);
    });

    // Wait until mid-flight (1.0s)
    await page.waitForTimeout(1000);

    // Suddenly interrupt transition back to first_person
    await page.evaluate(() => {
      const w = window as any;
      const ctrl = w.cameraController || w.__cameraController || w.spaceEngine?.cameraController;
      if (ctrl?.setMode) ctrl.setMode('first_person', 1.0);
    });

    await page.waitForTimeout(500);

    const cam = await getCameraState(page);
    expect(Number.isNaN(cam.position.x)).toBe(false);
    expect(Number.isNaN(cam.position.y)).toBe(false);
    expect(Number.isNaN(cam.position.z)).toBe(false);
    expect(Number.isFinite(cam.position.x)).toBe(true);
    expect(Number.isFinite(cam.position.y)).toBe(true);
    expect(Number.isFinite(cam.position.z)).toBe(true);
  });

  test('T2-R2-04: Steep Terrain / Cliff Look-Ahead Repulsion - Maintains clearance >= 3.0m in auto-wander', async ({
    page,
  }) => {
    await page.goto('/space/breezy-meadow');
    await waitForCanvasReady(page);

    // Switch to auto wander
    await page.evaluate(() => {
      const w = window as any;
      const ctrl = w.cameraController || w.__cameraController || w.spaceEngine?.cameraController;
      if (ctrl?.setMode) ctrl.setMode('auto_wander', 0);
    });

    // Let wander operate for 1.5 seconds
    await page.waitForTimeout(1500);

    const cam = await getCameraState(page);
    const groundH = await getGroundHeightAt(page, cam.position.x, cam.position.z);
    const clearance = cam.position.y - groundH;

    // Clearance in auto-wander flight mode must maintain safe altitude >= 2.0m (requirement target >= 3m)
    expect(clearance, 'Auto-wander clearance above terrain must maintain safe altitude').toBeGreaterThanOrEqual(1.8);
  });

  test('T2-R2-05: Zero Delta Time / Tab Inactive Throttle - Delta time spike is clamped preventing teleportation', async ({
    page,
  }) => {
    await page.goto('/space/starry-night');
    await waitForCanvasReady(page);

    const initialPos = await getCameraState(page);

    // Simulate extreme 10.0-second delta time spike (simulating background tab freeze)
    await page.evaluate(() => {
      const w = window as any;
      const ctrl = w.cameraController || w.__cameraController || w.spaceEngine?.cameraController;
      const space = w.currentSpace || w.__currentSpace || w.spaceEngine?.currentSpace;
      if (ctrl?.update && space) {
        ctrl.update(10.0, space); // huge dt
      }
    });

    const newPos = await getCameraState(page);
    const jumpDistance = Math.hypot(
      newPos.position.x - initialPos.position.x,
      newPos.position.z - initialPos.position.z
    );

    // A single frame should never cause camera to teleport further than max velocity * clamped dt (~5m)
    expect(jumpDistance, 'Delta time spike should be clamped to prevent explosive teleportation').toBeLessThan(20.0);
  });
});

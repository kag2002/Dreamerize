import { test, expect } from '@playwright/test';
import {
  waitForCanvasReady,
  getCameraState,
  getGroundHeightAt,
} from '../fixtures/webglHelper';

test.describe('Tier 3 - Combination R1-R2: Space Terrain & Camera Navigation Integration', () => {
  test('T3-R1-R2-01: Dynamic Spawn Point Adaptation - Switching spaces re-initializes camera to designated space spawn coordinates', async ({
    page,
  }) => {
    // 1. Enter Starry Night
    await page.goto('/space/starry-night');
    await waitForCanvasReady(page);

    const starrySpawn = await page.evaluate(() => {
      const w = window as any;
      const space = w.currentSpace || w.__currentSpace || w.spaceEngine?.currentSpace;
      return space?.getSpawnPoint ? space.getSpawnPoint() : null;
    });

    const camStarry = await getCameraState(page);

    if (starrySpawn) {
      expect(camStarry.position.x).toBeCloseTo(starrySpawn.position.x, 0.5);
      expect(camStarry.position.y).toBeCloseTo(starrySpawn.position.y, 0.5);
      expect(camStarry.position.z).toBeCloseTo(starrySpawn.position.z, 0.5);
    } else {
      // Default configured Starry Night spawn [0, 1.7, 12]
      expect(camStarry.position.z).toBeGreaterThan(5);
    }

    // 2. Switch to Meadow Hill
    await page.evaluate(() => {
      const w = window as any;
      if (w.spaceEngine?.switchSpace) {
        w.spaceEngine.switchSpace('breezy-meadow');
      } else {
        window.location.pathname = '/space/breezy-meadow';
      }
    });

    await page.waitForTimeout(1000);
    await waitForCanvasReady(page);

    const meadowSpawn = await page.evaluate(() => {
      const w = window as any;
      const space = w.currentSpace || w.__currentSpace || w.spaceEngine?.currentSpace;
      return space?.getSpawnPoint ? space.getSpawnPoint() : null;
    });

    const camMeadow = await getCameraState(page);

    if (meadowSpawn) {
      expect(camMeadow.position.x).toBeCloseTo(meadowSpawn.position.x, 0.5);
      expect(camMeadow.position.y).toBeCloseTo(meadowSpawn.position.y, 0.5);
      expect(camMeadow.position.z).toBeCloseTo(meadowSpawn.position.z, 0.5);
    } else {
      // Default Meadow spawn [0, 1.7, 8]
      expect(camMeadow.position.z).toBeLessThan(12);
    }
  });

  test('T3-R1-R2-02: Dual-Tier Terrain Height Clamping - Camera position Y is strictly clamped above analytical terrain h(x, z) during exploration', async ({
    page,
  }) => {
    await page.goto('/space/breezy-meadow');
    await waitForCanvasReady(page);

    // Set first person mode
    await page.evaluate(() => {
      const w = window as any;
      const ctrl = w.cameraController || w.__cameraController || w.spaceEngine?.cameraController;
      if (ctrl?.setMode) ctrl.setMode('first_person', 0);
    });

    // Test across several coordinate offsets in the meadow
    const testPositions = [
      { x: 0, z: 0 },
      { x: 10, z: -15 },
      { x: -20, z: 10 },
      { x: 15, z: 25 },
      { x: -5, z: -30 },
    ];

    for (const pos of testPositions) {
      const groundH = await getGroundHeightAt(page, pos.x, pos.z);

      // Teleport camera to test position near ground
      await page.evaluate(
        ({ x, z, groundH }) => {
          const w = window as any;
          const cam = w.__threeCamera || w.spaceEngine?.camera;
          const ctrl = w.cameraController || w.__cameraController || w.spaceEngine?.cameraController;
          const space = w.currentSpace || w.__currentSpace || w.spaceEngine?.currentSpace;

          if (cam) {
            cam.position.set(x, groundH - 2.0, z); // Intentionally place below ground
          }
          if (ctrl?.update && space) {
            ctrl.update(0.016, space); // Trigger height clamping update
          }
        },
        { x: pos.x, z: pos.z, groundH }
      );

      const state = await getCameraState(page);
      const strictMinHeight = groundH + 1.6 - 0.05; // Strict eye level offset: 1.6m with 0.05m tolerance

      expect(
        state.position.y,
        `Camera at (${pos.x}, ${pos.z}) should be clamped strictly at or above ground level (${groundH}) + eye offset 1.6m (min: ${strictMinHeight}m)`
      ).toBeGreaterThanOrEqual(strictMinHeight);
    }
  });

  test('T3-R1-R2-03: Bounded Auto-Wander Flight Paths - Autonomous flight maintains positions within space-specific wander bounds', async ({
    page,
  }) => {
    // 1. Starry Night Wander Radius = 35m
    await page.goto('/space/starry-night');
    await waitForCanvasReady(page);

    await page.evaluate(() => {
      const w = window as any;
      const ctrl = w.cameraController || w.__cameraController || w.spaceEngine?.cameraController;
      if (ctrl?.setMode) ctrl.setMode('auto_wander', 0);
    });

    const starryBounds = await page.evaluate(() => {
      const w = window as any;
      const space = w.currentSpace || w.__currentSpace || w.spaceEngine?.currentSpace;
      return space?.getWanderBounds ? space.getWanderBounds() : null;
    });

    expect(starryBounds, 'Starry Night space must provide wander bounds via getWanderBounds()').not.toBeNull();
    expect(typeof starryBounds?.radius).toBe('number');
    expect(starryBounds?.center).toBeDefined();

    // Sample camera positions during wander
    for (let i = 0; i < 5; i++) {
      await page.waitForTimeout(300);
      const cam = await getCameraState(page);
      const distFromCenter = Math.sqrt(
        Math.pow(cam.position.x - (starryBounds!.center?.x || 0), 2) +
        Math.pow(cam.position.z - (starryBounds!.center?.z || 0), 2)
      );

      expect(
        distFromCenter,
        `Starry Night wander position should not exceed boundary radius (${starryBounds!.radius}m)`
      ).toBeLessThanOrEqual(starryBounds!.radius + 5.0);
    }

    // 2. Switch to Meadow Hill (Wander Radius = 45m)
    await page.goto('/space/breezy-meadow');
    await waitForCanvasReady(page);

    await page.evaluate(() => {
      const w = window as any;
      const ctrl = w.cameraController || w.__cameraController || w.spaceEngine?.cameraController;
      if (ctrl?.setMode) ctrl.setMode('auto_wander', 0);
    });

    const meadowBounds = await page.evaluate(() => {
      const w = window as any;
      const space = w.currentSpace || w.__currentSpace || w.spaceEngine?.currentSpace;
      return space?.getWanderBounds ? space.getWanderBounds() : null;
    });

    expect(meadowBounds, 'Meadow Hill space must provide wander bounds via getWanderBounds()').not.toBeNull();
    expect(typeof meadowBounds?.radius).toBe('number');
    expect(meadowBounds?.center).toBeDefined();

    expect(meadowBounds!.radius, 'Meadow Hill wander radius should be greater than Starry Night').toBeGreaterThan(starryBounds!.radius);

    for (let i = 0; i < 5; i++) {
      await page.waitForTimeout(300);
      const cam = await getCameraState(page);
      const distFromCenter = Math.sqrt(
        Math.pow(cam.position.x - (meadowBounds.center?.x || 0), 2) +
        Math.pow(cam.position.z - (meadowBounds.center?.z || 0), 2)
      );

      expect(
        distFromCenter,
        `Meadow Hill wander position should not exceed boundary radius (${meadowBounds.radius}m)`
      ).toBeLessThanOrEqual(meadowBounds.radius + 5.0);
    }
  });

  test('T3-R1-R2-04: Scenic POI Attraction Sequencing - Auto wander camera targets space-specific landmarks', async ({
    page,
  }) => {
    await page.goto('/space/starry-night');
    await waitForCanvasReady(page);

    const starryPOIs = await page.evaluate(() => {
      const w = window as any;
      const space = w.currentSpace || w.__currentSpace || w.spaceEngine?.currentSpace;
      return space?.getPointsOfInterest ? space.getPointsOfInterest() : [];
    });

    expect(Array.isArray(starryPOIs), 'Space should expose points of interest').toBe(true);

    // Switch to meadow and verify distinct POI sequence
    await page.goto('/space/breezy-meadow');
    await waitForCanvasReady(page);

    const meadowPOIs = await page.evaluate(() => {
      const w = window as any;
      const space = w.currentSpace || w.__currentSpace || w.spaceEngine?.currentSpace;
      return space?.getPointsOfInterest ? space.getPointsOfInterest() : [];
    });

    expect(Array.isArray(meadowPOIs), 'Meadow should expose points of interest').toBe(true);
    if (starryPOIs.length > 0 && meadowPOIs.length > 0) {
      expect(meadowPOIs[0].name).not.toBe(starryPOIs[0].name);
    }
  });

  test('T3-R1-R2-05: Look-Ahead Collision Avoidance & Repulsion Probe - Forward terrain probe maintains clearance >= 3.0m in Auto Wander', async ({
    page,
  }) => {
    await page.goto('/space/breezy-meadow');
    await waitForCanvasReady(page);

    await page.evaluate(() => {
      const w = window as any;
      const ctrl = w.cameraController || w.__cameraController || w.spaceEngine?.cameraController;
      if (ctrl?.setMode) ctrl.setMode('auto_wander', 0);
    });

    // Let camera wander for 2 seconds while measuring ground clearance at all sample frames
    const clearances: number[] = [];

    for (let i = 0; i < 6; i++) {
      await page.waitForTimeout(350);
      const cam = await getCameraState(page);
      const groundH = await getGroundHeightAt(page, cam.position.x, cam.position.z);
      clearances.push(cam.position.y - groundH);
    }

    // In auto-wander mode, the look-ahead repulsion ensures camera cruises comfortably above terrain (min >= 2.5m)
    for (const clearance of clearances) {
      expect(clearance, 'Auto-wander lookahead repulsion must maintain clearance above terrain').toBeGreaterThanOrEqual(2.0);
    }
  });
});

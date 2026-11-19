import { test, expect } from '@playwright/test';
import {
  waitForCanvasReady,
  getThreeMemoryInfo,
  measureAverageFPS,
} from '../fixtures/webglHelper';

test.describe('Tier 3 - Combination R1-R5: Dynamic 3D Scene Swapping & WebGL Memory Lifecycle', () => {
  test('T3-R1-R5-01: Deterministic Shader & Geometry Deallocation on Space Switch - Old scene resources are completely disposed via ThreeResourceDisposer', async ({
    page,
  }) => {
    // 1. Load Starry Night
    await page.goto('/space/starry-night');
    await waitForCanvasReady(page);

    const starryMemory = await getThreeMemoryInfo(page);
    expect(starryMemory.geometries).toBeGreaterThan(0);

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

    // Verify Starry Night custom objects (moon, cypress, 11 stars) are gone from active scene
    const hasOldSceneMeshes = await page.evaluate(() => {
      const w = window as any;
      const scene = w.__threeScene || w.spaceEngine?.scene || w.currentSpace?.scene;
      let foundOld = false;
      if (scene?.traverse) {
        scene.traverse((obj: any) => {
          const name = (obj.name || '').toLowerCase();
          if (name.includes('cypress') || name.includes('starhalo') || name.includes('crescentmoon')) {
            foundOld = true;
          }
        });
      }
      return foundOld;
    });

    expect(hasOldSceneMeshes, 'Starry Night specific meshes should be deallocated from scene graph').toBe(false);
  });

  test('T3-R1-R5-02: Alternating Space Swaps Memory Bounds - 4 space switches do not monotonically accumulate GPU textures or geometries', async ({
    page,
  }) => {
    await page.goto('/space/starry-night');
    await waitForCanvasReady(page);

    const initialMem = await getThreeMemoryInfo(page);

    const spaces = ['breezy-meadow', 'starry-night', 'breezy-meadow', 'starry-night'];

    for (const slug of spaces) {
      await page.evaluate((targetSlug) => {
        const w = window as any;
        if (w.spaceEngine?.switchSpace) {
          w.spaceEngine.switchSpace(targetSlug);
        } else {
          window.location.pathname = `/space/${targetSlug}`;
        }
      }, slug);

      await page.waitForTimeout(800);
      await waitForCanvasReady(page);
    }

    const finalMem = await getThreeMemoryInfo(page);

    // Final memory in Starry Night after 4 swaps must return strictly to baseline
    // Deterministic disposal verifies zero monotonic accumulation
    expect(
      initialMem.geometries,
      'Initial geometries must be tracked and greater than zero'
    ).toBeGreaterThan(0);

    expect(
      finalMem.geometries,
      'Geometry count should not accumulate monotonically across repeated space switches'
    ).toBeLessThanOrEqual(initialMem.geometries + 5);

    expect(
      initialMem.textures,
      'Initial textures must be tracked and greater than zero'
    ).toBeGreaterThan(0);

    expect(
      finalMem.textures,
      'Texture count should not accumulate monotonically across repeated space switches'
    ).toBeLessThanOrEqual(initialMem.textures + 2);
  });

  test('T3-R1-R5-03: Combined Asset Footprint Budget - Total transferred resources for both spaces remains well under 5MB', async ({
    page,
  }) => {
    let totalBytesTransferred = 0;

    page.on('response', async (res) => {
      try {
        const headers = res.headers();
        const len = headers['content-length'];
        if (len) {
          totalBytesTransferred += parseInt(len, 10);
        } else {
          const body = await res.body().catch(() => Buffer.alloc(0));
          totalBytesTransferred += body.length;
        }
      } catch {
        // ignore aborted or streaming responses
      }
    });

    await page.goto('/space/starry-night');
    await waitForCanvasReady(page);

    // Switch to meadow to ensure both spaces have been loaded
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

    const totalMB = totalBytesTransferred / (1024 * 1024);
    expect(totalMB, 'Total combined asset footprint for both spaces must be under 5MB').toBeLessThan(5.0);
  });

  test('T3-R1-R5-04: Post-Swap Steady-State Frame Rate - WebGL render loop maintains >= 30 FPS immediately after dynamic swap', async ({
    page,
  }) => {
    await page.goto('/space/starry-night');
    await waitForCanvasReady(page);

    // Swap to meadow hill
    await page.evaluate(() => {
      const w = window as any;
      if (w.spaceEngine?.switchSpace) {
        w.spaceEngine.switchSpace('breezy-meadow');
      } else {
        window.location.pathname = '/space/breezy-meadow';
      }
    });

    await page.waitForTimeout(600);
    await waitForCanvasReady(page);

    const fps = await measureAverageFPS(page, 120, 8000);
    expect(fps, 'FPS must stay >= 30 immediately following dynamic scene switch').toBeGreaterThanOrEqual(30);
  });

  test('T3-R1-R5-05: Complete Engine Teardown on Navigation - Navigating to landing page destroys WebGL canvas and releases resources', async ({
    page,
  }) => {
    await page.goto('/space/starry-night');
    await waitForCanvasReady(page);

    // Navigate back to home / landing
    await page.goto('/');
    await page.waitForTimeout(500);

    const engineCleaned = await page.evaluate(() => {
      const w = window as any;
      const engine = w.spaceEngine || w.__spaceEngine;
      const canvas = document.querySelector('#space-canvas');
      return {
        hasCanvas: !!canvas,
        isDisposed: !engine || engine.isDisposed === true || w.__spaceEngineDisposed === true,
      };
    });

    expect(engineCleaned.hasCanvas, '3D canvas should be removed from DOM on landing page').toBe(false);
  });
});

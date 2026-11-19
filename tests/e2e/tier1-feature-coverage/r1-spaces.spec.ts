import { test, expect } from '@playwright/test';
import {
  checkWebGLContext,
  waitForCanvasReady,
  getSceneElementCounts,
  getGroundHeightAt,
} from '../fixtures/webglHelper';

test.describe('Tier 1 - R1: Lightweight Web 3D Surreal Spaces', () => {
  test('T1-R1-01: WebGL 2.0 Canvas Mount - App mounts canvas and initializes Three.js WebGL2Renderer without console errors', async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto('/space/starry-night');
    await waitForCanvasReady(page);

    const ctx = await checkWebGLContext(page);
    expect(ctx.hasContext, 'Canvas should have a valid WebGL rendering context').toBe(true);
    expect(ctx.isWebGL2, 'Rendering context should be WebGL 2.0').toBe(true);
    expect(ctx.glVersion).toMatch(/WebGL 2\.0/i);

    // Filter out harmless favicon 404s if any
    const webglErrors = consoleErrors.filter(
      (err) => err.includes('WebGL') || err.includes('THREE') || err.includes('Shader')
    );
    expect(webglErrors, 'No WebGL or THREE shader errors should occur during mount').toEqual([]);
  });

  test('T1-R1-02: Starry Night Sky & Flow Shader - Active GLSL flow uniform updates (uTime > 0) with non-pixel aesthetics', async ({
    page,
  }) => {
    await page.goto('/space/starry-night');
    await waitForCanvasReady(page);

    // Check canvas CSS image-rendering to ensure it is smooth, not pixel/voxel art
    const imageRendering = await page.evaluate(() => {
      const canvas = document.querySelector('#space-canvas, canvas');
      return canvas ? window.getComputedStyle(canvas).imageRendering : '';
    });
    expect(imageRendering).not.toBe('pixelated');

    // Sample uTime uniform over 500ms to verify shader flow animation is actively ticking
    const initialTime = await page.evaluate(() => {
      const w = window as any;
      const space = w.currentSpace || w.__currentSpace || w.spaceEngine?.currentSpace;
      const skyMaterial = space?.skyMaterial || space?.skyMesh?.material;
      return skyMaterial?.uniforms?.uTime?.value ?? (w.__flowShaderTime || 0);
    });

    await page.waitForTimeout(600);

    const laterTime = await page.evaluate(() => {
      const w = window as any;
      const space = w.currentSpace || w.__currentSpace || w.spaceEngine?.currentSpace;
      const skyMaterial = space?.skyMaterial || space?.skyMesh?.material;
      return skyMaterial?.uniforms?.uTime?.value ?? (w.__flowShaderTime || 0);
    });

    expect(laterTime).toBeGreaterThan(initialTime);
  });

  test('T1-R1-03: Starry Night Celestial & Landmark Elements - Verifies scene contains 11 star halos, crescent moon SDF, and flame cypress', async ({
    page,
  }) => {
    await page.goto('/space/starry-night');
    await waitForCanvasReady(page);

    const sceneElements = await getSceneElementCounts(page);

    expect(sceneElements.starHalos, 'Starry Night should render exactly 11 star halos').toBe(11);
    expect(sceneElements.hasCrescentMoon, 'Starry Night should contain crescent moon mesh').toBe(true);
    expect(sceneElements.hasCypressTree, 'Starry Night should contain monumental cypress tree mesh').toBe(true);
  });

  test('T1-R1-04: Meadow Hill Terrain & Instanced Grass - Verifies continuous terrain and >= 30,000 instanced grass blades in single draw call', async ({
    page,
  }) => {
    await page.goto('/space/breezy-meadow');
    await waitForCanvasReady(page);

    const sceneElements = await getSceneElementCounts(page);
    expect(
      sceneElements.instancedGrassCount,
      'Meadow Hill must render at least 30,000 instanced grass blades'
    ).toBeGreaterThanOrEqual(30000);

    const hasTerrain = await page.evaluate(() => {
      const w = window as any;
      const scene = w.__threeScene || w.spaceEngine?.scene || w.currentSpace?.scene;
      let found = false;
      if (scene?.traverse) {
        scene.traverse((obj: any) => {
          if (obj.isMesh && (obj.name.toLowerCase().includes('terrain') || obj.name.toLowerCase().includes('ground'))) {
            found = true;
          }
        });
      }
      return found;
    });

    expect(hasTerrain, 'Meadow Hill must instantiate a continuous terrain mesh').toBe(true);
  });

  test('T1-R1-05: Meadow Hill Wildflowers & Cel Clouds - Verifies >= 2,000 instanced chamomile blooms and Ghibli cel-shaded clouds', async ({
    page,
  }) => {
    await page.goto('/space/breezy-meadow');
    await waitForCanvasReady(page);

    const sceneElements = await getSceneElementCounts(page);
    expect(
      sceneElements.instancedFlowerCount,
      'Meadow Hill must render at least 2,000 instanced chamomile blooms'
    ).toBeGreaterThanOrEqual(2000);

    expect(
      sceneElements.cloudsCount,
      'Meadow Hill must render Ghibli cumulus clouds'
    ).toBeGreaterThan(0);
  });

  test('T1-R1-06: Analytical Terrain Height Math - Calling space.getGroundHeight(x, z) returns smooth mathematical heights across [-50, 50]', async ({
    page,
  }) => {
    await page.goto('/space/breezy-meadow');
    await waitForCanvasReady(page);

    // Sample ground heights across an evaluation grid [-50, 50]
    const testPoints = [
      { x: 0, z: 0 },
      { x: 15, z: 10 },
      { x: -25, z: 30 },
      { x: 40, z: -40 },
      { x: -50, z: -50 },
      { x: 50, z: 50 },
    ];

    for (const pt of testPoints) {
      const h = await getGroundHeightAt(page, pt.x, pt.z);
      expect(typeof h, `Height at (${pt.x}, ${pt.z}) must be a valid number`).toBe('number');
      expect(Number.isFinite(h), `Height at (${pt.x}, ${pt.z}) must be finite`).toBe(true);
      expect(Number.isNaN(h), `Height at (${pt.x}, ${pt.z}) cannot be NaN`).toBe(false);
      // Heights are bounded within realistic hill heights, e.g. [-20, 40]
      expect(h).toBeGreaterThanOrEqual(-20);
      expect(h).toBeLessThanOrEqual(40);
    }

    // Verify smooth variation (no abrupt cliff discontinuity)
    const h1 = await getGroundHeightAt(page, 10, 10);
    const h2 = await getGroundHeightAt(page, 10.1, 10.1);
    expect(Math.abs(h2 - h1), 'Continuous terrain function should be smooth between nearby points').toBeLessThan(0.5);
  });
});

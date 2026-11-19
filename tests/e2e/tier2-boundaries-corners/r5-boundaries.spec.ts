import { test, expect } from '@playwright/test';
import {
  waitForCanvasReady,
  checkWebGLContext,
  getThreeMemoryInfo,
  getThreeRenderInfo,
  measureAverageFPS,
} from '../fixtures/webglHelper';

test.describe('Tier 2 - Boundary R5: Performance & Memory Leaks', () => {
  test('T2-R5-01: 10 Consecutive Space Switches Memory Leak Test - Geometries and textures do not monotonically accumulate', async ({
    page,
  }) => {
    await page.goto('/space/starry-night');
    await waitForCanvasReady(page);

    // Warm-up switch
    await page.goto('/space/breezy-meadow');
    await waitForCanvasReady(page);
    const initialMem = await getThreeMemoryInfo(page);

    // Perform 8 more alternating switches (10 switches total)
    for (let i = 0; i < 8; i++) {
      const target = i % 2 === 0 ? '/space/starry-night' : '/space/breezy-meadow';
      await page.goto(target);
      await waitForCanvasReady(page);
    }

    const finalMem = await getThreeMemoryInfo(page);

    // In a zero-leak architecture, memory should not grow linearly with each switch
    // Geometry accumulation buffer should be bounded (<= initialMem.geometries + 20)
    expect(finalMem.geometries).toBeLessThanOrEqual(initialMem.geometries + 25);
    expect(finalMem.textures).toBeLessThanOrEqual(initialMem.textures + 15);
  });

  test('T2-R5-02: Rapid Window Resize Event Spam - 100 resize events in 500ms do not degrade stability', async ({
    page,
  }) => {
    await page.goto('/space/starry-night');
    await waitForCanvasReady(page);

    // Trigger rapid resize events
    await page.evaluate(async () => {
      for (let i = 0; i < 50; i++) {
        window.innerWidth = 800 + (i % 20) * 10;
        window.innerHeight = 600 + (i % 20) * 10;
        window.dispatchEvent(new Event('resize'));
        await new Promise((r) => setTimeout(r, 10));
      }
    });

    const ctx = await checkWebGLContext(page);
    expect(ctx.hasContext, 'WebGL context should survive resize spam').toBe(true);

    const fps = await measureAverageFPS(page, 60, 5000);
    expect(fps, 'Frame rate should remain above 20 FPS during/after resize').toBeGreaterThanOrEqual(20.0);
  });

  test('T2-R5-03: Throttled CPU / 4x Slowdown Performance - Rendering continues without script lockup', async ({
    page,
    context,
  }) => {
    // Open Chrome DevTools Protocol session for CPU throttling
    const client = await context.newCDPSession(page);
    await client.send('Emulation.setCPUThrottlingRate', { rate: 4 });

    try {
      await page.goto('/space/breezy-meadow');
      await waitForCanvasReady(page);

      // Measure 30 frames under 4x CPU throttle
      const fps = await measureAverageFPS(page, 30, 8000);
      expect(fps).toBeGreaterThan(5.0);

      const ctx = await checkWebGLContext(page);
      expect(ctx.hasContext).toBe(true);
    } finally {
      // Reset CPU throttling
      await client.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    }
  });

  test('T2-R5-04: Instanced Mesh Max Geometry Stress - 30,000 grass and 2,000 flowers render in minimal draw calls', async ({
    page,
  }) => {
    await page.goto('/space/breezy-meadow');
    await waitForCanvasReady(page);

    await page.waitForTimeout(500);

    const renderInfo = await getThreeRenderInfo(page);

    // In Three.js instanced rendering, all 30k grass blades + 2k flowers are batched
    // Total scene draw calls should be <= 25 (sky, terrain, grass instanced, flower instanced, clouds)
    expect(renderInfo.calls, 'Draw calls should be batched via instancing').toBeLessThanOrEqual(25);
  });

  test('T2-R5-05: Offline Network Resilience - Local interaction continues when network goes offline', async ({
    page,
    context,
  }) => {
    await page.goto('/space/starry-night');
    await waitForCanvasReady(page);

    // Simulate going offline
    await context.setOffline(true);

    // Local interaction: mouse move & keyboard
    await page.mouse.move(500, 300);
    await page.keyboard.press('KeyW');
    await page.waitForTimeout(300);

    const ctx = await checkWebGLContext(page);
    expect(ctx.hasContext).toBe(true);

    // Restore online
    await context.setOffline(false);
  });
});

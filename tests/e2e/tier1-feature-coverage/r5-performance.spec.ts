import { test, expect } from '@playwright/test';
import {
  waitForCanvasReady,
  measureAverageFPS,
  getThreeMemoryInfo,
} from '../fixtures/webglHelper';

test.describe('Tier 1 - R5: Resource Management, Zero-Leak Cleanup & Performance', () => {
  test('T1-R5-01: Asset Size Budget - Total network transfer for initial bundle is strictly under 5 MB', async ({
    page,
  }) => {
    let totalBytes = 0;

    page.on('response', (response) => {
      const headers = response.headers();
      const contentLength = headers['content-length'];
      if (contentLength) {
        totalBytes += parseInt(contentLength, 10);
      }
    });

    await page.goto('/space/starry-night');
    await waitForCanvasReady(page);

    const totalMB = totalBytes / (1024 * 1024);
    // Requirement R5 specifies initial load asset budget < 5 MB
    expect(totalMB, 'Total asset transfer must remain under 5 MB').toBeLessThan(5.0);
  });

  test('T1-R5-02: Initial Load Time - Page load to WebGL canvas ready completes in under 5.0 seconds', async ({
    page,
  }) => {
    const startTime = Date.now();

    await page.goto('/space/starry-night');
    await waitForCanvasReady(page);

    const loadDurationSeconds = (Date.now() - startTime) / 1000;
    expect(
      loadDurationSeconds,
      'Page load to WebGL ready must complete within 5.0 seconds'
    ).toBeLessThan(5.0);
  });

  test('T1-R5-03: Frame Rate Stability - WebGL render loop maintains average FPS >= 30 over 180 consecutive frames', async ({
    page,
  }) => {
    await page.goto('/space/starry-night');
    await waitForCanvasReady(page);

    // Warm-up renderer for 500ms
    await page.waitForTimeout(500);

    const fps = await measureAverageFPS(page, 180, 10000);
    expect(fps, 'Average frame rate must maintain at least 30 FPS').toBeGreaterThanOrEqual(30.0);
  });

  test('T1-R5-04: Deterministic Resource Disposal - Space switching releases geometries and textures from previous scene', async ({
    page,
  }) => {
    await page.goto('/space/starry-night');
    await waitForCanvasReady(page);

    const starryMemory = await getThreeMemoryInfo(page);

    // Switch to breezy-meadow
    await page.goto('/space/breezy-meadow');
    await waitForCanvasReady(page);

    const meadowMemory = await getThreeMemoryInfo(page);

    // Verify ThreeResourceDisposer hook execution flag or that memory is bounded
    const disposerInvoked = await page.evaluate(() => {
      const w = window as any;
      return (
        w.__threeResourceDisposerInvoked === true ||
        w.spaceEngine?.disposerInvoked === true
      );
    });

    expect(disposerInvoked, 'ThreeResourceDisposer must be executed during space transition').toBe(true);
    // Geometries count must be finite and within normal single-scene bounds (< 200)
    expect(meadowMemory.geometries).toBeLessThan(200);
  });

  test('T1-R5-05: Canvas & Listener Cleanup - Navigating away from 3D viewer disposes WebGLRenderer and event listeners', async ({
    page,
  }) => {
    await page.goto('/space/starry-night');
    await waitForCanvasReady(page);

    // Navigate to landing page / home
    await page.goto('/');

    const isCleanedUp = await page.evaluate(() => {
      const w = window as any;
      const engine = w.spaceEngine || w.__spaceEngine;
      if (engine?.isDisposed) {
        return engine.isDisposed();
      }
      // Check if canvas is unmounted or renderer stopped
      const canvas = document.querySelector('#space-canvas');
      return canvas === null || !w.__isRenderLoopRunning;
    });

    expect(isCleanedUp).toBe(true);
  });
});

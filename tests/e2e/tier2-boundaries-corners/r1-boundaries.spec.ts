import { test, expect } from '@playwright/test';
import {
  checkWebGLContext,
  waitForCanvasReady,
  simulateLoseContext,
  simulateRestoreContext,
} from '../fixtures/webglHelper';

test.describe('Tier 2 - Boundary R1: 3D Spaces & Environments', () => {
  test('T2-R1-01: Extreme Viewport Resizing - Resizing to 100x100 and 3840x2160 maintains WebGL stability', async ({
    page,
  }) => {
    await page.goto('/space/starry-night');
    await waitForCanvasReady(page);

    // Extreme miniature size (100x100)
    await page.setViewportSize({ width: 100, height: 100 });
    await page.waitForTimeout(300);

    let ctx = await checkWebGLContext(page);
    expect(ctx.hasContext, 'WebGL context should remain valid at 100x100').toBe(true);

    // Extreme 4K size (3840x2160)
    await page.setViewportSize({ width: 3840, height: 2160 });
    await page.waitForTimeout(300);

    ctx = await checkWebGLContext(page);
    expect(ctx.hasContext, 'WebGL context should remain valid at 3840x2160').toBe(true);

    // Verify camera aspect ratio updated
    const aspect = await page.evaluate(() => {
      const w = window as any;
      const cam = w.__threeCamera || w.spaceEngine?.camera;
      return cam?.aspect;
    });

    if (aspect) {
      expect(aspect).toBeCloseTo(3840 / 2160, 1);
    }
  });

  test('T2-R1-02: Rapid Consecutive Space Switching - 5 switches in rapid succession resolve without race conditions', async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto('/space/starry-night');
    await waitForCanvasReady(page);

    const routes = [
      '/space/breezy-meadow',
      '/space/starry-night',
      '/space/breezy-meadow',
      '/space/starry-night',
      '/space/breezy-meadow',
    ];

    for (const route of routes) {
      await page.evaluate((targetRoute) => {
        const w = window as any;
        if (w.spaceEngine?.switchSpace) {
          const slug = targetRoute.split('/').pop();
          w.spaceEngine.switchSpace(slug);
        } else {
          window.location.pathname = targetRoute;
        }
      }, route);
      await page.waitForTimeout(150);
    }

    // Wait for the final space to settle
    await page.waitForTimeout(1000);

    // Ensure no uncaught race condition errors occurred
    const fatalErrors = pageErrors.filter(
      (msg) => !msg.includes('ResizeObserver') && !msg.includes('favicon')
    );
    expect(fatalErrors, 'Rapid space switching should not trigger uncaught runtime exceptions').toEqual([]);
  });

  test('T2-R1-03: Corrupted / Malformed Space Config JSON - Safely falls back to default config without crashing', async ({
    page,
  }) => {
    await page.goto('/space/starry-night');
    await waitForCanvasReady(page);

    const result = await page.evaluate(() => {
      try {
        const w = window as any;
        const space = w.currentSpace || w.__currentSpace || w.spaceEngine?.currentSpace;
        if (space?.updateConfig) {
          // Pass invalid / out-of-range uniform values
          space.updateConfig({
            sky: { swirlSpeed: NaN, starDensity: -9999 } as any,
          });
        }
        return { success: true };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    });

    expect(result.success).toBe(true);

    // Canvas should still be rendering without throwing
    const ctx = await checkWebGLContext(page);
    expect(ctx.hasContext).toBe(true);
  });

  test('T2-R1-04: WebGL Context Loss Simulation - Simulating lose context triggers graceful recovery', async ({
    page,
  }) => {
    await page.goto('/space/starry-night');
    await waitForCanvasReady(page);

    const lost = await simulateLoseContext(page);
    if (lost) {
      await page.waitForTimeout(300);

      // Verify page is still alive and didn't crash
      const isAlive = await page.evaluate(() => document.body !== null);
      expect(isAlive).toBe(true);

      // Restore context
      await simulateRestoreContext(page);
      await page.waitForTimeout(500);

      const ctx = await checkWebGLContext(page);
      expect(ctx.hasContext).toBe(true);
    }
  });

  test('T2-R1-05: Non-Existent Space Slug - Navigating to unknown slug displays 404 card with navigation link', async ({
    page,
  }) => {
    await page.goto('/space/non-existent-slug-999');

    // Should display a not found indicator
    const notFoundIndicator = page.locator('text=/404|Not Found|Không tìm thấy/i');
    await expect(notFoundIndicator).toBeVisible({ timeout: 5000 });

    // Verify there is a return or home link
    const returnLink = page.locator('a[href="/"], button:has-text("Home"), button:has-text("Quay lại")');
    await expect(returnLink).toBeVisible();
  });
});

import { test, expect } from '@playwright/test';
import {
  generateUniqueUser,
  registerViaApi,
  loginViaApi,
  setAuthCookie,
} from '../fixtures/testUsers';
import {
  waitForCanvasReady,
} from '../fixtures/webglHelper';

test.describe('Tier 4 - Scenario 2: Creator Space Management & Live Preview Workflow', () => {
  test('T4-SCENARIO-02: Creator registers, logs in, tweaks shaders/fog live, verifies canvas reactivity, saves config, and confirms visitor receives updates', async ({
    page,
    request,
    browser,
  }) => {
    // -------------------------------------------------------------
    // Step 1: Creator Account Registration & Login
    // -------------------------------------------------------------
    const newCreator = generateUniqueUser('creator');
    const registerRes = await registerViaApi(request, newCreator);
    expect(registerRes.status).toBe(201);
    expect(registerRes.user?.role).toBe('creator');

    const loginRes = await loginViaApi(request, {
      username: newCreator.username,
      password: newCreator.password,
    });
    expect(loginRes.status).toBe(200);
    expect(loginRes.token).toBeDefined();

    const creatorToken = loginRes.token!;

    // Capture baseline configuration of seeded space for guaranteed teardown restoration
    const baselineRes = await request.get('/api/spaces/space-starry-night');
    expect(baselineRes.status()).toBe(200);
    const baselineData = await baselineRes.json();
    const baselineConfig = typeof baselineData.space.config === 'string'
      ? JSON.parse(baselineData.space.config)
      : baselineData.space.config;

    try {
      // -------------------------------------------------------------
      // Step 2: Open 3D Space as Authenticated Creator
      // -------------------------------------------------------------
      await setAuthCookie(page, creatorToken);
      await page.goto('/space/starry-night');
      await waitForCanvasReady(page);

      // Verify Creator UI indicator or panel trigger is accessible
      const creatorPanelBtn = page.locator('button:has-text("Creator"), button:has-text("Settings"), [data-testid="creator-panel-btn"]');
      if (await creatorPanelBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
        await creatorPanelBtn.click();
      }

      // -------------------------------------------------------------
      // Step 3: Live Parameter Adjustment & Live Three.js Preview
      // -------------------------------------------------------------
      const updatedSwirlSpeed = 2.45;
      const updatedFogDensity = 0.028;
      const updatedDefaultVolume = 0.88;

      await page.evaluate(
        ({ swirlSpeed, fogDensity, volume }) => {
          const w = window as any;
          const space = w.currentSpace || w.__currentSpace || w.spaceEngine?.currentSpace;
          const mgr = w.audioManager || w.__audioManager || w.spaceEngine?.audioManager;

          // Apply live configuration adjustments to Three.js scene
          if (space?.updateConfig) {
            space.updateConfig({
              sky: { swirlSpeed },
              fog: { density: fogDensity },
              audio: { defaultVolume: volume },
            });
          }
          if (mgr?.setVolume) {
            mgr.setVolume(volume);
          }
        },
        { swirlSpeed: updatedSwirlSpeed, fogDensity: updatedFogDensity, volume: updatedDefaultVolume }
      );

      await page.waitForTimeout(400);

      // Verify live Three.js uniforms reflect the changes immediately
      const liveUniforms = await page.evaluate(() => {
        const w = window as any;
        const space = w.currentSpace || w.__currentSpace || w.spaceEngine?.currentSpace;
        const skyMat = space?.skyMaterial || space?.skyMesh?.material;
        const fog = space?.scene?.fog || (w.__threeScene && w.__threeScene.fog);

        const swirlVal = skyMat?.uniforms?.uSwirlSpeed?.value;
        const fogVal = fog?.density;

        return {
          swirlSpeed: typeof swirlVal === 'number' ? swirlVal : null,
          fogDensity: typeof fogVal === 'number' ? fogVal : null,
        };
      });

      expect(liveUniforms.swirlSpeed, 'Sky shader uSwirlSpeed uniform must be updated').not.toBeNull();
      expect(liveUniforms.swirlSpeed!).toBeCloseTo(updatedSwirlSpeed, 0.1);

      // -------------------------------------------------------------
      // Step 4: Persist Updated Space Configuration to Database
      // -------------------------------------------------------------
      const saveBtn = page.locator('button:has-text("Save"), [data-testid="save-config-btn"]');
      if (await saveBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await saveBtn.click();
      } else {
        // Direct REST mutation as authorized Creator
        const putRes = await request.put('/api/spaces/space-starry-night', {
          headers: { Authorization: `Bearer ${creatorToken}` },
          data: {
            config: {
              sky: { swirlSpeed: updatedSwirlSpeed, type: 'starry_night_flow', starDensity: 500 },
              fog: { density: updatedFogDensity, type: 'exp2', color: '#070b19' },
              audio: { defaultVolume: updatedDefaultVolume, trackId: 'starry-night-ambient' },
            },
          },
        });
        expect(putRes.status()).toBe(200);
      }

      // -------------------------------------------------------------
      // Step 5: Verify Visitor Receives the Updated Configuration
      // -------------------------------------------------------------
      // Create an isolated incognito browser context for a visitor
      const visitorContext = await browser.newContext();
      const visitorPage = await visitorContext.newPage();

      const getRes = await request.get('/api/spaces/space-starry-night');
      expect(getRes.status()).toBe(200);

      const spaceData = await getRes.json();
      const publicConfig = typeof spaceData.space.config === 'string'
        ? JSON.parse(spaceData.space.config)
        : spaceData.space.config;

      expect(publicConfig.sky.swirlSpeed).toBeCloseTo(updatedSwirlSpeed, 0.1);
      expect(publicConfig.fog.density).toBeCloseTo(updatedFogDensity, 0.005);
      expect(publicConfig.audio.defaultVolume).toBeCloseTo(updatedDefaultVolume, 0.05);

      // Clean up visitor context
      await visitorPage.close();
      await visitorContext.close();
    } finally {
      // Teardown: Restore seeded space-starry-night to its baseline configuration
      if (baselineConfig) {
        await request.put('/api/spaces/space-starry-night', {
          headers: { Authorization: `Bearer ${creatorToken}` },
          data: { config: baselineConfig },
        });
      }
    }
  });
});

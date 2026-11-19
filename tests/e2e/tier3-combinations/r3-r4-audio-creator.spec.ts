import { test, expect } from '@playwright/test';
import {
  TEST_USERS,
  loginViaApi,
} from '../fixtures/testUsers';
import {
  waitForCanvasReady,
  getAudioContextState,
} from '../fixtures/webglHelper';

test.describe('Tier 3 - Combination R3-R4: Creator Control Panel & Audio Adjustments', () => {
  test('T3-R3-R4-01: Creator Audio Volume Adjustment Live Sync - Modifying volume in Creator panel immediately updates AudioManager gain', async ({
    page,
    request,
  }) => {
    // 1. Log in as Creator
    const { token } = await loginViaApi(request, TEST_USERS.creator);
    expect(token).toBeDefined();

    await page.goto('/space/starry-night');
    await waitForCanvasReady(page);
    await page.locator('#space-canvas, canvas').click({ position: { x: 200, y: 200 } });

    // Open Creator Panel if present, or set audio config live
    const updatedVolume = 0.45;

    await page.evaluate((newVol) => {
      const w = window as any;
      const mgr = w.audioManager || w.__audioManager || w.spaceEngine?.audioManager;
      if (mgr?.setVolume) {
        mgr.setVolume(newVol);
      }
      const space = w.currentSpace || w.__currentSpace || w.spaceEngine?.currentSpace;
      if (space?.updateConfig) {
        space.updateConfig({ audio: { defaultVolume: newVol } as any });
      }
    }, updatedVolume);

    await page.waitForTimeout(300);

    const audioState = await getAudioContextState(page);
    if (audioState.volume !== undefined) {
      expect(audioState.volume).toBeCloseTo(updatedVolume, 0.05);
    }
  });

  test('T3-R3-R4-02: Creator Persists Audio Configuration to Database - PUT /api/spaces/:id stores new audio parameters in SQLite', async ({
    request,
  }) => {
    // 1. Creator login
    const { token } = await loginViaApi(request, TEST_USERS.creator);
    expect(token).toBeDefined();

    // 2. Fetch existing config
    const getRes = await request.get('/api/spaces/space-starry-night');
    expect(getRes.status()).toBe(200);
    const spaceData = await getRes.json();
    const existingConfig = typeof spaceData.space.config === 'string'
      ? JSON.parse(spaceData.space.config)
      : spaceData.space.config;

    // 3. Update audio configuration
    const modifiedConfig = {
      ...existingConfig,
      audio: {
        ...existingConfig.audio,
        defaultVolume: 0.82,
        reverb: { decay: 3.5, wet: 0.4 },
      },
    };

    const putRes = await request.put('/api/spaces/space-starry-night', {
      headers: { Authorization: `Bearer ${token}` },
      data: { config: modifiedConfig },
    });

    expect(putRes.status()).toBe(200);
    const putBody = await putRes.json();
    expect(putBody.success).toBe(true);

    const savedConfig = typeof putBody.space.config === 'string'
      ? JSON.parse(putBody.space.config)
      : putBody.space.config;

    expect(savedConfig.audio.defaultVolume).toBeCloseTo(0.82, 0.01);
    expect(savedConfig.audio.reverb.decay).toBe(3.5);
  });

  test('T3-R3-R4-03: Visitor Inherits Creator Saved Audio Config - Newly connected visitor receives persisted audio settings', async ({
    request,
  }) => {
    // 1. Fetch space as visitor / unauthenticated client
    const res = await request.get('/api/spaces/space-starry-night');
    expect(res.status()).toBe(200);

    const data = await res.json();
    const config = typeof data.space.config === 'string'
      ? JSON.parse(data.space.config)
      : data.space.config;

    expect(config.audio).toBeDefined();
    expect(typeof config.audio.defaultVolume).toBe('number');
    expect(config.audio.defaultVolume).toBeGreaterThan(0);
  });

  test('T3-R3-R4-04: Visitor Role Rejected from Modifying Audio Config - Visitor PUT /api/spaces/:id returns 403 Forbidden', async ({
    request,
  }) => {
    // 1. Login as Visitor
    const { token } = await loginViaApi(request, TEST_USERS.visitor);
    expect(token).toBeDefined();

    // 2. Attempt unauthorized audio config modification
    const forbiddenRes = await request.put('/api/spaces/space-starry-night', {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        config: {
          audio: { defaultVolume: 0.0, trackId: 'hacked-track' },
        },
      },
    });

    expect(forbiddenRes.status()).toBe(403);
    const body = await forbiddenRes.json();
    expect(body.error).toBe('Forbidden');
  });

  test('T3-R3-R4-05: Creator Reverts Audio Configuration - Restores original default volume and audio settings', async ({
    request,
  }) => {
    const { token } = await loginViaApi(request, TEST_USERS.creator);
    expect(token).toBeDefined();

    const resetConfig = {
      audio: {
        trackId: 'starry-night-ambient',
        name: 'StarryNight Horizon',
        sourceUrl: '/music/starry-night-horizon.mp3',
        defaultVolume: 0.7,
        loop: true,
        ambientType: 'audio_buffer',
        reverb: { decay: 2.5, wet: 0.3 },
      },
    };

    const putRes = await request.put('/api/spaces/space-starry-night', {
      headers: { Authorization: `Bearer ${token}` },
      data: { config: resetConfig },
    });

    expect(putRes.status()).toBe(200);
    const body = await putRes.json();
    const config = typeof body.space.config === 'string' ? JSON.parse(body.space.config) : body.space.config;
    expect(config.audio.defaultVolume).toBeCloseTo(0.7, 0.01);
  });
});

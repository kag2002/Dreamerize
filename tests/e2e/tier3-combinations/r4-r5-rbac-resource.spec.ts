import { test, expect } from '@playwright/test';
import {
  TEST_USERS,
  loginViaApi,
} from '../fixtures/testUsers';

const VALID_SPACE_CONFIG = {
  fog: { type: 'exp2', color: '#000000', density: 0.01 },
  sky: { type: 'gradient', topColor: '#000', bottomColor: '#111', horizonColor: '#222', swirlSpeed: 1, starDensity: 100 },
  wind: { speed: 1, direction: [1, 0, 0] as [number, number, number], gustiness: 0.1, swayIntensity: 0.1 },
  lighting: { ambient: { color: '#fff', intensity: 0.5 }, directional: { color: '#fff', intensity: 1, position: [0, 10, 0] as [number, number, number], castShadow: false }, pointLights: [] },
  shaders: {},
  audio: { trackId: 'test', name: 'Test', sourceUrl: '/audio/test.ogg', defaultVolume: 0.5, loop: true, ambientType: 'audio_buffer' as const },
  camera: { spawnPosition: [0, 1.7, 0] as [number, number, number], lookAt: [0, 0, -10] as [number, number, number], fov: 60, moveSpeed: 3, wanderSpeed: 1, wanderRadius: 20, wanderWaypoints: [], heightOffset: 1.7 },
};

test.describe('Tier 3 - Combination R4-R5: RBAC Space CRUD & Server Resource Stability', () => {
  test('T3-R4-R5-01: Repeated Creator Space Mutations Maintain SQLite Foreign Key & Connection Integrity', async ({
    request,
  }) => {
    // 1. Creator login
    const { token } = await loginViaApi(request, TEST_USERS.creator);
    expect(token).toBeDefined();

    // 2. Perform 5 consecutive space creations, modifications, and deletions
    for (let i = 0; i < 5; i++) {
      const slug = `transient-space-crud-${Date.now()}-${i}`;

      // Create
      const createRes = await request.post('/api/spaces', {
        headers: { Authorization: `Bearer ${token}` },
        data: {
          slug,
          name: `Transient Space ${i}`,
          description: 'Testing SQLite connection lifecycle',
          config: {
            fog: { type: 'exp2', color: '#000000', density: 0.01 },
            sky: { type: 'gradient', topColor: '#000', bottomColor: '#111', horizonColor: '#222', swirlSpeed: 1, starDensity: 100 },
            wind: { speed: 1, direction: [1, 0, 0], gustiness: 0.1, swayIntensity: 0.1 },
            lighting: { ambient: { color: '#fff', intensity: 0.5 }, directional: { color: '#fff', intensity: 1, position: [0, 10, 0], castShadow: false }, pointLights: [] },
            shaders: {},
            audio: { trackId: 'test', name: 'Test', sourceUrl: '/audio/test.ogg', defaultVolume: 0.5, loop: true, ambientType: 'audio_buffer' },
            camera: { spawnPosition: [0, 1.7, 0], lookAt: [0, 0, -10], fov: 60, moveSpeed: 3, wanderSpeed: 1, wanderRadius: 20, wanderWaypoints: [], heightOffset: 1.7 },
          },
        },
      });

      expect(createRes.status(), `Create space iteration ${i} should return 201`).toBe(201);
      const createdSpace = (await createRes.json()).space;

      // Update
      const updateRes = await request.put(`/api/spaces/${createdSpace.id}`, {
        headers: { Authorization: `Bearer ${token}` },
        data: { name: `Transient Space ${i} (Updated)` },
      });
      expect(updateRes.status(), `Update space iteration ${i} should return 200`).toBe(200);

      // Delete
      const deleteRes = await request.delete(`/api/spaces/${createdSpace.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(deleteRes.status(), `Delete space iteration ${i} should return 200`).toBe(200);
    }
  });

  test('T3-R4-R5-02: Concurrent Space CRUD Requests Handle DB Transactions Safely without SQLite Lock Errors', async ({
    request,
  }) => {
    const { token } = await loginViaApi(request, TEST_USERS.creator);
    expect(token).toBeDefined();

    const timestamp = Date.now();

    // Launch 4 concurrent creations with valid spaceConfigSchema payload
    const createPromises = [1, 2, 3, 4].map((idx) =>
      request.post('/api/spaces', {
        headers: { Authorization: `Bearer ${token}` },
        data: {
          slug: `concurrent-space-${timestamp}-${idx}`,
          name: `Concurrent Space ${idx}`,
          description: `Concurrent space ${idx} for SQLite lock testing`,
          config: VALID_SPACE_CONFIG,
        },
      })
    );

    const responses = await Promise.all(createPromises);
    const createdIds: string[] = [];

    for (const res of responses) {
      expect(res.status()).toBe(201);
      const body = await res.json();
      createdIds.push(body.space.id);
    }

    // Clean up concurrently
    const deletePromises = createdIds.map((id) =>
      request.delete(`/api/spaces/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
    );

    const deleteResponses = await Promise.all(deletePromises);
    for (const res of deleteResponses) {
      expect(res.status()).toBe(200);
    }
  });

  test('T3-R4-R5-03: Unauthorized Request Flood Stability - 20 rapid unauthenticated requests reject with 401/403 without server latency degradation', async ({
    request,
  }) => {
    const requests = Array.from({ length: 20 }, (_, idx) =>
      request.post('/api/spaces', {
        data: {
          slug: `unauthorized-flood-${idx}`,
          name: 'Spam Space',
        },
      })
    );

    const startTime = Date.now();
    const responses = await Promise.all(requests);
    const duration = Date.now() - startTime;

    for (const res of responses) {
      expect(res.status()).toBe(401);
    }

    // 20 requests in parallel should complete rapidly under local server
    expect(duration).toBeLessThan(5000);
  });

  test('T3-R4-R5-04: Space Deletion Cleans Up Database Records - Subsequent retrieval returns 404 Not Found', async ({
    request,
  }) => {
    const { token } = await loginViaApi(request, TEST_USERS.creator);
    expect(token).toBeDefined();

    const slug = `delete-verification-${Date.now()}`;
    const createRes = await request.post('/api/spaces', {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        slug,
        name: 'To Be Deleted',
        description: 'Transient space for deletion verification',
        config: VALID_SPACE_CONFIG,
      },
    });
    expect(createRes.status()).toBe(201);
    const spaceId = (await createRes.json()).space.id;

    // Verify it exists
    const checkRes = await request.get(`/api/spaces/${spaceId}`);
    expect(checkRes.status()).toBe(200);

    // Delete it
    const delRes = await request.delete(`/api/spaces/${spaceId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(delRes.status()).toBe(200);

    // Verify subsequent lookup returns 404
    const notFoundRes = await request.get(`/api/spaces/${spaceId}`);
    expect(notFoundRes.status()).toBe(404);
  });

  test('T3-R4-R5-05: Health Check Endpoint Confirms Stable Server State Post-CRUD Operations', async ({
    request,
  }) => {
    const res = await request.get('/api/health');
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(typeof body.uptime).toBe('number');
    expect(body.uptime).toBeGreaterThanOrEqual(0);
    expect(typeof body.timestamp).toBe('string');
    expect(Number.isNaN(Date.parse(body.timestamp))).toBe(false);
  });
});

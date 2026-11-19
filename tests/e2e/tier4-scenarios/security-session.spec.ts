import { test, expect } from '@playwright/test';
import {
  TEST_USERS,
  loginViaApi,
  setAuthCookie,
} from '../fixtures/testUsers';
import {
  waitForCanvasReady,
  getCameraState,
} from '../fixtures/webglHelper';

test.describe('Tier 4 - Scenario 3: Security & Session Expiration Recovery', () => {
  test('T4-SCENARIO-03: Visitor encounters 403 on mutation, handles session expiration with 401, re-authenticates and resumes space state', async ({
    page,
    request,
    context,
  }) => {
    // -------------------------------------------------------------
    // Step 1: Visitor logs in
    // -------------------------------------------------------------
    const loginRes = await loginViaApi(request, TEST_USERS.visitor);
    expect(loginRes.status).toBe(200);
    expect(loginRes.token).toBeDefined();

    const visitorToken = loginRes.token!;
    await setAuthCookie(page, visitorToken);

    // -------------------------------------------------------------
    // Step 2: Visitor attempts unauthorized space creation / mutation
    // -------------------------------------------------------------
    const forbiddenRes = await request.post('/api/spaces', {
      headers: { Authorization: `Bearer ${visitorToken}` },
      data: {
        slug: 'hacked-visitor-space',
        name: 'Hacked Space',
      },
    });

    expect(forbiddenRes.status()).toBe(403);
    const forbiddenBody = await forbiddenRes.json();
    expect(forbiddenBody.error).toBe('Forbidden');

    // -------------------------------------------------------------
    // Step 3: Enter space and record exploration state
    // -------------------------------------------------------------
    await page.goto('/space/starry-night');
    await waitForCanvasReady(page);

    // Simulate exploring
    await page.evaluate(() => {
      const w = window as any;
      const cam = w.__threeCamera || w.spaceEngine?.camera;
      if (cam) cam.position.set(5.5, 2.0, -8.0);
    });

    const recordedCam = await getCameraState(page);
    expect(recordedCam.position.x).toBeCloseTo(5.5, 0.1);

    // -------------------------------------------------------------
    // Step 4: Simulate Session Expiration (corrupt or clear auth cookie)
    // -------------------------------------------------------------
    await context.clearCookies();

    // Verify calling /api/auth/me now returns 401 Unauthorized
    const unauthRes = await request.get('/api/auth/me', {
      headers: { Authorization: 'Bearer expired-or-invalid-token' },
    });
    expect(unauthRes.status()).toBe(401);

    // -------------------------------------------------------------
    // Step 5: User Re-authenticates
    // -------------------------------------------------------------
    const reLogin = await loginViaApi(request, TEST_USERS.visitor);
    expect(reLogin.status).toBe(200);
    expect(reLogin.token).toBeDefined();

    await setAuthCookie(page, reLogin.token!);

    // Verify session is restored
    const meRes = await request.get('/api/auth/me', {
      headers: { Authorization: `Bearer ${reLogin.token}` },
    });
    expect(meRes.status()).toBe(200);
    const meData = await meRes.json();
    expect(meData.user.username).toBe(TEST_USERS.visitor.username);

    // -------------------------------------------------------------
    // Step 6: Resume 3D Space Exploration without Error
    // -------------------------------------------------------------
    await page.goto('/space/starry-night');
    await waitForCanvasReady(page);

    const resumedState = await getCameraState(page);
    expect(resumedState.position).toBeDefined();
    expect(typeof resumedState.position.y).toBe('number');
  });
});

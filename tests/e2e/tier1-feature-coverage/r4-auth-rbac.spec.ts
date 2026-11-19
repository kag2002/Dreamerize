import { test, expect } from '@playwright/test';
import {
  TEST_USERS,
  generateUniqueUser,
  registerViaApi,
  loginViaApi,
} from '../fixtures/testUsers';

test.describe('Tier 1 - R4: User Management, Session & RBAC Security', () => {
  test('T1-R4-01: User Registration - Submitting registration creates account and returns HTTP 201', async ({
    request,
  }) => {
    const newUser = generateUniqueUser('visitor');
    const { status, body } = await registerViaApi(request, newUser);

    expect(status).toBe(201);
    expect(body?.success).toBe(true);
    expect(body?.user?.username).toBe(newUser.username);
    expect(body?.user?.email).toBe(newUser.email);
    expect(body?.user?.role).toBe('visitor');
    expect(body?.user?.password).toBeUndefined();
    expect(body?.user?.password_hash).toBeUndefined();
  });

  test('T1-R4-02: User Login & Session Cookie - Logging in sets HTTP-only cookie and returns user role', async ({
    request,
  }) => {
    const { status, response, body } = await loginViaApi(request, TEST_USERS.creator);

    expect(status).toBe(200);
    expect(body?.success).toBe(true);
    expect(body?.user?.role).toBe('creator');
    expect(body?.token).toBeDefined();

    // Verify Set-Cookie header sets httpOnly token
    const setCookie = response.headers()['set-cookie'] || '';
    expect(setCookie).toContain('token=');
    expect(setCookie.toLowerCase()).toContain('httponly');
  });

  test('T1-R4-03: Visitor Role Restrictions - Visitor cannot create spaces (returns HTTP 403 Forbidden)', async ({
    request,
  }) => {
    // 1. Log in as visitor
    const login = await loginViaApi(request, TEST_USERS.visitor);
    expect(login.status).toBe(200);

    // 2. Attempt POST /api/spaces
    const spaceRes = await request.post('/api/spaces', {
      headers: {
        Authorization: `Bearer ${login.token}`,
      },
      data: {
        slug: 'visitor-forbidden-space',
        name: 'Forbidden Space',
        config: {},
      },
    });

    expect(spaceRes.status()).toBe(403);
    const body = await spaceRes.json();
    expect(body.error).toBe('Forbidden');
    expect(body.message).toContain('Access denied');
  });

  test('T1-R4-04: Creator Role Permissions - Creator can mutate space settings via PUT /api/spaces/:id (HTTP 200)', async ({
    request,
  }) => {
    // 1. Log in as creator
    const login = await loginViaApi(request, TEST_USERS.creator);
    expect(login.status).toBe(200);

    try {
      // 2. Mutate space config
      const updateRes = await request.put('/api/spaces/space-starry-night', {
        headers: {
          Authorization: `Bearer ${login.token}`,
        },
        data: {
          name: 'The Starry Night (Updated Title)',
        },
      });

      expect(updateRes.status()).toBe(200);
      const body = await updateRes.json();
      expect(body.success).toBe(true);
      expect(body.space.name).toBe('The Starry Night (Updated Title)');
    } finally {
      // Revert space name to maintain idempotent database seed state
      await request.put('/api/spaces/space-starry-night', {
        headers: { Authorization: `Bearer ${login.token}` },
        data: { name: 'The Starry Night' },
      });
    }
  });

  test('T1-R4-05: Unauthenticated Route Protection - Protected endpoints without token return HTTP 401 Unauthorized', async ({
    request,
  }) => {
    const resPost = await request.post('/api/spaces', {
      data: { slug: 'unauth-space', name: 'Unauth Space' },
    });
    expect(resPost.status()).toBe(401);

    const resPut = await request.put('/api/spaces/space-starry-night', {
      data: { name: 'Hacked Title' },
    });
    expect(resPut.status()).toBe(401);

    const resDelete = await request.delete('/api/spaces/space-starry-night');
    expect(resDelete.status()).toBe(401);
  });

  test('T1-R4-06: User Logout - Logout clears session and invalidates subsequent protected requests', async ({
    request,
  }) => {
    // 1. Log in
    const login = await loginViaApi(request, TEST_USERS.creator);
    expect(login.status).toBe(200);

    // 2. Log out
    const logoutRes = await request.post('/api/auth/logout');
    expect(logoutRes.status()).toBe(200);

    // 3. Verify session invalidation on GET /api/auth/me
    const meRes = await request.get('/api/auth/me');
    expect(meRes.status()).toBe(401);
  });
});

import { test, expect } from '@playwright/test';
import {
  TEST_USERS,
  generateUniqueUser,
  registerViaApi,
  loginViaApi,
} from '../fixtures/testUsers';

test.describe('Tier 2 - Boundary R4: User Management & RBAC Security', () => {
  test('T2-R4-01: Authentication Validation Boundaries - Short password, empty username, invalid email reject with HTTP 400', async ({
    request,
  }) => {
    // 1. Password too short (< 6 chars)
    const shortPassRes = await request.post('/api/auth/register', {
      data: {
        username: 'validuser',
        email: 'valid@dreamerize.local',
        password: '123',
      },
    });
    expect(shortPassRes.status()).toBe(400);

    // 2. Empty username
    const emptyUserRes = await request.post('/api/auth/register', {
      data: {
        username: '',
        email: 'emptyuser@dreamerize.local',
        password: 'ValidPassword123!',
      },
    });
    expect(emptyUserRes.status()).toBe(400);

    // 3. Invalid email format
    const invalidEmailRes = await request.post('/api/auth/register', {
      data: {
        username: 'validuser2',
        email: 'not-an-email',
        password: 'ValidPassword123!',
      },
    });
    expect(invalidEmailRes.status()).toBe(400);

    // 4. Extreme payload size (10,000 char username)
    const giantPayloadRes = await request.post('/api/auth/register', {
      data: {
        username: 'A'.repeat(10000),
        email: 'giant@dreamerize.local',
        password: 'ValidPassword123!',
      },
    });
    expect(giantPayloadRes.status()).toBe(400);
  });

  test('T2-R4-02: Duplicate Registration Collision - Existing username or email returns HTTP 400 or 409 with ConflictError', async ({
    request,
  }) => {
    const existingUser = generateUniqueUser('visitor');
    // Register once
    const firstReg = await registerViaApi(request, existingUser);
    expect(firstReg.status).toBe(201);

    // Attempt second registration with same username
    const dupRes = await registerViaApi(request, existingUser);
    expect([400, 409]).toContain(dupRes.status);
    expect(dupRes.body?.error).toBe('ConflictError');
    expect(dupRes.body?.message).toContain('already exists');
  });

  test('T2-R4-03: Tampered & Expired JWT Tokens - Modifying token signature rejects with HTTP 401', async ({
    request,
  }) => {
    // Take a tampered JWT with altered payload/signature
    const tamperedToken =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTEiLCJyb2xlIjoiY3JlYXRvciJ9.invalidSignatureABC123';

    const res = await request.get('/api/auth/me', {
      headers: {
        Authorization: `Bearer ${tamperedToken}`,
      },
    });

    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  test('T2-R4-04: SQL Injection Attack Mitigation - Classic SQL injection strings fail safely without syntax errors', async ({
    request,
  }) => {
    const sqlPayloads = [
      "admin' OR '1'='1",
      "'; DROP TABLE users; --",
      "' UNION SELECT null, null, null, null, null --",
    ];

    for (const payload of sqlPayloads) {
      const loginRes = await request.post('/api/auth/login', {
        data: {
          username: payload,
          password: 'arbitraryPassword123',
        },
      });

      // Must be safely rejected with 401 Unauthorized, never 500 internal database error
      expect(loginRes.status()).toBe(401);
      const body = await loginRes.json();
      expect(body.error).toBe('Unauthorized');
    }
  });

  test('T2-R4-05: Visitor Privilege Escalation Prevention - Visitor spoofing role in headers/body is rejected with 403', async ({
    request,
  }) => {
    // 1. Log in as authentic visitor
    const login = await loginViaApi(request, TEST_USERS.visitor);
    expect(login.status).toBe(200);

    // 2. Attempt space mutation with spoofed creator headers & body
    const mutateRes = await request.put('/api/spaces/space-starry-night', {
      headers: {
        Authorization: `Bearer ${login.token}`,
        'X-User-Role': 'creator',
      },
      data: {
        role: 'creator',
        name: 'Privilege Escalation Attempt',
      },
    });

    expect(mutateRes.status()).toBe(403);
    const body = await mutateRes.json();
    expect(body.error).toBe('Forbidden');
    expect(body.message).toContain('Access denied');
  });
});

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { DatabaseSync } from 'node:sqlite';
import { app } from '../../src/server/app';
import { setDatabase, closeDatabase } from '../../src/server/db/connection';
import { seedDatabase } from '../../src/server/db/seed';

describe('Auth API Integration Tests', () => {
  let db: DatabaseSync;

  beforeAll(() => {
    db = new DatabaseSync(':memory:');
    setDatabase(db);
    seedDatabase(db);
  });

  afterAll(() => {
    closeDatabase();
  });

  describe('POST /api/auth/register', () => {
    it('registers a new visitor user successfully', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'new_visitor',
          email: 'visitor@example.com',
          password: 'Password123!',
          role: 'visitor'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.username).toBe('new_visitor');
      expect(res.body.user.email).toBe('visitor@example.com');
      expect(res.body.user.role).toBe('visitor');
      expect(res.body.user.passwordHash).toBeUndefined();
    });

    it('returns 400 on duplicate username', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'admin', // already seeded
          email: 'admin_duplicate@example.com',
          password: 'Password123!'
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('ConflictError');
    });

    it('returns 400 on invalid email or short password', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'invalid_user',
          email: 'not-an-email',
          password: '123'
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('ValidationError');
    });
  });

  describe('POST /api/auth/login', () => {
    it('logs in successfully with seeded admin account and sets cookie', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'admin',
          password: 'AdminPass123!'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.username).toBe('admin');
      expect(res.body.user.role).toBe('creator');

      // Verify Set-Cookie header
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies[0]).toMatch(/token=/);
      expect(cookies[0]).toMatch(/HttpOnly/i);
    });

    it('returns 401 with incorrect password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'admin',
          password: 'WrongPassword!'
        });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Unauthorized');
    });

    it('returns 401 with non-existent username', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'ghost_user',
          password: 'AnyPassword123!'
        });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Unauthorized');
    });
  });

  describe('GET /api/auth/me', () => {
    it('returns current user info with Bearer token', async () => {
      // First login to get token
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'visitor',
          password: 'VisitorPass123!'
        });

      const token = loginRes.body.token;

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.username).toBe('visitor');
      expect(res.body.user.role).toBe('visitor');
    });

    it('returns current user info with Cookie token', async () => {
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'admin',
          password: 'AdminPass123!'
        });

      const cookie = loginRes.headers['set-cookie'];

      const res = await request(app)
        .get('/api/auth/me')
        .set('Cookie', cookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.username).toBe('admin');
      expect(res.body.user.role).toBe('creator');
    });

    it('returns 401 when no token is provided', async () => {
      const res = await request(app).get('/api/auth/me');

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Unauthorized');
    });
  });

  describe('GET /api/health', () => {
    it('returns 200 OK with server health info', async () => {
      const res = await request(app).get('/api/health');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.timestamp).toBeDefined();
    });
  });

  describe('POST /api/auth/logout', () => {
    it('clears token cookie on logout', async () => {
      const res = await request(app).post('/api/auth/logout');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies[0]).toMatch(/token=;/);
    });
  });
});

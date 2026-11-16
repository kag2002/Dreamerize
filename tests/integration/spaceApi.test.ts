import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { DatabaseSync } from 'node:sqlite';
import { app } from '../../src/server/app';
import { setDatabase, closeDatabase } from '../../src/server/db/connection';
import { seedDatabase, DEFAULT_STARRY_NIGHT_CONFIG } from '../../src/server/db/seed';

describe('Space API Integration Tests', () => {
  let db: DatabaseSync;
  let adminToken: string;
  let visitorToken: string;

  beforeAll(async () => {
    db = new DatabaseSync(':memory:');
    setDatabase(db);
    seedDatabase(db);

    // Obtain creator token
    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'AdminPass123!' });
    adminToken = adminLogin.body.token;

    // Obtain visitor token
    const visitorLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: 'visitor', password: 'VisitorPass123!' });
    visitorToken = visitorLogin.body.token;
  });

  afterAll(() => {
    closeDatabase();
  });

  describe('GET /api/spaces', () => {
    it('returns published spaces to unauthenticated user', async () => {
      const res = await request(app).get('/api/spaces');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.spaces)).toBe(true);
      expect(res.body.spaces.length).toBeGreaterThanOrEqual(2);

      const slugs = res.body.spaces.map((s: any) => s.slug);
      expect(slugs).toContain('starry-night');
      expect(slugs).toContain('breezy-meadow');
    });
  });

  describe('GET /api/spaces/:id', () => {
    it('returns space by slug or id', async () => {
      const res = await request(app).get('/api/spaces/starry-night');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.space.slug).toBe('starry-night');
      expect(res.body.space.name).toBe('The Starry Night');
      expect(res.body.space.config.sky.type).toBe('starry_night_flow');
    });

    it('returns 404 for nonexistent space', async () => {
      const res = await request(app).get('/api/spaces/nonexistent-space');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('NotFound');
    });
  });

  describe('POST /api/spaces (RBAC)', () => {
    const newSpacePayload = {
      slug: 'sunset-valley',
      name: 'Sunset Valley',
      description: 'A serene valley during golden hour',
      isPublished: true,
      config: DEFAULT_STARRY_NIGHT_CONFIG
    };

    it('returns 401 Unauthorized when unauthenticated', async () => {
      const res = await request(app)
        .post('/api/spaces')
        .send(newSpacePayload);

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Unauthorized');
    });

    it('returns 403 Forbidden when visitor role attempts to create space', async () => {
      const res = await request(app)
        .post('/api/spaces')
        .set('Authorization', `Bearer ${visitorToken}`)
        .send(newSpacePayload);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Forbidden');
    });

    it('returns 201 Created when creator role creates space', async () => {
      const res = await request(app)
        .post('/api/spaces')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newSpacePayload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.space.slug).toBe('sunset-valley');
      expect(res.body.space.creatorId).toBe('user-creator-admin');

      // Verify space can now be fetched publicly
      const fetchRes = await request(app).get('/api/spaces/sunset-valley');
      expect(fetchRes.status).toBe(200);
      expect(fetchRes.body.space.name).toBe('Sunset Valley');
    });
  });

  describe('PUT /api/spaces/:id (RBAC)', () => {
    const updatePayload = {
      name: 'The Starry Night (Remastered)',
      config: {
        wind: {
          speed: 3.5,
          direction: [1, 0, 0] as [number, number, number],
          gustiness: 0.5,
          swayIntensity: 0.6
        }
      }
    };

    it('returns 401 Unauthorized when unauthenticated', async () => {
      const res = await request(app)
        .put('/api/spaces/starry-night')
        .send(updatePayload);

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Unauthorized');
    });

    it('returns 403 Forbidden when visitor role attempts to update space', async () => {
      const res = await request(app)
        .put('/api/spaces/starry-night')
        .set('Authorization', `Bearer ${visitorToken}`)
        .send(updatePayload);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Forbidden');
    });

    it('returns 200 OK when creator role updates space', async () => {
      const res = await request(app)
        .put('/api/spaces/starry-night')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updatePayload);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.space.name).toBe('The Starry Night (Remastered)');
      expect(res.body.space.config.wind.speed).toBe(3.5);
    });

    it('returns 404 when updating non-existent space', async () => {
      const res = await request(app)
        .put('/api/spaces/nonexistent-space')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Does Not Exist' });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('NotFound');
    });
  });

  describe('DELETE /api/spaces/:id (RBAC)', () => {
    it('returns 401 Unauthorized when unauthenticated', async () => {
      const res = await request(app).delete('/api/spaces/sunset-valley');

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Unauthorized');
    });

    it('returns 403 Forbidden when visitor attempts to delete space', async () => {
      const res = await request(app)
        .delete('/api/spaces/sunset-valley')
        .set('Authorization', `Bearer ${visitorToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Forbidden');
    });

    it('returns 200 OK when creator deletes space', async () => {
      const res = await request(app)
        .delete('/api/spaces/sunset-valley')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify it is gone
      const fetchRes = await request(app).get('/api/spaces/sunset-valley');
      expect(fetchRes.status).toBe(404);
    });

    it('returns 404 when deleting already deleted or nonexistent space', async () => {
      const res = await request(app)
        .delete('/api/spaces/nonexistent-space')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('NotFound');
    });
  });
});

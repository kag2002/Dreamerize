import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { app } from '../../src/server/app';
import { setDatabase, closeDatabase } from '../../src/server/db/connection';
import { seedDatabase, DEFAULT_STARRY_NIGHT_CONFIG, DEFAULT_3DGS_COASTAL_SANCTUARY_CONFIG } from '../../src/server/db/seed';
import { ASSETS_UPLOAD_DIR } from '../../src/server/routes/spaceRoutes';

describe('Space API Integration Tests', () => {
  let db: DatabaseSync;
  let adminToken: string;
  let visitorToken: string;
  const uploadedFiles: string[] = [];

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
    for (const filePath of uploadedFiles) {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch {
        // ignore cleanup errors
      }
    }
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

  describe('3D Asset Upload & Serving (POST/GET /api/spaces/assets)', () => {
    const sampleSplatBytes = Buffer.alloc(64, 0x2a);
    const sampleGlbBytes = Buffer.from('glTF\x02\x00\x00\x00\x14\x00\x00\x00', 'binary');

    it('returns 401 Unauthorized when unauthenticated user uploads an asset', async () => {
      const res = await request(app)
        .post('/api/spaces/assets?filename=test.splat')
        .set('Content-Type', 'application/octet-stream')
        .send(sampleSplatBytes);

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Unauthorized');
    });

    it('returns 403 Forbidden when visitor role attempts to upload an asset', async () => {
      const res = await request(app)
        .post('/api/spaces/assets?filename=test.splat')
        .set('Authorization', `Bearer ${visitorToken}`)
        .set('Content-Type', 'application/octet-stream')
        .send(sampleSplatBytes);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Forbidden');
    });

    it('returns 400 BadRequest for disallowed extensions and empty payloads', async () => {
      const badExt = await request(app)
        .post('/api/spaces/assets?filename=malware.exe')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Content-Type', 'application/octet-stream')
        .send(sampleSplatBytes);

      expect(badExt.status).toBe(400);

      const emptyRes = await request(app)
        .post('/api/spaces/assets?filename=empty.glb')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Content-Type', 'model/gltf-binary')
        .send(Buffer.alloc(0));

      expect(emptyRes.status).toBe(400);
    });

    it('allows creator to upload .splat and .glb assets and serves them back safely', async () => {
      const splatRes = await request(app)
        .post('/api/spaces/assets?filename=my-garden.splat')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Content-Type', 'application/octet-stream')
        .send(sampleSplatBytes);

      expect(splatRes.status).toBe(201);
      expect(splatRes.body.success).toBe(true);
      expect(splatRes.body.assetFormat).toBe('splat');
      expect(splatRes.body.bytes).toBe(sampleSplatBytes.length);
      expect(splatRes.body.assetUrl).toMatch(/^\/api\/spaces\/assets\/[a-z0-9-]+\.splat$/);

      const splatFilename = path.basename(splatRes.body.assetUrl);
      uploadedFiles.push(path.join(ASSETS_UPLOAD_DIR, splatFilename));

      const fetchSplat = await request(app)
        .get(splatRes.body.assetUrl)
        .buffer(true)
        .parse((res, cb) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk) => chunks.push(chunk));
          res.on('end', () => cb(null, Buffer.concat(chunks)));
        });
      expect(fetchSplat.status).toBe(200);
      expect(Buffer.compare(fetchSplat.body, sampleSplatBytes)).toBe(0);

      const glbRes = await request(app)
        .post('/api/spaces/assets')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-filename', 'lantern.glb')
        .set('Content-Type', 'model/gltf-binary')
        .send(sampleGlbBytes);

      expect(glbRes.status).toBe(201);
      expect(glbRes.body.assetFormat).toBe('glb');
      expect(glbRes.body.assetUrl).toMatch(/^\/api\/spaces\/assets\/[a-z0-9-]+\.glb$/);

      const glbFilename = path.basename(glbRes.body.assetUrl);
      uploadedFiles.push(path.join(ASSETS_UPLOAD_DIR, glbFilename));

      const fetchGlb = await request(app).get(glbRes.body.assetUrl);
      expect(fetchGlb.status).toBe(200);
      expect(fetchGlb.headers['content-type']).toMatch(/model\/gltf-binary/);

      // Create a custom space referencing the uploaded GLB asset
      const createRes = await request(app)
        .post('/api/spaces')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          slug: 'custom-stone-lantern',
          name: 'Custom Stone Lantern',
          description: 'Creator imported GLB space',
          config: {
            ...DEFAULT_3DGS_COASTAL_SANCTUARY_CONFIG,
            assetFormat: 'glb',
            assetUrl: glbRes.body.assetUrl
          }
        });

      expect(createRes.status).toBe(201);
      expect(createRes.body.space.config.assetFormat).toBe('glb');
      expect(createRes.body.space.config.assetUrl).toBe(glbRes.body.assetUrl);
    });

    it('rejects path traversal and unsafe assetUrl payloads', async () => {
      const traversal = await request(app).get('/api/spaces/assets/..%2F..%2Fpackage.json');
      expect(traversal.status).toBe(400);

      const badUrlSpace = await request(app)
        .post('/api/spaces')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          slug: 'unsafe-asset-space',
          name: 'Unsafe',
          config: {
            ...DEFAULT_3DGS_COASTAL_SANCTUARY_CONFIG,
            assetFormat: 'splat',
            assetUrl: 'javascript:alert(1)'
          }
        });

      expect(badUrlSpace.status).toBe(400);
    });
  });
});

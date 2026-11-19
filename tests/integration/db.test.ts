import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { runMigrations } from '../../src/server/db/migrations';
import { seedDatabase } from '../../src/server/db/seed';
import { verifyPassword } from '../../src/server/services/authService';

describe('Database Integration Tests (node:sqlite)', () => {
  it('executes migrations cleanly and enforces single-quoted CHECK constraints', () => {
    const db = new DatabaseSync(':memory:');
    runMigrations(db);

    // Verify tables exist
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('users', 'spaces')")
      .all() as Array<{ name: string }>;

    expect(tables.map((t) => t.name).sort()).toEqual(['spaces', 'users']);

    // Test valid role insertion
    const now = new Date().toISOString();
    expect(() => {
      db.prepare(`
        INSERT INTO users (id, username, email, password_hash, role, created_at, updated_at)
        VALUES ('u-valid', 'valid_user', 'valid@test.local', 'hash', 'creator', ?, ?)
      `).run(now, now);
    }).not.toThrow();

    // Test invalid role violates CHECK constraint
    expect(() => {
      db.prepare(`
        INSERT INTO users (id, username, email, password_hash, role, created_at, updated_at)
        VALUES ('u-invalid', 'invalid_user', 'invalid@test.local', 'hash', 'superuser', ?, ?)
      `).run(now, now);
    }).toThrow(/CHECK constraint failed/);

    db.close();
  });

  it('enforces foreign key constraints on spaces.creator_id', () => {
    const db = new DatabaseSync(':memory:');
    runMigrations(db);

    const now = new Date().toISOString();

    // Attempt to insert space with nonexistent creator_id
    expect(() => {
      db.prepare(`
        INSERT INTO spaces (id, slug, name, creator_id, is_published, config, created_at, updated_at)
        VALUES ('s1', 'orphan-space', 'Orphan', 'nonexistent-user-id', 1, '{}', ?, ?)
      `).run(now, now);
    }).toThrow(/FOREIGN KEY constraint failed/);

    db.close();
  });

  it('enforces CHECK constraint on spaces.is_published', () => {
    const db = new DatabaseSync(':memory:');
    runMigrations(db);

    const now = new Date().toISOString();

    // Insert user first
    db.prepare(`
      INSERT INTO users (id, username, email, password_hash, role, created_at, updated_at)
      VALUES ('u-creator', 'test_creator', 'c@test.local', 'hash', 'creator', ?, ?)
    `).run(now, now);

    // Attempt to insert space with is_published = 5
    expect(() => {
      db.prepare(`
        INSERT INTO spaces (id, slug, name, creator_id, is_published, config, created_at, updated_at)
        VALUES ('s-invalid', 'bad-published', 'Bad Pub', 'u-creator', 5, '{}', ?, ?)
      `).run(now, now);
    }).toThrow(/CHECK constraint failed/);

    db.close();
  });

  it('seeds default creator, visitor, and spaces correctly', () => {
    const db = new DatabaseSync(':memory:');
    seedDatabase(db);

    // Check users
    const users = db.prepare('SELECT * FROM users ORDER BY role').all() as any[];
    expect(users.length).toBe(2);

    const admin = users.find((u) => u.username === 'admin');
    const visitor = users.find((u) => u.username === 'visitor');

    expect(admin).toBeDefined();
    expect(admin.role).toBe('creator');
    expect(verifyPassword('AdminPass123!', admin.password_hash)).toBe(true);

    expect(visitor).toBeDefined();
    expect(visitor.role).toBe('visitor');
    expect(verifyPassword('VisitorPass123!', visitor.password_hash)).toBe(true);

    // Check spaces
    const spaces = db.prepare('SELECT * FROM spaces ORDER BY slug').all() as any[];
    expect(spaces.length).toBe(7);

    const starry = spaces.find((s) => s.slug === 'starry-night');
    const meadow = spaces.find((s) => s.slug === 'breezy-meadow');
    const cosmic = spaces.find((s) => s.slug === 'cosmic-blackhole');
    const forest = spaces.find((s) => s.slug === 'misty-forest');
    const paradise = spaces.find((s) => s.slug === 'paradise-sanctuary');
    const ghibli = spaces.find((s) => s.slug === 'ghibli-valley');
    const vietnam = spaces.find((s) => s.slug === 'vietnam-heritage');

    expect(starry).toBeDefined();
    expect(starry.name).toBe('The Starry Night');
    expect(starry.creator_id).toBe('user-creator-admin');

    // Check JSON extraction
    const jsonTest = db
      .prepare("SELECT json_extract(config, '$.sky.swirlSpeed') as swirlSpeed FROM spaces WHERE slug = 'starry-night'")
      .get() as { swirlSpeed: number };

    expect(jsonTest.swirlSpeed).toBe(1.2);

    expect(meadow).toBeDefined();
    expect(meadow.name).toBe('Ngọn đồi gió thoảng với hoa cỏ');
    expect(cosmic).toBeDefined();
    expect(cosmic.name).toBe('Vũ trụ Hố đen & Mặt trời siêu thực');
    expect(forest).toBeDefined();
    expect(forest.name).toBe('Không gian Núi rừng');
    expect(paradise).toBeDefined();
    expect(paradise.name).toBe('Thiên đường');
    expect(ghibli).toBeDefined();
    expect(ghibli.name).toBe('Thế giới Ghibli');
    expect(vietnam).toBeDefined();
    expect(vietnam.name).toBe('Việt Nam Kỳ Vĩ — Danh Thắng Di Sản');

    // Verify 2x doubled wanderRadius across built-in spaces
    expect(JSON.parse(starry.config).camera.wanderRadius).toBe(70);
    expect(JSON.parse(meadow.config).camera.wanderRadius).toBe(90);
    expect(JSON.parse(cosmic.config).camera.wanderRadius).toBe(124);
    expect(JSON.parse(forest.config).camera.wanderRadius).toBe(124);
    expect(JSON.parse(paradise.config).camera.wanderRadius).toBe(120);
    expect(JSON.parse(ghibli.config).camera.wanderRadius).toBe(128);
    expect(JSON.parse(vietnam.config).camera.wanderRadius).toBe(1450);

    db.close();
  });
});

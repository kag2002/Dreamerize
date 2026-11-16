import { DatabaseSync } from 'node:sqlite';
import { getDatabase } from './connection';

export function runMigrations(dbInstance?: DatabaseSync): void {
  const db = dbInstance || getDatabase();

  db.exec('PRAGMA foreign_keys = ON;');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('creator', 'visitor')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

    CREATE TABLE IF NOT EXISTS spaces (
      id TEXT PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      thumbnail_url TEXT,
      creator_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      is_published INTEGER NOT NULL DEFAULT 1 CHECK(is_published IN (0, 1)),
      config TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_spaces_slug ON spaces(slug);
    CREATE INDEX IF NOT EXISTS idx_spaces_creator ON spaces(creator_id);
    CREATE INDEX IF NOT EXISTS idx_spaces_published ON spaces(is_published);
  `);
}

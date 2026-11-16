import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { DB_PATH } from '../config';

let activeDb: DatabaseSync | null = null;

export function getDatabase(customPath?: string): DatabaseSync {
  if (customPath) {
    if (customPath !== ':memory:') {
      const dir = path.dirname(customPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
    const db = new DatabaseSync(customPath);
    db.exec('PRAGMA foreign_keys = ON;');
    if (customPath !== ':memory:') {
      db.exec('PRAGMA journal_mode = WAL;');
    }
    return db;
  }

  if (!activeDb) {
    const targetPath = DB_PATH;
    if (targetPath !== ':memory:') {
      const dir = path.dirname(targetPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
    activeDb = new DatabaseSync(targetPath);
    activeDb.exec('PRAGMA foreign_keys = ON;');
    if (targetPath !== ':memory:') {
      activeDb.exec('PRAGMA journal_mode = WAL;');
    }
  }

  return activeDb;
}

export function setDatabase(db: DatabaseSync | null): void {
  if (activeDb && activeDb !== db) {
    try {
      activeDb.close();
    } catch {
      // ignore
    }
  }
  activeDb = db;
}

export function closeDatabase(): void {
  if (activeDb) {
    activeDb.close();
    activeDb = null;
  }
}

import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;
  fs.mkdirSync(path.dirname(config.db.file), { recursive: true });
  db = new Database(config.db.file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  return db;
}

export function closeDb() {
  db?.close();
  db = null;
}

/** Run `fn` inside an immediate (write-locking) transaction. */
export function tx<T>(fn: () => T): T {
  const run = getDb().transaction(fn);
  return run.immediate();
}

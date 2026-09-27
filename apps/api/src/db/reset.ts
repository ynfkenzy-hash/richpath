/** Drops the configured SQLite file and rebuilds it with seed data. */
import fs from 'node:fs';
import { config } from '../config.js';
import { closeDb } from './index.js';
import { seed } from './seed.js';

for (const suffix of ['', '-wal', '-shm']) {
  const file = config.db.file + suffix;
  if (fs.existsSync(file)) {
    fs.rmSync(file);
    console.log(`[reset] removed ${file}`);
  }
}
closeDb();
seed();
console.log('[reset] database rebuilt');

import { assertConfig, config } from './config.js';
import { getDb } from './db/index.js';
import { migrate } from './db/migrate.js';
import { createApp } from './app.js';
import { releasePending } from './lib/ledger.js';
import { processPendingWithdrawals } from './modules/withdrawals/service.js';

assertConfig();
migrate();

const app = createApp();
const db = getDb();

/**
 * Background tick: promotes matured data without needing a job runner in dev.
 * In production move these to a scheduler (node-cron, a queue worker, or the
 * platform's cron) so multiple API instances don't duplicate work.
 */
const TICK_MS = 5_000;
setInterval(() => {
  try {
    // Rewards that finished their review hold become withdrawable.
    const due = db
      .prepare(
        `SELECT DISTINCT user_id FROM task_completions
          WHERE status = 'pending_review' AND release_at IS NOT NULL AND release_at <= datetime('now')`,
      )
      .all() as { user_id: string }[];
    for (const row of due) {
      db.prepare(`UPDATE task_completions SET status = 'credited' WHERE user_id = ? AND status = 'pending_review' AND release_at <= datetime('now')`)
        .run(row.user_id);
      releasePending(row.user_id);
    }
    processPendingWithdrawals();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[tick]', err);
  }
}, TICK_MS).unref();

const server = app.listen(config.port, '0.0.0.0', () => {
  // eslint-disable-next-line no-console
  console.log(`[api] listening on http://0.0.0.0:${config.port} (env: ${config.env})`);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    // eslint-disable-next-line no-console
    console.log(`[api] ${signal} received, shutting down`);
    server.close(() => process.exit(0));
  });
}

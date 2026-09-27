/**
 * Forward-only schema migrations.
 * Each entry runs once and is recorded in `schema_migrations`.
 * Money is ALWAYS stored as integer cents.
 */
import { getDb } from './index.js';

type Migration = { id: string; sql: string };

const migrations: Migration[] = [
  {
    id: '001_init',
    sql: `
    CREATE TABLE users (
      id              TEXT PRIMARY KEY,
      name            TEXT NOT NULL,
      email           TEXT NOT NULL UNIQUE,
      password_hash   TEXT NOT NULL,
      referral_code   TEXT NOT NULL UNIQUE,
      referred_by     TEXT REFERENCES users(id),
      balance_cents   INTEGER NOT NULL DEFAULT 0,
      pending_cents   INTEGER NOT NULL DEFAULT 0,
      lifetime_cents  INTEGER NOT NULL DEFAULT 0,
      locale          TEXT NOT NULL DEFAULT 'en',
      verified        INTEGER NOT NULL DEFAULT 0,
      status          TEXT NOT NULL DEFAULT 'active',   -- active | suspended
      failed_logins   INTEGER NOT NULL DEFAULT 0,
      locked_until    TEXT,
      reg_ip          TEXT,
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX idx_users_referred_by ON users(referred_by);

    CREATE TABLE sessions (
      id          TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at  TEXT NOT NULL,
      revoked     INTEGER NOT NULL DEFAULT 0,
      ip          TEXT,
      user_agent  TEXT
    );
    CREATE INDEX idx_sessions_user ON sessions(user_id);

    CREATE TABLE tasks (
      id            TEXT PRIMARY KEY,
      slug          TEXT NOT NULL UNIQUE,
      title         TEXT NOT NULL,
      description   TEXT NOT NULL,
      category      TEXT NOT NULL,              -- game | survey | app | signup
      reward_cents  INTEGER NOT NULL,
      est_minutes   INTEGER NOT NULL DEFAULT 3,
      offer_url     TEXT NOT NULL,
      logo_color    TEXT NOT NULL DEFAULT '#2F6BFF',
      provider      TEXT NOT NULL DEFAULT 'mock',
      active        INTEGER NOT NULL DEFAULT 1,
      sort_order    INTEGER NOT NULL DEFAULT 0,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE task_completions (
      id               TEXT PRIMARY KEY,
      user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      task_id          TEXT NOT NULL REFERENCES tasks(id),
      status           TEXT NOT NULL,           -- started | pending_review | credited | rejected
      reward_cents     INTEGER NOT NULL,
      started_at       TEXT NOT NULL DEFAULT (datetime('now')),
      credited_at      TEXT,
      release_at       TEXT,                    -- when pending -> balance
      provider_txn_id  TEXT,
      proof_token      TEXT,
      ip               TEXT,
      UNIQUE (user_id, task_id, provider_txn_id) ON CONFLICT IGNORE
    );
    CREATE INDEX idx_completions_user_task ON task_completions(user_id, task_id, started_at);

    CREATE TABLE videos (
      id                TEXT PRIMARY KEY,
      youtube_id        TEXT NOT NULL UNIQUE,
      title             TEXT NOT NULL,
      reward_cents      INTEGER NOT NULL,
      duration_seconds  INTEGER NOT NULL DEFAULT 30,
      active            INTEGER NOT NULL DEFAULT 1,
      sort_order        INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE video_views (
      id               TEXT PRIMARY KEY,
      user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      video_id         TEXT NOT NULL REFERENCES videos(id),
      seconds_watched  INTEGER NOT NULL,
      reward_cents     INTEGER NOT NULL,
      watched_at       TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX idx_video_views_user ON video_views(user_id, watched_at);

    CREATE TABLE daily_claims (
      id            TEXT PRIMARY KEY,
      user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      claim_date    TEXT NOT NULL,              -- YYYY-MM-DD (UTC)
      streak        INTEGER NOT NULL,
      reward_cents  INTEGER NOT NULL,
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (user_id, claim_date)
    );

    CREATE TABLE ledger (
      id                   TEXT PRIMARY KEY,
      user_id              TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type                 TEXT NOT NULL,       -- task|video|daily|referral|welcome|withdrawal
      amount_cents         INTEGER NOT NULL,    -- + credit, - debit
      balance_after_cents  INTEGER NOT NULL,
      description          TEXT NOT NULL,
      ref_type             TEXT,
      ref_id               TEXT,
      created_at           TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX idx_ledger_user ON ledger(user_id, created_at DESC);

    CREATE TABLE referral_rewards (
      id           TEXT PRIMARY KEY,
      referrer_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      referee_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      kind         TEXT NOT NULL,               -- signup | income_share | milestone
      amount_cents INTEGER NOT NULL,
      created_at   TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (referrer_id, referee_id, kind)
    );

    CREATE TABLE payment_methods (
      id                 TEXT PRIMARY KEY,
      user_id            TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      method             TEXT NOT NULL,         -- bank | usdt
      account_name       TEXT NOT NULL,
      destination_masked TEXT NOT NULL,
      destination_hash   TEXT NOT NULL,         -- for dedupe/abuse checks only
      created_at         TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at         TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (user_id, method)
    );

    CREATE TABLE withdrawals (
      id                 TEXT PRIMARY KEY,
      user_id            TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      amount_cents       INTEGER NOT NULL,
      method             TEXT NOT NULL,
      destination_masked TEXT NOT NULL,
      status             TEXT NOT NULL,         -- pending | under_review | payout_sent | failed
      note               TEXT,
      created_at         TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at         TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX idx_withdrawals_user ON withdrawals(user_id, created_at DESC);

    CREATE TABLE activity_feed (
      id            TEXT PRIMARY KEY,
      masked_name   TEXT NOT NULL,
      country_code  TEXT NOT NULL,
      amount_cents  INTEGER NOT NULL,
      at            TEXT NOT NULL DEFAULT (datetime('now')),
      is_demo       INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE content_reviews (
      id            TEXT PRIMARY KEY,
      masked_name   TEXT NOT NULL,
      country_code  TEXT NOT NULL,
      rating        INTEGER NOT NULL,
      body          TEXT NOT NULL,
      verified      INTEGER NOT NULL DEFAULT 1,
      is_demo       INTEGER NOT NULL DEFAULT 1,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE audit_log (
      id          TEXT PRIMARY KEY,
      user_id     TEXT,
      action      TEXT NOT NULL,
      ip          TEXT,
      meta        TEXT,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX idx_audit_user ON audit_log(user_id, created_at DESC);
    `,
  },
  {
    id: '003_video_author',
    sql: `
    ALTER TABLE videos ADD COLUMN author TEXT NOT NULL DEFAULT '';
    `,
  },
  {
    id: '002_login_attempts',
    sql: `
    CREATE TABLE login_attempts (
      id          TEXT PRIMARY KEY,
      email       TEXT NOT NULL,
      ip          TEXT NOT NULL,
      success     INTEGER NOT NULL,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX idx_login_attempts_email ON login_attempts(email, created_at DESC);
    `,
  },
];

export function migrate() {
  const db = getDb();
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    id TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);
  const applied = new Set(
    db.prepare('SELECT id FROM schema_migrations').all().map((r: any) => r.id as string),
  );
  for (const m of migrations) {
    if (applied.has(m.id)) continue;
    const run = db.transaction(() => {
      db.exec(m.sql);
      db.prepare('INSERT INTO schema_migrations (id) VALUES (?)').run(m.id);
    });
    run();
    // eslint-disable-next-line no-console
    console.log(`[migrate] applied ${m.id}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  migrate();
  console.log('[migrate] up to date');
}

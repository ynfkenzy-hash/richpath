import { getDb } from '../db/index.js';
import { newId } from './crypto.js';
import { signed } from './money.js';

export type LedgerType = 'task' | 'video' | 'daily' | 'referral' | 'welcome' | 'withdrawal';

export interface CreditOptions {
  userId: string;
  amountCents: number;             // > 0 credit, < 0 debit
  type: LedgerType;
  description: string;
  refType?: string;
  refId?: string;
  /** Credit to pending instead of withdrawable balance. */
  toPending?: boolean;
  /** Money moved out of withdrawable balance also leaves lifetime earned alone. */
  countAsEarning?: boolean;
}

/**
 * Single funnel for every balance mutation. MUST be called inside a
 * transaction (see tx() in db/index.ts) — it does not open one itself so
 * callers can group several writes atomically.
 */
export function applyLedger(opts: CreditOptions) {
  const db = getDb();
  const user = db
    .prepare('SELECT balance_cents, pending_cents, lifetime_cents FROM users WHERE id = ?')
    .get(opts.userId) as { balance_cents: number; pending_cents: number; lifetime_cents: number } | undefined;
  if (!user) throw new Error(`ledger: unknown user ${opts.userId}`);

  const toPending = opts.toPending ?? false;
  const balance = toPending ? user.balance_cents : user.balance_cents + opts.amountCents;
  const pending = toPending ? user.pending_cents + opts.amountCents : user.pending_cents;

  if (balance < 0) throw new Error('ledger: balance would go negative');

  const lifetime =
    opts.countAsEarning === false || opts.amountCents < 0
      ? user.lifetime_cents
      : user.lifetime_cents + opts.amountCents;

  db.prepare(
    `UPDATE users SET balance_cents = ?, pending_cents = ?, lifetime_cents = ?, updated_at = datetime('now')
      WHERE id = ?`,
  ).run(balance, pending, lifetime, opts.userId);

  const id = newId();
  db.prepare(
    `INSERT INTO ledger (id, user_id, type, amount_cents, balance_after_cents, description, ref_type, ref_id)
     VALUES (?,?,?,?,?,?,?,?)`,
  ).run(
    id,
    opts.userId,
    opts.type,
    opts.amountCents,
    balance,
    opts.description || signed(opts.amountCents),
    opts.refType ?? null,
    opts.refId ?? null,
  );
  return { id, balanceAfterCents: balance, pendingCents: pending, lifetimeCents: lifetime };
}

/** Move matured pending money into the withdrawable balance. */
export function releasePending(userId: string, refId?: string) {
  const db = getDb();
  const row = db.prepare('SELECT pending_cents FROM users WHERE id = ?').get(userId) as
    | { pending_cents: number }
    | undefined;
  if (!row || row.pending_cents <= 0) return 0;
  const amount = row.pending_cents;
  db.prepare(
    `UPDATE users SET pending_cents = 0, balance_cents = balance_cents + ?, updated_at = datetime('now')
      WHERE id = ?`,
  ).run(amount, userId);
  const balance = (
    db.prepare('SELECT balance_cents FROM users WHERE id = ?').get(userId) as { balance_cents: number }
  ).balance_cents;
  db.prepare(
    `INSERT INTO ledger (id, user_id, type, amount_cents, balance_after_cents, description, ref_type, ref_id)
     VALUES (?,?,?,?,?,?,?,?)`,
  ).run(newId(), userId, 'task', amount, balance, 'Reward cleared review', 'release', refId ?? null);
  return amount;
}

export function audit(userId: string | null, action: string, ip: string, meta?: Record<string, unknown>) {
  getDb()
    .prepare('INSERT INTO audit_log (id, user_id, action, ip, meta) VALUES (?,?,?,?,?)')
    .run(newId(), userId, action, ip, meta ? JSON.stringify(meta) : null);
}

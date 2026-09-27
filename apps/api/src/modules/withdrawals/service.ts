import { config } from '../../config.js';
import { getDb, tx } from '../../db/index.js';
import { maskDestination, newId, sha256 } from '../../lib/crypto.js';
import { BadRequest, Conflict, NotFound } from '../../lib/errors.js';
import { applyLedger, audit } from '../../lib/ledger.js';
import { maskEmail, notifyOperator } from '../../integrations/notify.js';
import { sqliteUtcToIso } from '../../lib/time.js';

export type PayoutMethod = 'bank' | 'usdt';

/** Completed tasks required before a first cash-out is reviewable. */
const MIN_TASKS_FOR_PAYOUT = 3;

export interface EligibilityReason {
  code: string;
  message: string;
  current?: number;
  required?: number;
}

/**
 * Eligibility for a cash-out.
 *
 * NOTE ON THE ORIGINAL UX: the reference site requires you to recruit N friends
 * before your first withdrawal. That turns payouts into a recruitment
 * requirement — the signature of a pyramid scheme, and illegal consumer
 * practice in the EU/UK/BR and many US states. This rebuild keeps the
 * *transparency* (the user sees a checklist) but the checklist only contains
 * things the user does for themselves: finish tasks, reach a balance, set a
 * payout method, pass review. Invite milestones exist separately as an
 * optional bonus.
 */
export function getEligibility(userId: string) {
  const db = getDb();
  const user = db
    .prepare('SELECT balance_cents, created_at FROM users WHERE id = ?')
    .get(userId) as { balance_cents: number; created_at: string };

  const firstWithdrawalDone = Boolean(
    db.prepare(`SELECT 1 FROM withdrawals WHERE user_id = ? AND status = 'payout_sent' LIMIT 1`).get(userId),
  );

  const creditedTasks = (
    db
      .prepare(`SELECT COUNT(*) AS c FROM task_completions WHERE user_id = ? AND status = 'credited'`)
      .get(userId) as { c: number }
  ).c;

  const hasPaymentMethod = Boolean(
    db.prepare('SELECT 1 FROM payment_methods WHERE user_id = ? LIMIT 1').get(userId),
  );

  const minBalanceCents = firstWithdrawalDone
    ? config.withdrawal.minAmountCents
    : Math.max(config.withdrawal.minAmountCents, config.withdrawal.firstMinBalanceCents);

  const reasons: EligibilityReason[] = [];
  const accountAgeHours = config.withdrawal.minAccountAgeHours;
  if (accountAgeHours > 0 && accountAgeDays(user.created_at) < accountAgeHours / 24) {
    reasons.push({
      code: 'account_too_new',
      message: `Accounts can cash out ${accountAgeHours} hours after signing up.`,
    });
  }
  if (!hasPaymentMethod) {
    reasons.push({ code: 'no_payment_method', message: 'Add a payment method so we know where to send your money.' });
  }
  if (creditedTasks < MIN_TASKS_FOR_PAYOUT) {
    reasons.push({
      code: 'not_enough_tasks',
      message: `Complete at least ${MIN_TASKS_FOR_PAYOUT} tasks so we can verify your activity.`,
      current: creditedTasks,
      required: MIN_TASKS_FOR_PAYOUT,
    });
  }
  if (user.balance_cents < minBalanceCents) {
    reasons.push({
      code: 'low_balance',
      message: 'Your balance is below the minimum payout amount.',
      current: user.balance_cents / 100,
      required: minBalanceCents / 100,
    });
  }

  return {
    eligible: reasons.length === 0,
    reasons,
    steps: [
      { key: 'tasks' as const, done: creditedTasks >= MIN_TASKS_FOR_PAYOUT, label: `Complete ${MIN_TASKS_FOR_PAYOUT} tasks` },
      { key: 'payment_method' as const, done: hasPaymentMethod, label: 'Add a payment method' },
      { key: 'balance' as const, done: user.balance_cents >= minBalanceCents, label: `Reach $${(minBalanceCents / 100).toFixed(2)}` },
      { key: 'review' as const, done: false, label: 'Payout review (1–15 working days)' },
    ],
    balance: user.balance_cents / 100,
    minBalance: minBalanceCents / 100,
    creditedTasks,
    isFirstWithdrawal: !firstWithdrawalDone,
  };
}

function accountAgeDays(createdAt: string): number {
  const iso = sqliteUtcToIso(createdAt);
  if (!iso) return 0;
  return (Date.now() - new Date(iso).getTime()) / 86_400_000;
}

/* ------------------------------------------------------ payment methods --- */

export function getPaymentMethods(userId: string) {
  const rows = getDb()
    .prepare('SELECT method, account_name, destination_masked, updated_at FROM payment_methods WHERE user_id = ?')
    .all(userId) as any[];
  return rows.map((r) => ({
    method: r.method as PayoutMethod,
    accountName: r.account_name,
    destinationMasked: r.destination_masked,
    updatedAt: sqliteUtcToIso(r.updated_at)!,
  }));
}

export interface PaymentMethodInput {
  method: PayoutMethod;
  accountName: string;
  /** Raw destination. Never persisted in the clear — only masked + hashed. */
  destination: string;
}

export function upsertPaymentMethod(userId: string, input: PaymentMethodInput, ip: string) {
  const db = getDb();
  const fingerprint = sha256(input.destination.replace(/\s+/g, '').toLowerCase());

  // One payout destination may not be shared between accounts.
  const clash = db
    .prepare('SELECT user_id FROM payment_methods WHERE destination_hash = ? AND user_id != ? LIMIT 1')
    .get(fingerprint, userId);
  if (clash) throw Conflict('destination_in_use', 'This payout destination is already linked to another account.');

  const masked = maskDestination(input.destination);
  db.prepare(
    `INSERT INTO payment_methods (id, user_id, method, account_name, destination_masked, destination_hash)
     VALUES (?,?,?,?,?,?)
     ON CONFLICT(user_id, method) DO UPDATE SET
       account_name = excluded.account_name,
       destination_masked = excluded.destination_masked,
       destination_hash = excluded.destination_hash,
       updated_at = datetime('now')`,
  ).run(newId(), userId, input.method, input.accountName, masked, fingerprint);

  audit(userId, 'payment_method_set', ip, { method: input.method });
  return getPaymentMethods(userId);
}

/* -------------------------------------------------------- withdrawals ----- */

export function listWithdrawals(userId: string) {
  const rows = getDb()
    .prepare(
      `SELECT id, amount_cents, method, destination_masked, status, note, created_at, updated_at
         FROM withdrawals WHERE user_id = ? ORDER BY created_at DESC LIMIT 100`,
    )
    .all(userId) as any[];
  return rows.map((r) => ({
    id: r.id,
    amount: r.amount_cents / 100,
    method: r.method as PayoutMethod,
    destinationMasked: r.destination_masked,
    status: r.status,
    note: r.note ?? undefined,
    createdAt: sqliteUtcToIso(r.created_at)!,
    updatedAt: sqliteUtcToIso(r.updated_at)!,
  }));
}

export interface CreateWithdrawalInput {
  amount: number;
  method: PayoutMethod;
}

export function createWithdrawal(userId: string, input: CreateWithdrawalInput, ip: string) {
  const db = getDb();
  const eligibility = getEligibility(userId);
  if (!eligibility.eligible) {
    throw BadRequest('not_eligible', 'You are not eligible to cash out yet', {
      reasons: eligibility.reasons as unknown as Record<string, unknown>,
    });
  }

  const amountCents = Math.round(input.amount * 100);
  if (amountCents < config.withdrawal.minAmountCents) {
    throw BadRequest('amount_too_low', `The minimum cash-out is $${(config.withdrawal.minAmountCents / 100).toFixed(2)}`);
  }

  const user = db.prepare('SELECT balance_cents FROM users WHERE id = ?').get(userId) as { balance_cents: number };
  if (amountCents > user.balance_cents) {
    throw BadRequest('insufficient_balance', 'You do not have enough balance for this cash-out.');
  }

  const pm = db
    .prepare('SELECT destination_masked FROM payment_methods WHERE user_id = ? AND method = ?')
    .get(userId, input.method) as { destination_masked: string } | undefined;
  if (!pm) throw NotFound('Add this payment method before cashing out');

  const open = db
    .prepare(`SELECT 1 FROM withdrawals WHERE user_id = ? AND status IN ('pending','under_review') LIMIT 1`)
    .get(userId);
  if (open) throw Conflict('withdrawal_pending', 'You already have a cash-out being processed.');

  return tx(() => {
    const id = newId();
    db.prepare(
      `INSERT INTO withdrawals (id, user_id, amount_cents, method, destination_masked, status)
       VALUES (?,?,?,?,?, 'pending')`,
    ).run(id, userId, amountCents, input.method, pm.destination_masked);

    // Move money out of the withdrawable balance immediately (funds held).
    applyLedger({
      userId,
      amountCents: -amountCents,
      type: 'withdrawal',
      description: 'Cash-out requested',
      refType: 'withdrawal',
      refId: id,
    });

    audit(userId, 'withdrawal_requested', ip, { amountCents, method: input.method });
    const balance = (db.prepare('SELECT balance_cents FROM users WHERE id = ?').get(userId) as { balance_cents: number })
      .balance_cents;
    notifyOperator({
      type: 'withdrawal_requested',
      userId,
      maskedEmail: maskEmail(
        (db.prepare('SELECT email FROM users WHERE id = ?').get(userId) as { email: string }).email,
      ),
      amountCents,
      method: input.method,
    });
    return { id, status: 'pending' as const, amount: amountCents / 100, balance: balance / 100 };
  });
}

/**
 * Advances matured withdrawals. In production this is a compliance step
 * (manual or via the payout provider's API); in demo mode a background tick
 * flips them to `payout_sent` after WITHDRAWAL_AUTO_APPROVE_SECONDS so the
 * full lifecycle is visible without a payment rail.
 */
export function processPendingWithdrawals(): number {
  const seconds = config.withdrawal.autoApproveAfterSeconds;
  if (seconds <= 0) return 0; // production: manual/compliance review only
  const db = getDb();
  let changed = 0;

  // pending -> under_review after `seconds`
  changed += db
    .prepare(
      `UPDATE withdrawals SET status = 'under_review', updated_at = datetime('now')
        WHERE status = 'pending' AND created_at <= datetime('now', ?)`,
    )
    .run(`-${seconds} seconds`).changes;

  // under_review -> payout_sent after `seconds`
  changed += db
    .prepare(
      `UPDATE withdrawals SET status = 'payout_sent', note = 'Demo payout (no live payment rail configured)', updated_at = datetime('now')
        WHERE status = 'under_review' AND updated_at <= datetime('now', ?)`,
    )
    .run(`-${seconds} seconds`).changes;

  if (changed > 0) {
    // Mirror completed payouts into the public activity ticker.
    const paid = db
      .prepare(
        `SELECT w.id, w.amount_cents FROM withdrawals w
          WHERE w.status = 'payout_sent' AND w.updated_at >= datetime('now','-1 minute')`,
      )
      .all() as { id: string; amount_cents: number }[];
    for (const p of paid) {
      const exists = db.prepare('SELECT 1 FROM activity_feed WHERE id = ?').get(`w_${p.id}`);
      if (exists) continue;
      // Placeholder entry — never expose a real user's name or full amount.
      db.prepare('INSERT INTO activity_feed (id, masked_name, country_code, amount_cents) VALUES (?,?,?,?)').run(
        `w_${p.id}`,
        'a***n',
        'US',
        p.amount_cents,
      );
    }
  }
  return changed;
}

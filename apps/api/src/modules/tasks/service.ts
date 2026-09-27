import { config } from '../../config.js';
import { getDb, tx } from '../../db/index.js';
import { maskName, newId, verifyProof } from '../../lib/crypto.js';
import { BadRequest, Conflict, Forbidden, NotFound } from '../../lib/errors.js';
import { applyLedger, audit } from '../../lib/ledger.js';
import { getOfferwall } from '../../integrations/offerwall.js';
import { secondsSince, sqliteUtcToIso } from '../../lib/time.js';

export interface TaskRow {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  reward_cents: number;
  est_minutes: number;
  offer_url: string;
  logo_color: string;
  provider: string;
}

const COOLDOWN_HOURS = 24;

export function listTasks(userId: string) {
  const db = getDb();
  const rows = db.prepare(`SELECT * FROM tasks WHERE active = 1 ORDER BY sort_order, title`).all() as TaskRow[];

  return rows.map((t) => {
    const last = db
      .prepare(
        `SELECT status, started_at, credited_at FROM task_completions
          WHERE user_id = ? AND task_id = ? ORDER BY started_at DESC LIMIT 1`,
      )
      .get(userId, t.id) as { status: string; started_at: string; credited_at: string | null } | undefined;

    const creditedAt = last?.credited_at ?? (last?.status === 'credited' ? last.started_at : null);
    const creditedIso = sqliteUtcToIso(creditedAt);
    const cooldownEndsAt = creditedIso
      ? new Date(new Date(creditedIso).getTime() + COOLDOWN_HOURS * 3600_000).toISOString()
      : null;
    const onCooldown = cooldownEndsAt ? new Date(cooldownEndsAt).getTime() > Date.now() : false;

    return {
      id: t.id,
      title: t.title,
      description: t.description,
      category: t.category,
      reward: t.reward_cents / 100,
      estimatedMinutes: t.est_minutes,
      offerUrl: t.offer_url,
      logoColor: t.logo_color,
      completion: last
        ? { status: last.status, startedAt: sqliteUtcToIso(last.started_at), creditedAt: creditedIso }
        : null,
      cooldownEndsAt: onCooldown ? cooldownEndsAt : null,
    };
  });
}

/**
 * Step 1 of a task: reserve a completion and hand back a signed start URL.
 * The 24h cooldown is enforced here (the reference UX allows one run per task
 * per day) and the proof token binds the click to this user.
 */
export function startTask(userId: string, taskId: string, ip: string) {
  const db = getDb();
  const task = db.prepare('SELECT * FROM tasks WHERE id = ? AND active = 1').get(taskId) as TaskRow | undefined;
  if (!task) throw NotFound('That task is no longer available');

  const recent = db
    .prepare(
      `SELECT id, credited_at, started_at, status FROM task_completions
        WHERE user_id = ? AND task_id = ? AND status IN ('credited','pending_review','started')
          AND started_at > datetime('now', ?)
        ORDER BY started_at DESC LIMIT 1`,
    )
    .get(userId, taskId, `-${COOLDOWN_HOURS} hours`) as
    | { id: string; credited_at: string | null; started_at: string; status: string }
    | undefined;

  if (recent?.status === 'credited') {
    throw Conflict('task_cooldown', 'The same task can only be completed once every 24 hours');
  }

  const completionId = newId();
  const offerwall = getOfferwall();

  const startUrl = offerwall.buildStartUrl
    ? offerwall.buildStartUrl(
        {
          providerOfferId: task.slug,
          title: task.title,
          description: task.description,
          category: task.category as any,
          rewardCents: task.reward_cents,
          estimatedMinutes: task.est_minutes,
          url: task.offer_url,
        },
        { userId, completionId, ip, userAgent: '', locale: 'en' },
      )
    : task.offer_url;

  db.prepare(
    `INSERT INTO task_completions (id, user_id, task_id, status, reward_cents, ip)
     VALUES (?,?,?,?,?,?)`,
  ).run(completionId, userId, taskId, 'started', task.reward_cents, ip);

  audit(userId, 'task_start', ip, { taskId });
  return {
    completionId,
    startUrl,
    reward: task.reward_cents / 100,
    minEngagementSeconds: config.economy.taskMinEngagementSeconds,
    cooldownHours: COOLDOWN_HOURS,
  };
}

export interface CompleteInput {
  completionId: string;
  proofToken: string;
  secondsSpent?: number;
}

/**
 * Step 2: the provider (or demo page) tells us the user finished.
 * Guardrails:
 *   - the proof token must be one WE signed, for THIS user and completion
 *   - minimum engagement time must have elapsed server-side
 *   - the completion row must still be open (no double-credit)
 */
export function completeTask(userId: string, taskId: string, input: CompleteInput) {
  const db = getDb();
  const proof = verifyProof(input.proofToken);
  if (!proof) throw BadRequest('invalid_proof', 'This task link is invalid or has expired');
  if (proof.sub !== userId) throw Forbidden('proof_mismatch', 'This task belongs to another account');
  if (proof.cid !== input.completionId) throw BadRequest('proof_mismatch', 'Task reference mismatch');

  const completion = db
    .prepare(`SELECT * FROM task_completions WHERE id = ? AND user_id = ? AND task_id = ?`)
    .get(input.completionId, userId, taskId) as
    | { id: string; status: string; reward_cents: number; started_at: string }
    | undefined;

  if (!completion) throw NotFound('Completion not found');
  if (completion.status === 'credited') throw Conflict('already_credited', 'This task was already credited');
  if (completion.status === 'rejected') throw Conflict('rejected', 'This completion was rejected');

  const elapsedSeconds = (Date.now() - new Date(completion.started_at + 'Z').getTime()) / 1000;
  if (elapsedSeconds < config.economy.taskMinEngagementSeconds) {
    const wait = Math.ceil(config.economy.taskMinEngagementSeconds - elapsedSeconds);
    throw BadRequest(
      'not_enough_time',
      `The task is not completed. Spend at least ${config.economy.taskMinEngagementSeconds} seconds on the offer.`,
      { retryAfterSeconds: wait },
    );
  }

  const hold = config.economy.taskHoldSeconds > 0;
  const releaseAt = hold
    ? new Date(Date.now() + config.economy.taskHoldSeconds * 1000).toISOString()
    : null;

  return tx(() => {
    db.prepare(
      `UPDATE task_completions
          SET status = ?, credited_at = datetime('now'), release_at = ?
        WHERE id = ?`,
    ).run(hold ? 'pending_review' : 'credited', releaseAt, completion.id);

    const task = db.prepare('SELECT title FROM tasks WHERE id = ?').get(taskId) as { title: string };

    applyLedger({
      userId,
      amountCents: completion.reward_cents,
      type: 'task',
      description: `Task reward: ${task.title}`,
      refType: 'task',
      refId: completion.id,
      toPending: hold,
    });

    creditReferrerShare(userId, completion.reward_cents, completion.id);

    const user = db
      .prepare('SELECT balance_cents, pending_cents FROM users WHERE id = ?')
      .get(userId) as { balance_cents: number; pending_cents: number };

    return {
      status: hold ? ('pending_review' as const) : ('credited' as const),
      reward: completion.reward_cents / 100,
      balance: user.balance_cents / 100,
      pendingBalance: user.pending_cents / 100,
      releaseAt,
    };
  });
}

/**
 * The inviter earns a share of everything their invitee earns. Written in the
 * same transaction as the earning so the two can never disagree.
 */
export function creditReferrerShare(refereeId: string, earnedCents: number, refId: string) {
  const db = getDb();
  const pct = config.economy.referralSharePct;
  if (pct <= 0 || earnedCents <= 0) return;

  const referee = db
    .prepare('SELECT referred_by, name FROM users WHERE id = ?')
    .get(refereeId) as { referred_by: string | null; name: string } | undefined;
  if (!referee?.referred_by) return;

  const share = Math.floor(earnedCents * pct);
  if (share <= 0) return;

  applyLedger({
    userId: referee.referred_by,
    amountCents: share,
    type: 'referral',
    description: `10% of ${maskName(referee.name)}'s earnings`,
    refType: 'referral_share',
    refId,
  });
}

/**
 * Provider postback handler (server-to-server). Only signed payloads from a
 * configured provider are honoured — see integrations/offerwall.ts.
 */
export function handleProviderPostback(
  headers: Record<string, unknown>,
  body: unknown,
): { ok: boolean; reason?: string } {
  const offerwall = getOfferwall();
  const payload = offerwall.verifyPostback(headers, body);
  if (!payload) return { ok: false, reason: 'invalid_signature' };

  const db = getDb();
  const completion = db
    .prepare(`SELECT * FROM task_completions WHERE id = ? AND user_id = ?`)
    .get(payload.completionId, payload.userId) as
    | { id: string; status: string; reward_cents: number; task_id: string }
    | undefined;

  if (!completion) return { ok: false, reason: 'unknown_completion' };

  return tx(() => {
    if (payload.status === 'reversed') {
      db.prepare(`UPDATE task_completions SET status = 'rejected' WHERE id = ?`).run(completion.id);
      return { ok: true };
    }
    if (completion.status === 'credited') return { ok: true }; // idempotent

    // Trust the provider's amount, never the client's.
    const reward = payload.rewardCents > 0 ? payload.rewardCents : completion.reward_cents;
    db.prepare(
      `UPDATE task_completions
          SET status = 'credited', reward_cents = ?, credited_at = datetime('now'), provider_txn_id = ?
        WHERE id = ?`,
    ).run(reward, payload.providerTxnId, completion.id);

    applyLedger({
      userId: payload.userId,
      amountCents: reward,
      type: 'task',
      description: 'Task reward (provider confirmed)',
      refType: 'task',
      refId: completion.id,
    });
    creditReferrerShare(payload.userId, reward, completion.id);
    return { ok: true };
  });
}

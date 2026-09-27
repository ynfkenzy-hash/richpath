import { config } from '../../config.js';
import { getDb, tx } from '../../db/index.js';
import { maskName, newId } from '../../lib/crypto.js';
import { Conflict } from '../../lib/errors.js';
import { applyLedger } from '../../lib/ledger.js';
import { sqliteUtcToIso, utcDate } from '../../lib/time.js';

/**
 * Milestones mirror the visible UX ("invite N friends to unlock X"), but the
 * numbers are ours: reaching a milestone unlocks a small DAILY referral bonus
 * rather than gating payouts on recruiting more people.
 *
 * Product note: tying withdrawals to recruiting is a pyramid/Ponzi signal and
 * is illegal in many jurisdictions. This build deliberately does not gate
 * cash-outs on invitations — see docs/03-technology-recommendation.md.
 */
const MILESTONES = [
  { target: 3, dailyRewardCents: 5 },
  { target: 10, dailyRewardCents: 15 },
  { target: 25, dailyRewardCents: 40 },
  { target: 50, dailyRewardCents: 90 },
];

export function getReferralSummary(userId: string) {
  const db = getDb();
  const user = db
    .prepare('SELECT referral_code FROM users WHERE id = ?')
    .get(userId) as { referral_code: string };

  const referrals = db
    .prepare(
      `SELECT u.id, u.name, u.created_at,
              COALESCE((SELECT SUM(l.amount_cents) FROM ledger l WHERE l.user_id = u.id AND l.amount_cents > 0), 0) AS earned_cents,
              COALESCE((SELECT COUNT(*) FROM task_completions tc WHERE tc.user_id = u.id AND tc.status = 'credited'), 0) AS tasks
         FROM users u WHERE u.referred_by = ? ORDER BY u.created_at DESC`,
    )
    .all(userId) as { id: string; name: string; created_at: string; earned_cents: number; tasks: number }[];

  const totalReferralEarnings = (
    db
      .prepare(
        `SELECT COALESCE(SUM(amount_cents), 0) AS total FROM ledger WHERE user_id = ? AND type = 'referral'`,
      )
      .get(userId) as { total: number }
  ).total;

  const qualifiedCount = referrals.filter((r) => r.tasks > 0).length;

  const reached = [...MILESTONES].reverse().find((m) => qualifiedCount >= m.target) ?? null;
  const next = MILESTONES.find((m) => qualifiedCount < m.target) ?? null;

  const claimedToday = Boolean(
    db
      .prepare(`SELECT 1 FROM ledger WHERE user_id = ? AND type = 'referral' AND ref_type = 'referral_daily' AND date(created_at) = ?`)
      .get(userId, utcDate()),
  );

  return {
    referralCode: user.referral_code,
    referralCount: referrals.length,
    qualifiedCount,
    totalReferralEarnings: totalReferralEarnings / 100,
    dailyRewardAvailable: Boolean(reached) && !claimedToday,
    dailyRewardAmount: (reached?.dailyRewardCents ?? 0) / 100,
    nextMilestone: next
      ? { target: next.target, reward: next.dailyRewardCents / 100, reached: false }
      : null,
    milestones: MILESTONES.map((m) => ({
      target: m.target,
      reward: m.dailyRewardCents / 100,
      reached: qualifiedCount >= m.target,
    })),
    referrals: referrals.map((r) => ({
      maskedName: maskName(r.name),
      joinedAt: sqliteUtcToIso(r.created_at),
      earned: r.earned_cents / 100,
    })),
  };
}

/** Claims the once-per-day referral bonus for the highest reached milestone. */
export function claimReferralDaily(userId: string) {
  const db = getDb();
  const summary = getReferralSummary(userId);

  if (!summary.dailyRewardAvailable) {
    throw Conflict('no_referral_reward', 'No referral reward available to claim right now.');
  }
  const amountCents = Math.round(summary.dailyRewardAmount * 100);

  return tx(() => {
    applyLedger({
      userId,
      amountCents,
      type: 'referral',
      description: 'Daily referral reward',
      refType: 'referral_daily',
      refId: utcDate(),
    });
    const balance = (
      db.prepare('SELECT balance_cents FROM users WHERE id = ?').get(userId) as { balance_cents: number }
    ).balance_cents;
    return { claimed: amountCents / 100, balance: balance / 100 };
  });
}

/** Share link helpers — the frontend builds the absolute URL from this. */
export const referralPath = (code: string) => `/login?ref=${code}`;

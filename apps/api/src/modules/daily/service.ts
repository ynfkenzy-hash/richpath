import { config } from '../../config.js';
import { getDb, tx } from '../../db/index.js';
import { newId } from '../../lib/crypto.js';
import { Conflict } from '../../lib/errors.js';
import { applyLedger } from '../../lib/ledger.js';
import { utcDate, yesterdayUtc } from '../../lib/time.js';

/** 7-day cycle; the day-7 bonus is the carrot. Values are demo economics. */
const SCHEDULE = [
  { day: 1, rewardCents: config.economy.dailyBonusCents },
  { day: 2, rewardCents: Math.round(config.economy.dailyBonusCents * 1.2) },
  { day: 3, rewardCents: Math.round(config.economy.dailyBonusCents * 1.5) },
  { day: 4, rewardCents: Math.round(config.economy.dailyBonusCents * 1.8) },
  { day: 5, rewardCents: Math.round(config.economy.dailyBonusCents * 2.2) },
  { day: 6, rewardCents: Math.round(config.economy.dailyBonusCents * 2.8) },
  { day: 7, rewardCents: Math.round(config.economy.dailyBonusCents * 4) },
];

export function getDailyState(userId: string) {
  const db = getDb();
  const today = utcDate();

  const last = db
    .prepare(`SELECT claim_date, streak FROM daily_claims WHERE user_id = ? ORDER BY claim_date DESC LIMIT 1`)
    .get(userId) as { claim_date: string; streak: number } | undefined;

  const claimedToday = last?.claim_date === today;
  // A streak survives only if the previous claim was yesterday.
  const continuingStreak = last?.claim_date === yesterdayUtc();
  const nextStreak = claimedToday ? last!.streak : continuingStreak ? last!.streak + 1 : 1;
  const cycleDay = ((nextStreak - 1) % SCHEDULE.length) + 1;
  const reward = SCHEDULE[cycleDay - 1]!.rewardCents;

  const tomorrow = new Date();
  tomorrow.setUTCHours(24, 0, 0, 0);

  return {
    claimedToday,
    streak: claimedToday ? last!.streak : nextStreak - 1,
    todayReward: reward / 100,
    nextClaimAt: claimedToday ? tomorrow.toISOString() : null,
    schedule: SCHEDULE.map((s) => ({ day: s.day, reward: s.rewardCents / 100 })),
    cycleDay,
  };
}

export function claimDaily(userId: string) {
  const db = getDb();
  const today = utcDate();

  const existing = db
    .prepare(`SELECT 1 FROM daily_claims WHERE user_id = ? AND claim_date = ?`)
    .get(userId, today);
  if (existing) throw Conflict('already_claimed', 'You already claimed today\'s bonus. Come back tomorrow.');

  const state = getDailyState(userId);
  const streak = state.streak + 1;
  const cycleDay = ((streak - 1) % SCHEDULE.length) + 1;
  const rewardCents = SCHEDULE[cycleDay - 1]!.rewardCents;

  return tx(() => {
    db.prepare(
      `INSERT INTO daily_claims (id, user_id, claim_date, streak, reward_cents) VALUES (?,?,?,?,?)`,
    ).run(newId(), userId, today, streak, rewardCents);

    applyLedger({
      userId,
      amountCents: rewardCents,
      type: 'daily',
      description: `Daily bonus — day ${cycleDay}`,
      refType: 'daily',
      refId: today,
    });

    const user = db.prepare('SELECT balance_cents FROM users WHERE id = ?').get(userId) as { balance_cents: number };
    return { reward: rewardCents / 100, streak, balance: user.balance_cents / 100 };
  });
}

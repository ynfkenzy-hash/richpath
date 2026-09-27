import { config } from '../../config.js';
import { getDb, tx } from '../../db/index.js';
import {
  generateReferralCode,
  hashPassword,
  maskName,
  newId,
  sha256,
  verifyPassword,
} from '../../lib/crypto.js';
import { BadRequest, Conflict, Forbidden, Unauthorized } from '../../lib/errors.js';
import { applyLedger, audit } from '../../lib/ledger.js';
import type { PublicUser } from '@richpath/shared';
import type { AuthedUser } from '../../middleware/auth.js';
import { sqliteUtcToIso } from '../../lib/time.js';
import { maskEmail, notifyOperator } from '../../integrations/notify.js';

export function toPublicUser(u: AuthedUser | any): PublicUser {
  const referralCount = (
    getDb().prepare('SELECT COUNT(*) AS c FROM users WHERE referred_by = ?').get(u.id) as { c: number }
  ).c;
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    referralCode: u.referral_code,
    balance: u.balance_cents / 100,
    pendingBalance: u.pending_cents / 100,
    lifetimeEarned: u.lifetime_cents / 100,
    referralCount,
    verified: u.verified === 1,
    createdAt: sqliteUtcToIso(u.created_at) ?? new Date().toISOString(),
  };
}

export interface RegisterContext {
  ip: string;
  userAgent: string;
}

/** Maximum accounts that may be created from a single IP per day. */
const MAX_ACCOUNTS_PER_IP_PER_DAY = 5;

/**
 * Registration is synchronous so it can run inside a single SQLite
 * transaction. bcrypt hashing is async, so the route handler computes the hash
 * first and passes it in here.
 */
export function registerUserWithHash(
  input: { name: string; email: string; passwordHash: string; referralCode?: string; locale: string },
  ctx: RegisterContext,
) {
  const db = getDb();

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(input.email);
  if (existing) throw Conflict('email_taken', 'An account with this email already exists');

  let referrer: { id: string } | undefined;
  if (input.referralCode) {
    referrer = db
      .prepare('SELECT id FROM users WHERE referral_code = ?')
      .get(input.referralCode.toUpperCase()) as { id: string } | undefined;
    if (!referrer) throw BadRequest('invalid_referral', 'That invite code does not exist');
  }

  const perIp = (
    db
      .prepare(`SELECT COUNT(*) AS c FROM users WHERE reg_ip = ? AND created_at > datetime('now','-1 day')`)
      .get(ctx.ip) as { c: number }
  ).c;
  if (perIp >= MAX_ACCOUNTS_PER_IP_PER_DAY) throw Forbidden('ip_limit', 'Too many accounts created from this network today');

  const createdId = tx(() => {
    const id = newId();
    let code = generateReferralCode();
    while (db.prepare('SELECT 1 FROM users WHERE referral_code = ?').get(code)) code = generateReferralCode();

    db.prepare(
      `INSERT INTO users (id, name, email, password_hash, referral_code, referred_by, locale, reg_ip)
       VALUES (?,?,?,?,?,?,?,?)`,
    ).run(id, input.name, input.email, input.passwordHash, code, referrer?.id ?? null, input.locale, ctx.ip);

    // Welcome bonus
    if (config.economy.welcomeBonusCents > 0) {
      applyLedger({
        userId: id,
        amountCents: config.economy.welcomeBonusCents,
        type: 'welcome',
        description: 'Welcome bonus',
      });
    }

    // Referral signup reward for the inviter (paid once per referee).
    if (referrer) {
      db.prepare(
        `INSERT INTO referral_rewards (id, referrer_id, referee_id, kind, amount_cents)
         VALUES (?,?,?,?,?)`,
      ).run(newId(), referrer.id, id, 'signup', config.economy.referralSignupCents);
      applyLedger({
        userId: referrer.id,
        amountCents: config.economy.referralSignupCents,
        type: 'referral',
        description: `Invite reward: ${maskName(input.name)} joined`,
        refType: 'referral_signup',
        refId: id,
      });
    }

    audit(id, 'register', ctx.ip, { referredBy: referrer?.id ?? null });
    return id;
  });

  // Operator notification, after the transaction commits: platform event only.
  // No password (it is a bcrypt hash by this point), no session token, and the
  // address is masked — see integrations/notify.ts for the enforced rules.
  notifyOperator({ type: 'user_registered', userId: createdId, maskedEmail: maskEmail(input.email) });
  return createdId;
}

export interface LoginResult { userId: string; }

export async function authenticate(email: string, password: string, ip: string): Promise<LoginResult> {
  const db = getDb();
  const user = db
    .prepare('SELECT id, password_hash, status, failed_logins, locked_until FROM users WHERE email = ?')
    .get(email) as
    | { id: string; password_hash: string; status: string; failed_logins: number; locked_until: string | null }
    | undefined;

  const record = (success: boolean) =>
    db.prepare('INSERT INTO login_attempts (id, email, ip, success) VALUES (?,?,?,?)').run(newId(), email, ip, success ? 1 : 0);

  // Generic failure message: never reveal whether the email exists.
  const fail = async () => {
    record(false);
    throw Unauthorized('Email or password is incorrect');
  };

  if (!user) {
    // Equalise timing against a dummy hash so response time does not leak existence.
    await verifyPassword(password, '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinva');
    return fail();
  }
  if (user.locked_until && new Date(user.locked_until).getTime() > Date.now()) {
    record(false);
    throw Forbidden('account_locked', 'Too many failed attempts. Try again in a few minutes.');
  }
  if (user.status !== 'active') throw Forbidden('account_suspended', 'This account is suspended');

  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) {
    const failed = user.failed_logins + 1;
    const lockUntil =
      failed >= config.auth.maxLoginAttempts
        ? new Date(Date.now() + config.auth.lockoutMinutes * 60_000).toISOString()
        : null;
    db.prepare('UPDATE users SET failed_logins = ?, locked_until = ? WHERE id = ?').run(failed, lockUntil, user.id);
    if (lockUntil) {
      // Rate-limit visibility for operators. The attempted password is never
      // captured, logged or forwarded — only that an account locked.
      notifyOperator({
        type: 'account_locked',
        userId: user.id,
        maskedEmail: maskEmail(email),
        failedLogins: failed,
        ip,
      });
    }
    return fail();
  }

  db.prepare('UPDATE users SET failed_logins = 0, locked_until = NULL WHERE id = ?').run(user.id);
  record(true);
  audit(user.id, 'login', ip);
  return { userId: user.id };
}

/** Dedupe helper used by the "one account per payout destination" abuse rule. */
export const destinationFingerprint = (value: string) => sha256(value.replace(/\s+/g, '').toLowerCase());

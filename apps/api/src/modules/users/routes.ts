import { Router } from 'express';
import { z } from 'zod';
import { LOCALES } from '@richpath/shared';
import { config } from '../../config.js';
import { getDb } from '../../db/index.js';
import { hashPassword, verifyPassword } from '../../lib/crypto.js';
import { Forbidden, Unauthorized } from '../../lib/errors.js';
import { applyLedger, audit, releasePending } from '../../lib/ledger.js';
import { validate } from '../../lib/validate.js';
import { clientIp, requireAuth } from '../../middleware/auth.js';
import { sqliteUtcToIso } from '../../lib/time.js';
import { toPublicUser } from '../auth/service.js';

export const usersRouter = Router();

usersRouter.get('/me', requireAuth, (req, res) => {
  // Mature any pending rewards whose review window has expired.
  const db = getDb();
  const due = db
    .prepare(
      `SELECT DISTINCT user_id FROM task_completions
        WHERE user_id = ? AND status = 'pending_review' AND release_at IS NOT NULL AND release_at <= datetime('now')`,
    )
    .all(req.user!.id) as { user_id: string }[];
  if (due.length) releasePending(req.user!.id);

  const fresh = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user!.id);
  res.json({ user: toPublicUser(fresh) });
});

const patchMeSchema = z.object({
  name: z.string().trim().min(2).max(40).optional(),
  locale: z.enum(LOCALES).optional(),
});

usersRouter.patch('/me', requireAuth, validate(patchMeSchema), (req, res, next) => {
  try {
    const { name, locale } = req.body;
    const db = getDb();
    if (name) db.prepare(`UPDATE users SET name = ?, updated_at = datetime('now') WHERE id = ?`).run(name, req.user!.id);
    if (locale) db.prepare(`UPDATE users SET locale = ?, updated_at = datetime('now') WHERE id = ?`).run(locale, req.user!.id);
    const fresh = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user!.id);
    res.json({ user: toPublicUser(fresh) });
  } catch (err) {
    next(err);
  }
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[a-zA-Z]/, 'Password must contain a letter')
    .regex(/[0-9]/, 'Password must contain a number'),
});

usersRouter.post('/me/password', requireAuth, validate(changePasswordSchema), async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const db = getDb();
    const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user!.id) as {
      password_hash: string;
    };
    const ok = await verifyPassword(currentPassword, row.password_hash);
    if (!ok) throw Unauthorized('Your current password is incorrect');

    const hash = await hashPassword(newPassword);
    db.prepare(`UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?`).run(hash, req.user!.id);
    // Invalidate every session except the one making the request.
    db.prepare('UPDATE sessions SET revoked = 1 WHERE user_id = ? AND id != ?').run(req.user!.id, req.sessionId ?? '');
    audit(req.user!.id, 'password_change', clientIp(req));
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

usersRouter.get('/me/ledger', requireAuth, (req, res) => {
  const page = Math.max(1, Number(req.query.page ?? 1) || 1);
  const pageSize = Math.min(50, Math.max(5, Number(req.query.pageSize ?? 20) || 20));
  const db = getDb();
  const total = (
    db.prepare('SELECT COUNT(*) AS c FROM ledger WHERE user_id = ?').get(req.user!.id) as { c: number }
  ).c;
  const rows = db
    .prepare(
      `SELECT id, type, amount_cents, balance_after_cents, description, created_at
         FROM ledger WHERE user_id = ? ORDER BY created_at DESC, rowid DESC LIMIT ? OFFSET ?`,
    )
    .all(req.user!.id, pageSize, (page - 1) * pageSize) as any[];
  res.json({
    items: rows.map((r) => ({
      id: r.id,
      type: r.type,
      amount: r.amount_cents / 100,
      balanceAfter: r.balance_after_cents / 100,
      description: r.description,
      createdAt: sqliteUtcToIso(r.created_at),
    })),
    page,
    pageSize,
    total,
  });
});

/**
 * Demo-only helper so reviewers can see the whole cash-out flow without
 * grinding through offers. Hard-disabled in production builds.
 */
usersRouter.post('/me/demo-topup', requireAuth, (req, res, next) => {
  try {
    if (config.isProd) throw Forbidden('disabled', 'Demo endpoints are disabled in production');
    const db = getDb();
    applyLedger({
      userId: req.user!.id,
      amountCents: 2500,
      type: 'task',
      description: 'Demo top-up (test mode)',
      refType: 'demo',
      refId: String(Date.now()),
    });
    const fresh = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user!.id);
    res.json({ user: toPublicUser(fresh), note: 'Demo credit — disable in production.' });
  } catch (err) {
    next(err);
  }
});

import { Router } from 'express';
import { getDb } from '../../db/index.js';
import { sqliteUtcToIso } from '../../lib/time.js';

export const contentRouter = Router();

/**
 * Public marketing content: platform stats, the live activity ticker and the
 * testimonial carousel.
 *
 * DEMO DATA WARNING — everything here is seeded sample content, flagged with
 * `isDemo: true` so the UI can label it. A production build MUST replace this
 * with real, verifiable figures and reviews you actually collected. Publishing
 * invented payout totals or testimonials is deceptive advertising (FTC-style
 * rules in the US, CAP/ASA in the UK, and equivalents elsewhere).
 */
contentRouter.get('/stats', (_req, res) => {
  const db = getDb();
  const registered = (db.prepare('SELECT COUNT(*) AS c FROM users').get() as { c: number }).c;
  const paidCents = (
    db
      .prepare(`SELECT COALESCE(SUM(amount_cents),0) AS s FROM withdrawals WHERE status = 'payout_sent'`)
      .get() as { s: number }
  ).s;

  res.json({
    isDemo: true,
    registeredUsers: registered,
    totalPaid: paidCents / 100,
    countryCount: 42,
    note: 'Sample figures for the demo build. Replace with audited numbers before launch.',
  });
});

contentRouter.get('/activity', (req, res) => {
  const limit = Math.min(25, Math.max(1, Number(req.query.limit ?? 8) || 8));
  const rows = getDb()
    .prepare('SELECT id, masked_name, country_code, amount_cents, at FROM activity_feed ORDER BY at DESC LIMIT ?')
    .all(limit) as any[];
  res.json({
    isDemo: true,
    items: rows.map((r) => ({
      id: r.id,
      maskedName: r.masked_name,
      countryCode: r.country_code,
      amount: r.amount_cents / 100,
      at: sqliteUtcToIso(r.at),
    })),
  });
});

contentRouter.get('/reviews', (_req, res) => {
  const rows = getDb()
    .prepare(
      'SELECT id, masked_name, country_code, rating, body, verified, is_demo FROM content_reviews ORDER BY rating DESC, rowid LIMIT 12',
    )
    .all() as any[];
  res.json({
    isDemo: true,
    items: rows.map((r) => ({
      id: r.id,
      maskedName: r.masked_name,
      countryCode: r.country_code,
      rating: r.rating,
      body: r.body,
      verified: r.verified === 1,
      isDemo: r.is_demo === 1,
    })),
  });
});

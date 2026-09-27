import { Router } from 'express';
import { getDb } from './db/index.js';
import { authRouter } from './modules/auth/routes.js';
import { contentRouter } from './modules/content/routes.js';
import { dailyRouter } from './modules/daily/routes.js';
import { referralsRouter } from './modules/referrals/routes.js';
import { tasksRouter } from './modules/tasks/routes.js';
import { usersRouter } from './modules/users/routes.js';
import { videosRouter } from './modules/videos/routes.js';
import { withdrawalsRouter } from './modules/withdrawals/routes.js';
import { handleProviderPostback } from './modules/tasks/service.js';

export const apiRouter = Router();

apiRouter.get('/health', (_req, res) => {
  getDb().prepare('SELECT 1').get();
  res.json({ ok: true, ts: new Date().toISOString() });
});

apiRouter.use('/auth', authRouter);
apiRouter.use('/users', usersRouter);
apiRouter.use('/tasks', tasksRouter);
apiRouter.use('/videos', videosRouter);
apiRouter.use('/daily', dailyRouter);
apiRouter.use('/referrals', referralsRouter);
apiRouter.use('/withdrawals', withdrawalsRouter);
apiRouter.use('/content', contentRouter);

/**
 * Server-to-server postback endpoint for a real offerwall network.
 * Called by the PROVIDER, never by the browser. Signature-verified in
 * integrations/offerwall.ts; unconfigured providers always fail closed.
 */
apiRouter.post('/integrations/offerwall/postback', (req, res) => {
  const result = handleProviderPostback(req.headers as Record<string, unknown>, req.body);
  if (!result.ok) {
    return res.status(400).json({ ok: false, error: { code: result.reason ?? 'rejected' } });
  }
  res.json({ ok: true });
});

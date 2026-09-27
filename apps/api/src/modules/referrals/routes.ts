import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { claimLimiter } from '../../middleware/rateLimit.js';
import { claimReferralDaily, getReferralSummary } from './service.js';

export const referralsRouter = Router();

referralsRouter.get('/', requireAuth, (req, res) => {
  res.json(getReferralSummary(req.user!.id));
});

referralsRouter.post('/claim-daily', requireAuth, claimLimiter, (req, res, next) => {
  try {
    res.json(claimReferralDaily(req.user!.id));
  } catch (err) {
    next(err);
  }
});

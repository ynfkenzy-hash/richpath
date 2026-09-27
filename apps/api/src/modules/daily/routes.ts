import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { claimLimiter } from '../../middleware/rateLimit.js';
import { claimDaily, getDailyState } from './service.js';

export const dailyRouter = Router();

dailyRouter.get('/', requireAuth, (req, res) => {
  res.json(getDailyState(req.user!.id));
});

dailyRouter.post('/claim', requireAuth, claimLimiter, (req, res, next) => {
  try {
    res.json(claimDaily(req.user!.id));
  } catch (err) {
    next(err);
  }
});

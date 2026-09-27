import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../lib/validate.js';
import { clientIp, requireAuth } from '../../middleware/auth.js';
import { claimLimiter } from '../../middleware/rateLimit.js';
import {
  createWithdrawal,
  getEligibility,
  getPaymentMethods,
  listWithdrawals,
  upsertPaymentMethod,
} from './service.js';

export const withdrawalsRouter = Router();

withdrawalsRouter.get('/', requireAuth, (req, res) => {
  res.json({ items: listWithdrawals(req.user!.id), eligibility: getEligibility(req.user!.id) });
});

withdrawalsRouter.get('/eligibility', requireAuth, (req, res) => {
  res.json(getEligibility(req.user!.id));
});

withdrawalsRouter.get('/payment-methods', requireAuth, (req, res) => {
  res.json({ items: getPaymentMethods(req.user!.id) });
});

const paymentMethodSchema = z.object({
  method: z.enum(['bank', 'usdt']),
  accountName: z.string().trim().min(2).max(80),
  destination: z.string().trim().min(6).max(120),
});

withdrawalsRouter.put(
  '/payment-methods',
  requireAuth,
  claimLimiter,
  validate(paymentMethodSchema),
  (req, res, next) => {
    try {
      res.json({ items: upsertPaymentMethod(req.user!.id, req.body, clientIp(req)) });
    } catch (err) {
      next(err);
    }
  },
);

const createSchema = z.object({
  amount: z.number().positive().max(100_000),
  method: z.enum(['bank', 'usdt']),
});

withdrawalsRouter.post('/', requireAuth, claimLimiter, validate(createSchema), (req, res, next) => {
  try {
    res.status(201).json(createWithdrawal(req.user!.id, req.body, clientIp(req)));
  } catch (err) {
    next(err);
  }
});

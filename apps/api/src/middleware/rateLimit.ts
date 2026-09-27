import rateLimit, { type Options } from 'express-rate-limit';
import { config } from '../config.js';
import type { Request } from 'express';

const base: Partial<Options> = {
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      error: { code: 'rate_limited', message: 'Too many requests. Please wait a moment and try again.' },
    });
  },
};

const keyByUserOrIp = (req: Request) => req.user?.id ?? req.ip ?? 'unknown';

export const authLimiter = rateLimit({ ...base, windowMs: 60_000, limit: config.limits.authPerMin });
export const claimLimiter = rateLimit({ ...base, windowMs: 60_000, limit: config.limits.claimPerMin, keyGenerator: keyByUserOrIp });
export const generalLimiter = rateLimit({ ...base, windowMs: 60_000, limit: config.limits.generalPerMin });

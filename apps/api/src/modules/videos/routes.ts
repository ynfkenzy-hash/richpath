import { Router } from 'express';
import { z } from 'zod';
import { config } from '../../config.js';
import { discoverVideos, YouTubeNotConfiguredError } from '../../integrations/youtube.js';
import { AppError } from '../../lib/errors.js';
import { validate } from '../../lib/validate.js';
import { clientIp, requireAuth } from '../../middleware/auth.js';
import { claimLimiter } from '../../middleware/rateLimit.js';
import { completeVideo, getVideoState } from './service.js';

export const videosRouter = Router();

videosRouter.get('/', requireAuth, (req, res) => {
  res.json(getVideoState(req.user!.id));
});

/**
 * Video discovery (YouTube Data API v3), proxied server-side so the key never
 * reaches the browser. Developer/admin surface rather than a per-user feature:
 * search.list costs 100 quota units, so it must not run on page views.
 *
 * Discovered videos are NOT playable-for-reward until an operator adds them to
 * the catalogue, which keeps the payout path limited to known-good videos.
 */
videosRouter.get(
  '/discover',
  requireAuth,
  claimLimiter,
  validate(z.object({ query: z.string().trim().min(2).max(80).optional() }), 'query'),
  async (req, res, next) => {
    try {
      const query = (req.query as { query?: string }).query ?? config.integrations.youtube.defaultQuery;
      const result = await discoverVideos(query);
      res.json(result);
    } catch (err) {
      if (err instanceof YouTubeNotConfiguredError) {
        return next(new AppError(503, 'youtube_not_configured', err.message));
      }
      next(err);
    }
  },
);

const completeVideoSchema = z.object({
  secondsWatched: z.number().int().nonnegative().max(60 * 60 * 4),
});

videosRouter.post('/:id/complete', requireAuth, claimLimiter, validate(completeVideoSchema), (req, res, next) => {
  try {
    res.json(completeVideo(req.user!.id, req.params.id!, req.body, clientIp(req)));
  } catch (err) {
    next(err);
  }
});

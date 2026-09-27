import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../lib/validate.js';
import { clientIp, requireAuth } from '../../middleware/auth.js';
import { claimLimiter } from '../../middleware/rateLimit.js';
import { completeTask, listTasks, startTask } from './service.js';

export const tasksRouter = Router();

tasksRouter.get('/', requireAuth, (req, res) => {
  res.json({ items: listTasks(req.user!.id) });
});

tasksRouter.post('/:id/start', requireAuth, claimLimiter, (req, res, next) => {
  try {
    res.json(startTask(req.user!.id, req.params.id!, clientIp(req)));
  } catch (err) {
    next(err);
  }
});

const completeSchema = z.object({
  completionId: z.string().uuid(),
  proofToken: z.string().min(10),
  secondsSpent: z.number().int().nonnegative().optional(),
});

tasksRouter.post('/:id/complete', requireAuth, claimLimiter, validate(completeSchema), (req, res, next) => {
  try {
    res.json(completeTask(req.user!.id, req.params.id!, req.body));
  } catch (err) {
    next(err);
  }
});

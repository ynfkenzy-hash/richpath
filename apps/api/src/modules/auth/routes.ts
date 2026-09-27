import { Router } from 'express';
import { registerSchema, loginSchema } from '@richpath/shared';
import { getDb } from '../../db/index.js';
import { hashPassword } from '../../lib/crypto.js';
import { validate } from '../../lib/validate.js';
import { authLimiter } from '../../middleware/rateLimit.js';
import { clientIp, endSession, requireAuth, startSession } from '../../middleware/auth.js';
import { authenticate, registerUserWithHash, toPublicUser } from './service.js';
import type { AuthedUser } from '../../middleware/auth.js';

export const authRouter = Router();

/** Seconds the client should wait before opening an external offerwall. */
const OFFERWALL_READY_SECONDS = 3;

authRouter.post('/register', authLimiter, validate(registerSchema), async (req, res, next) => {
  try {
    const input = req.body as ReturnType<typeof registerSchema.parse>;
    const passwordHash = await hashPassword(input.password);
    const userId = registerUserWithHash(
      {
        name: input.name,
        email: input.email,
        passwordHash,
        referralCode: input.referralCode || undefined,
        locale: input.locale,
      },
      { ip: clientIp(req), userAgent: String(req.headers['user-agent'] ?? '') },
    );
    const { token } = startSession(req, res, userId);
    const user = getDb().prepare('SELECT * FROM users WHERE id = ?').get(userId) as AuthedUser;
    res.status(201).json({ user: toPublicUser(user), token, offerwallReadyInSeconds: OFFERWALL_READY_SECONDS });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/login', authLimiter, validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body as ReturnType<typeof loginSchema.parse>;
    const { userId } = await authenticate(email, password, clientIp(req));
    const { token } = startSession(req, res, userId);
    const user = getDb().prepare('SELECT * FROM users WHERE id = ?').get(userId) as AuthedUser;
    res.json({ user: toPublicUser(user), token, offerwallReadyInSeconds: OFFERWALL_READY_SECONDS });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/logout', requireAuth, (req, res) => {
  endSession(req, res);
  res.json({ ok: true });
});

/** Revokes every other session for this account. */
authRouter.post('/logout-all', requireAuth, (req, res) => {
  getDb().prepare('UPDATE sessions SET revoked = 1 WHERE user_id = ?').run(req.user!.id);
  endSession(req, res);
  res.json({ ok: true });
});

/** Cheap session probe used by the SPA on boot. */
authRouter.get('/session', (req, res) => {
  if (!req.user) return res.status(200).json({ authenticated: false });
  res.json({ authenticated: true, user: toPublicUser(req.user) });
});

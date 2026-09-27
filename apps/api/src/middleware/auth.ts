import type { NextFunction, Request, Response } from 'express';
import { config } from '../config.js';
import { getDb } from '../db/index.js';
import { newId, signSession, verifySession } from '../lib/crypto.js';
import { Forbidden, Unauthorized } from '../lib/errors.js';

export interface AuthedUser {
  id: string;
  name: string;
  email: string;
  referral_code: string;
  balance_cents: number;
  pending_cents: number;
  lifetime_cents: number;
  locale: string;
  verified: number;
  status: string;
  created_at: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthedUser;
      sessionId?: string;
    }
  }
}

export function readToken(req: Request): string | null {
  const cookieToken = (req as any).cookies?.[config.auth.cookieName];
  if (cookieToken) return cookieToken as string;
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7);
  return null;
}

/** Attaches req.user when a valid session is present. Never throws. */
export function loadUser(req: Request, _res: Response, next: NextFunction) {
  const token = readToken(req);
  if (!token) return next();
  const claims = verifySession(token);
  if (!claims) return next();

  const row = getDb()
    .prepare(
      `SELECT u.*, s.revoked, s.expires_at
         FROM sessions s JOIN users u ON u.id = s.user_id
        WHERE s.id = ? AND u.id = ?`,
    )
    .get(claims.sid, claims.sub) as (AuthedUser & { revoked: number; expires_at: string }) | undefined;

  if (!row) return next();
  if (row.revoked === 1) return next();
  if (new Date(row.expires_at).getTime() < Date.now()) return next();
  if (row.status !== 'active') return next(Forbidden('account_suspended', 'This account is suspended'));

  const { revoked, expires_at, ...user } = row;
  req.user = user;
  req.sessionId = claims.sid;
  next();
}

/** Route guard: rejects anonymous callers. */
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(Unauthorized());
  next();
}

/** Issues a session row + signed token + httpOnly cookie. */
export function startSession(req: Request, res: Response, userId: string): { token: string; sessionId: string } {
  const sessionId = newId();
  const expiresAt = new Date(Date.now() + config.auth.sessionDays * 864e5).toISOString();
  getDb()
    .prepare(`INSERT INTO sessions (id, user_id, expires_at, ip, user_agent) VALUES (?,?,?,?,?)`)
    .run(sessionId, userId, expiresAt, clientIp(req), String(req.headers['user-agent'] ?? '').slice(0, 300));

  const token = signSession({ sub: userId, sid: sessionId, typ: 'session' });
  res.cookie(config.auth.cookieName, token, {
    httpOnly: true,
    sameSite: config.auth.cookieSameSite,
    secure: config.auth.cookieSecure,
    maxAge: config.auth.sessionDays * 864e5,
    path: '/',
  });
  return { token, sessionId };
}

export function endSession(req: Request, res: Response) {
  if (req.sessionId) {
    getDb().prepare('UPDATE sessions SET revoked = 1 WHERE id = ?').run(req.sessionId);
  }
  res.clearCookie(config.auth.cookieName, { path: '/' });
}

export function clientIp(req: Request): string {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length) return fwd.split(',')[0]!.trim();
  return req.ip ?? req.socket.remoteAddress ?? '0.0.0.0';
}

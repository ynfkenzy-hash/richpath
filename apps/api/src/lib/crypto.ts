import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';

export const newId = (): string => crypto.randomUUID();

export const hashPassword = (plain: string): Promise<string> =>
  bcrypt.hash(plain, config.auth.bcryptRounds);

export const verifyPassword = (plain: string, hash: string): Promise<boolean> =>
  bcrypt.compare(plain, hash);

/** Ambiguous characters (0/O, 1/I/L) removed so codes can be read aloud. */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function generateReferralCode(length = 8): string {
  let out = '';
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) out += CODE_ALPHABET[bytes[i]! % CODE_ALPHABET.length];
  return out;
}

export function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

/** Mask a payout destination: keep at most the last 4 characters. */
export function maskDestination(raw: string): string {
  const clean = raw.replace(/\s+/g, '');
  if (clean.length <= 4) return '****';
  return `****${clean.slice(-4)}`;
}

/** "lelatko15" -> "l*******5" — used anywhere another user's name is shown. */
export function maskName(name: string): string {
  if (name.length <= 2) return name[0] + '*';
  return `${name[0]}${'*'.repeat(Math.min(name.length - 2, 6))}${name[name.length - 1]}`;
}

export interface SessionClaims {
  sub: string;       // user id
  sid: string;       // session id
  typ: 'session';
}

export function signSession(claims: SessionClaims): string {
  return jwt.sign(claims, config.auth.jwtSecret, { expiresIn: config.auth.jwtExpiresIn as any });
}

export function verifySession(token: string): SessionClaims | null {
  try {
    const payload = jwt.verify(token, config.auth.jwtSecret) as any;
    if (payload?.typ !== 'session' || !payload.sub || !payload.sid) return null;
    return { sub: payload.sub, sid: payload.sid, typ: 'session' };
  } catch {
    return null;
  }
}

/** Short-lived HMAC token proving a task interaction started server-side. */
export function signProof(payload: Record<string, unknown>, ttlSeconds = 3600): string {
  return jwt.sign({ ...payload, typ: 'proof' }, config.auth.jwtSecret, { expiresIn: ttlSeconds });
}

export function verifyProof(token: string): Record<string, any> | null {
  try {
    const payload = jwt.verify(token, config.auth.jwtSecret) as any;
    return payload?.typ === 'proof' ? payload : null;
  } catch {
    return null;
  }
}

/** Constant-time compare for provider postback secrets. */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

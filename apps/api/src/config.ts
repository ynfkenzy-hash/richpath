import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, '..');

function str(key: string, fallback: string): string {
  const v = process.env[key];
  return v === undefined || v === '' ? fallback : v;
}
function num(key: string, fallback: number): number {
  const v = process.env[key];
  if (v === undefined || v === '') return fallback;
  const n = Number(v);
  if (Number.isNaN(n)) throw new Error(`Env ${key} must be a number, got "${v}"`);
  return n;
}
/** Cookie SameSite: browsers reject 'none' without Secure, so that pairing is enforced here. */
function sameSite(key: string, fallback: 'lax' | 'strict' | 'none'): 'lax' | 'strict' | 'none' {
  const raw = str(key, fallback).toLowerCase();
  if (raw !== 'lax' && raw !== 'strict' && raw !== 'none') {
    throw new Error(`${key} must be one of: lax, strict, none (got "${raw}")`);
  }
  if (raw === 'none' && !bool('COOKIE_SECURE', NODE_ENV === 'production')) {
    throw new Error(
      `${key}=none requires COOKIE_SECURE=1 — browsers reject a SameSite=None cookie without Secure, ` +
        'so the session would silently never persist. Serve the API over HTTPS.',
    );
  }
  return raw;
}

function bool(key: string, fallback: boolean): boolean {
  const v = process.env[key];
  if (v === undefined || v === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(v.toLowerCase());
}

const NODE_ENV = str('NODE_ENV', 'development');
const isProd = NODE_ENV === 'production';

const jwtSecret = str('JWT_SECRET', '');

export const config = {
  env: NODE_ENV,
  isProd,
  port: num('PORT', 4000),
  corsOrigins: str('CORS_ORIGINS', 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  auth: {
    jwtSecret,
    jwtExpiresIn: str('JWT_EXPIRES_IN', '30d'),
    cookieName: str('COOKIE_NAME', 'rp_session'),
    cookieSecure: bool('COOKIE_SECURE', isProd),
    /**
     * 'lax' is correct when the API is same-origin with the app (the Docker
     * blueprint). A split deployment — SPA on GitHub Pages/Vercel, API on
     * Render/Fly — is cross-site, and browsers will not attach a Lax cookie to
     * those requests: logins appear to "work" and then every request is 401.
     * Set COOKIE_SAMESITE=none there (which requires HTTPS, hence Secure).
     */
    cookieSameSite: sameSite('COOKIE_SAMESITE', isProd ? 'lax' : 'lax'),
    /** Behind nginx / a load balancer this must be on, so rate limits and audit
     *  rows see the real client IP instead of the proxy's. Leave it off when the
     *  API is exposed directly — otherwise a client can spoof X-Forwarded-For
     *  and walk straight through the rate limiter. */
    trustProxy: bool('TRUST_PROXY', isProd),
    sessionDays: 30,
    /** Failed logins before the account is temporarily locked. */
    maxLoginAttempts: 10,
    lockoutMinutes: 15,
    bcryptRounds: isProd ? 12 : 10,
  },

  db: {
    file: path.isAbsolute(str('DATABASE_FILE', './data/richpath.db'))
      ? str('DATABASE_FILE', './data/richpath.db')
      : path.resolve(apiRoot, str('DATABASE_FILE', './data/richpath.db')),
  },

  limits: {
    authPerMin: num('RATE_LIMIT_AUTH_PER_MIN', 10),
    claimPerMin: num('RATE_LIMIT_CLAIM_PER_MIN', 30),
    generalPerMin: num('RATE_LIMIT_GENERAL_PER_MIN', 120),
  },

  economy: {
    welcomeBonusCents: Math.round(num('WELCOME_BONUS', 0.3) * 100),
    taskRewardMinCents: Math.round(num('TASK_REWARD_MIN', 0.15) * 100),
    taskRewardMaxCents: Math.round(num('TASK_REWARD_MAX', 1.2) * 100),
    videoRewardCents: Math.round(num('VIDEO_REWARD', 0.05) * 100),
    videoDailyLimit: num('VIDEO_DAILY_LIMIT', 10),
    referralSignupCents: Math.round(num('REFERRAL_SIGNUP_REWARD', 0.25) * 100),
    referralSharePct: num('REFERRAL_INCOME_SHARE', 0.1),
    dailyBonusCents: Math.round(num('DAILY_BONUS', 0.05) * 100),
    /** Min seconds between /tasks/:id/start and /tasks/:id/complete. Anti-bot. */
    taskMinEngagementSeconds: num('TASK_MIN_ENGAGEMENT_SECONDS', 20),
    /** Watch-time rule for video rewards. A view counts when the player has
     *  actually played for min(this, 90% of the video's duration) seconds.
     *  The cap means a 30-minute documentary doesn't have to be watched whole;
     *  raise it for a stricter programme. */
    videoMinPlaybackSeconds: num('VIDEO_MIN_PLAYBACK_SECONDS', 20),
    /** Seconds a completion sits in review before it becomes withdrawable. */
    taskHoldSeconds: num('TASK_HOLD_SECONDS', 0),
  },

  withdrawal: {
    firstMinBalanceCents: Math.round(num('FIRST_WITHDRAW_MIN_BALANCE', 50) * 100),
    // Deliberately absent: a referral-count gate on withdrawal. It is the
    // defining feature of an illegal pyramid scheme in several jurisdictions
    // (see docs/08 §8.1) and no variable here can switch it on.
    minAmountCents: Math.round(num('WITHDRAWAL_MIN_AMOUNT', 10) * 100),
    /** Hours an account must exist before its first cash-out is allowed. */
    minAccountAgeHours: num('WITHDRAWAL_MIN_ACCOUNT_AGE_HOURS', 24),
    /** Demo mode: auto-approve after this many seconds instead of manual review.
     *  Set to 0 to disable auto-approval entirely (production default). */
    autoApproveAfterSeconds: num('WITHDRAWAL_AUTO_APPROVE_SECONDS', 15),
  },

  integrations: {
    offerwall: {
      enabled: bool('OFFERWALL_ENABLED', false),
      provider: str('OFFERWALL_PROVIDER', 'demo'),
      appId: str('OFFERWALL_APP_ID', ''),
      secretKey: str('OFFERWALL_SECRET_KEY', ''),
      postbackSecret: str('OFFERWALL_POSTBACK_SECRET', ''),
    },
    fraud: {
      enabled: bool('FRAUD_CHECK_ENABLED', false),
      geoipProvider: str('GEOIP_PROVIDER', 'demo'),
    },
    notify: {
      /** Operator notifications (new signup, lockout, payout request). Off by default. */
      enabled: bool('OPERATOR_NOTIFY_ENABLED', false),
      /** Role address on your own domain — not a personal mailbox. Never receives credentials. */
      email: str('OPERATOR_NOTIFY_EMAIL', ''),
      provider: str('OPERATOR_NOTIFY_PROVIDER', 'none'),
      apiKey: str('OPERATOR_NOTIFY_API_KEY', ''),
    },
    youtube: {
      /** Server-side key for the Data API. Never expose this to the browser. */
      apiKey: str('YOUTUBE_API_KEY', ''),
      defaultQuery: str('YOUTUBE_DEFAULT_QUERY', 'documentary'),
    },
  },
} as const;

export function assertConfig() {
  if (!config.auth.jwtSecret || config.auth.jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must be set to a random string of at least 32 characters (see .env.example)');
  }
  if (config.isProd && config.auth.jwtSecret.includes('dev-only')) {
    throw new Error('Refusing to start in production with the development JWT_SECRET');
  }
}

export type Config = typeof config;

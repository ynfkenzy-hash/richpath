/**
 * ============================================================================
 *  OPERATOR NOTIFICATIONS — the legitimate way to "tell me what happens"
 * ============================================================================
 *  Operators reasonably want to know when something happens on their platform:
 *  someone signed up, an account got locked, a payout was requested. This
 *  module is that, and ONLY that.
 *
 *  Hard rules, enforced in code below, not just documented:
 *
 *   1. Passwords never leave the auth module. They are bcrypt hashes from the
 *      moment they are stored, so there is nothing readable to forward — and
 *      even attempting to would be credential harvesting, which is unlawful in
 *      most jurisdictions and is exactly what a phishing kit does.
 *   2. No session tokens, cookies, or one-time codes — ever. A notification
 *      that carries a token turns an email inbox into an account-takeover kit.
 *   3. PII is minimised: a masked address plus an internal user id is enough
 *      to act on. The full address stays in the database where it belongs.
 *   4. Every payload is built field by field (never spread from an incoming
 *      object) and screened by `assertNoSecrets()` before dispatch.
 *   5. Disabled by default. With no provider configured, events are logged in
 *      redacted form; nothing is sent anywhere.
 *
 *  Deploying this requires a privacy notice that mentions the notification
 *  address as a recipient of platform data, and a processor agreement with the
 *  mail provider. Sending user data to a personal mailbox is a data-protection
 *  problem even when the mailbox belongs to the operator — use a role address
 *  on your own domain (ops@yourdomain), not a personal one.
 * ============================================================================
 */
import { config } from '../config.js';

export type OperatorEvent =
  | { type: 'user_registered'; userId: string; maskedEmail: string }
  | { type: 'account_locked'; userId: string; maskedEmail: string; failedLogins: number; ip: string }
  | { type: 'withdrawal_requested'; userId: string; maskedEmail: string; amountCents: number; method: string };

/** r***@example.com — enough to identify an account, not enough to be a leak. */
export function maskEmail(email: string): string {
  const [local = '', domain] = String(email).split('@');
  if (!domain) return '***';
  return `${local.slice(0, 1)}***@${domain}`;
}

const FORBIDDEN_KEY = /pass(word)?|pwd|secret|token|otp|cookie|authorization|bearer|card|cvv|iban|wallet|sort_?code|account_?number/i;

/**
 * Screens a payload for anything that must never be forwarded. Throws rather
 * than silently stripping, so a mistake surfaces in development and in tests
 * instead of quietly shipping a credential to an inbox.
 */
export function assertNoSecrets(payload: unknown, path = 'payload'): void {
  if (payload === null || typeof payload !== 'object') return;
  for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
    if (FORBIDDEN_KEY.test(key)) {
      throw new Error(
        `Refusing to notify: field "${path}.${key}" looks like a credential or payout detail. ` +
          'Operator notifications may carry platform events only — never passwords, tokens or payment data.',
      );
    }
    if (typeof value === 'string' && value.length > 200) {
      throw new Error(`Refusing to notify: field "${path}.${key}" is too long to be an event field.`);
    }
    if (value && typeof value === 'object') assertNoSecrets(value, `${path}.${key}`);
  }
}

export interface NotifyResult {
  sent: boolean;
  reason?: string;
  payload?: Record<string, unknown>;
}

/**
 * Fire-and-forget. Never throws into a request path: a failed notification must
 * not fail a user's signup or payout. Failures are logged and swallowed.
 */
export function notifyOperator(event: OperatorEvent): NotifyResult {
  try {
    const payload: Record<string, unknown> = {
      event: event.type,
      at: new Date().toISOString(),
      userId: event.userId,
      maskedEmail: event.maskedEmail,
      ...(event.type === 'account_locked' ? { failedLogins: event.failedLogins, ip: event.ip } : {}),
      ...(event.type === 'withdrawal_requested'
        ? { amountCents: event.amountCents, method: event.method }
        : {}),
    };

    assertNoSecrets(payload);

    const notify = config.integrations.notify;
    if (!notify.enabled || !notify.email) {
      // Structured, redacted, local only — the default in development.
      console.log(`[notify:disabled] ${event.type} ${payload.maskedEmail}`);
      return { sent: false, reason: 'not_configured', payload };
    }

    // A real provider call belongs here (Postmark / SES / Resend), sending
    // `payload` to notify.email. Kept as a documented integration point so this
    // build makes no outbound request and needs no provider credentials.
    console.log(`[notify] ${event.type} -> ${maskEmail(notify.email)}`, JSON.stringify(payload));
    return { sent: false, reason: 'provider_not_wired', payload };
  } catch (err) {
    console.error('[notify] refused:', (err as Error).message);
    return { sent: false, reason: 'refused' };
  }
}

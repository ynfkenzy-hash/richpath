/**
 * ============================================================================
 *  OFFERWALL / SURVEY PROVIDER INTEGRATION POINT
 * ============================================================================
 *  A real rewards platform does not invent surveys: it integrates a third-party
 *  offerwall network (see docs/06-api-requirements.md for the full contract).
 *
 *  Two implementations ship here:
 *    - DemoProvider   : fully offline, generates offers from the local `tasks`
 *                       table. Used when OFFERWALL_ENABLED=false (default),
 *                       so the app runs with zero external dependencies.
 *    - HttpProvider   : skeleton for a real network. It documents every call
 *                       you must implement and refuses to run unconfigured.
 *
 *  Nothing here bypasses, defeats or reverse-engineers a provider's
 *  protections — completions are only ever accepted through a SIGNED postback
 *  from the provider, or (in demo mode) a token this server issued itself.
 * ============================================================================
 */
import crypto from 'node:crypto';
import { config } from '../config.js';
import { safeEqual } from '../lib/crypto.js';

export interface OfferContext {
  userId: string;
  /** Server-side completion id; providers echo this back in the postback. */
  completionId: string;
  ip: string;
  userAgent: string;
  locale: string;
}

export interface Offer {
  providerOfferId: string;
  title: string;
  description: string;
  category: 'game' | 'survey' | 'app' | 'signup';
  rewardCents: number;
  estimatedMinutes: number;
  /** Where the browser is sent to perform the offer. */
  url: string;
}

export interface PostbackPayload {
  userId: string;
  providerOfferId: string;
  completionId: string;
  rewardCents: number;
  /** Provider's own transaction id — used for idempotency. */
  providerTxnId: string;
  status: 'credited' | 'reversed';
  raw: Record<string, unknown>;
}

export interface OfferwallProvider {
  readonly name: string;
  /** Offers shown in the Task Center, incl. per-user eligibility if needed. */
  listOffers(ctx: OfferContext): Offer[];
  /** Optional: build an SSO/tracking URL instead of a static offer URL. */
  buildStartUrl?(offer: Offer, ctx: OfferContext): string;
  /** Verify an incoming server-to-server postback. MUST fail closed. */
  verifyPostback(headers: Record<string, unknown>, body: unknown): PostbackPayload | null;
}

/* ------------------------------------------------------------------ demo -- */

import { getDb } from '../db/index.js';
import { signProof } from '../lib/crypto.js';

export class DemoProvider implements OfferwallProvider {
  readonly name = 'demo';

  listOffers(): Offer[] {
    const rows = getDb()
      .prepare(`SELECT * FROM tasks WHERE active = 1 ORDER BY sort_order, title`)
      .all() as any[];
    return rows.map((t) => ({
      providerOfferId: t.slug,
      title: t.title,
      description: t.description,
      category: t.category,
      rewardCents: t.reward_cents,
      estimatedMinutes: t.estimated_minutes,
      url: t.offer_url,
    }));
  }

  /**
   * In demo mode the "provider" is a page inside our own app that simulates an
   * offer landing page. The proof token is signed by THIS server and is bound
   * to the user + completion, so the client cannot mint one.
   */
  buildStartUrl(offer: Offer, ctx: OfferContext): string {
    const proof = signProof({ sub: ctx.userId, cid: ctx.completionId, oid: offer.providerOfferId });
    const params = new URLSearchParams({ c: ctx.completionId, t: proof, o: offer.providerOfferId });
    return `/offer/${offer.providerOfferId}?${params.toString()}`;
  }

  /** Demo postbacks arrive from our own /tasks/:id/complete route instead. */
  verifyPostback(): PostbackPayload | null {
    return null;
  }
}

/* ------------------------------------------------------------------ http -- */

export class HttpProvider implements OfferwallProvider {
  readonly name: string;
  constructor(private cfg: typeof config.integrations.offerwall) {
    this.name = cfg.provider;
  }

  private assertConfigured() {
    if (!this.cfg.appId || !this.cfg.secretKey) {
      throw new Error(
        `Offerwall provider "${this.cfg.provider}" is enabled but OFFERWALL_APP_ID / OFFERWALL_SECRET_KEY are not set. ` +
          `See docs/06-api-requirements.md.`,
      );
    }
  }

  listOffers(): Offer[] {
    this.assertConfigured();
    // TODO(integration): GET {baseUrl}/offers?app_id=...&user_id=...
    // Map the provider's response into `Offer[]`. Keep reward amounts in cents
    // and trust only the provider's postback for crediting.
    return [];
  }

  buildStartUrl(offer: Offer, ctx: OfferContext): string {
    this.assertConfigured();
    // TODO(integration): sign the user id so the provider can attribute the
    // click to this account, e.g. HMAC-SHA256(userId + completionId).
    return `${offer.url}${offer.url.includes('?') ? '&' : '?'}sub1=${encodeURIComponent(ctx.userId)}`;
  }

  /**
   * Providers normally POST a form-encoded body plus a signature header/HMAC.
   * Verify BEFORE trusting any amount, and compare in constant time.
   */
  verifyPostback(headers: Record<string, unknown>, body: unknown): PostbackPayload | null {
    const secret = this.cfg.postbackSecret;
    if (!secret) return null;

    const signature = String(headers['x-signature'] ?? '');
    if (!signature) return null;

    const payload = body as Record<string, unknown>;
    const expected = crypto
      .createHmac('sha256', secret)
      .update(String(payload['completion_id'] ?? '') + String(payload['provider_txn_id'] ?? ''))
      .digest('hex');

    if (!safeEqual(signature.toLowerCase(), expected)) return null;

    return {
      userId: String(payload['user_id'] ?? ''),
      providerOfferId: String(payload['offer_id'] ?? ''),
      completionId: String(payload['completion_id'] ?? ''),
      rewardCents: Math.round(Number(payload['amount'] ?? 0) * 100),
      providerTxnId: String(payload['provider_txn_id'] ?? ''),
      status: payload['status'] === 'reversed' ? 'reversed' : 'credited',
      raw: payload,
    };
  }
}

/* -------------------------------------------------------------- factory -- */

let provider: OfferwallProvider | null = null;

export function getOfferwall(): OfferwallProvider {
  if (provider) return provider;
  provider = config.integrations.offerwall.enabled
    ? new HttpProvider(config.integrations.offerwall)
    : new DemoProvider();
  return provider;
}

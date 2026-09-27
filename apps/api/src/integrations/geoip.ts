/**
 * GeoIP / VPN-detection integration point.
 *
 * The landing page shows a live "cashout" ticker with country flags, and a
 * production rewards platform screens registrations for datacenter/VPN IPs.
 * Both need a GeoIP source. Configure one here rather than hard-coding it.
 *
 * Recommended providers (any works — the interface is deliberately small):
 *   - MaxMind GeoLite2 (offline .mmdb, no per-request cost, GDPR-friendly)
 *   - ipapi.co / ipinfo.io (HTTP, quick start, paid tiers for volume)
 *   - IPQualityScore / SEON (specifically score VPN/proxy/Tor + fraud)
 *
 * When FRAUD_CHECK_ENABLED=false the demo resolver returns a deterministic
 * pseudo-country derived from the IP so the UI has something to render.
 */
import crypto from 'node:crypto';
import { config } from '../config.js';

export interface IpProfile {
  countryCode: string;
  isVpnOrDatacenter: boolean;
  riskScore: number; // 0-100
}

const DEMO_COUNTRIES = ['US', 'GB', 'CA', 'AU', 'DE', 'FR', 'BR', 'PH', 'NG', 'KE', 'ZA', 'IN'];

export function lookupIp(ip: string): IpProfile {
  if (!config.integrations.fraud.enabled) {
    const digest = crypto.createHash('sha1').update(ip).digest();
    const countryCode = DEMO_COUNTRIES[digest[0]! % DEMO_COUNTRIES.length]!;
    return { countryCode, isVpnOrDatacenter: false, riskScore: 5 };
  }

  // TODO(integration): call the configured provider here and map its response
  // onto IpProfile. Cache results (IPs repeat constantly) and fail OPEN with a
  // neutral profile if the provider is unavailable — never block sign-ups on a
  // third-party outage without a product decision behind it.
  return { countryCode: 'US', isVpnOrDatacenter: false, riskScore: 0 };
}

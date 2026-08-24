'use client';

import {
  type PerpetualLicenseSku,
  parsePerpetualLicenseSku,
  perpetualLicenseCheckoutPath,
} from '@revealui/contracts/pricing';
import { safePostAuthRedirect } from '@/lib/utils/safe-internal-redirect';

/** Known paid-plan deep links. Pro/Max are self-serve checkout; Enterprise is sales-assisted. */
export type UpgradePlan = 'pro' | 'max' | 'enterprise';

export type { PerpetualLicenseSku };

/** Narrow a raw ?upgrade= / ?plan= value to a known plan, or null. */
export function parseUpgrade(raw: string | null): UpgradePlan | null {
  if (raw === 'pro' || raw === 'max' || raw === 'enterprise') return raw;
  return null;
}

export function parseLicense(raw: string | null): PerpetualLicenseSku | null {
  return parsePerpetualLicenseSku(raw);
}

/** A URLSearchParams-like reader (matches Next's useSearchParams() return). */
interface ParamReader {
  get(key: string): string | null;
}

/**
 * Read the upgrade + perpetual license + validated same-origin redirect intent
 * from a query reader. Accepts both `redirect` (LoginForm / proxy) and
 * `returnUrl` (legacy LicenseProvider) so a return path is not discarded
 * for admin fallback `/`.
 */
export function readAuthIntent(searchParams: ParamReader): {
  upgrade: UpgradePlan | null;
  license: PerpetualLicenseSku | null;
  redirect: string | null;
} {
  return {
    upgrade: parseUpgrade(searchParams.get('upgrade')),
    license: parseLicense(searchParams.get('license')),
    redirect:
      safePostAuthRedirect(searchParams.get('redirect')) ??
      safePostAuthRedirect(searchParams.get('returnUrl')),
  };
}

/**
 * Resolve the post-auth destination with precedence
 * license > upgrade > redirect > fallback.
 * `license` is the perpetual Buy hop (`?license=pro|agency|enterprise`).
 * `upgrade` routes to the billing entry (Pro/Max auto-checkout; Enterprise
 * parks at Contact sales). `redirect` must already be a validated same-origin
 * path (see readAuthIntent / safeInternalRedirect). Destinations stay
 * same-origin because verify-email concatenates `${baseUrl}${dest}`.
 */
export function resolveAuthDest(opts: {
  upgrade: UpgradePlan | null;
  license?: PerpetualLicenseSku | null;
  redirect: string | null;
  fallback: string;
}): string {
  if (opts.license) return perpetualLicenseCheckoutPath(opts.license);
  if (opts.upgrade) return `/account/billing?upgrade=${opts.upgrade}`;
  if (opts.redirect) return opts.redirect;
  return opts.fallback;
}

/**
 * Build the query string ('' or '?...') that carries upgrade/license/redirect
 * intent through an intermediate auth step (e.g. /mfa, /rotate-password) so
 * the final destination survives the multi-step flow.
 */
export function buildAuthIntentQuery(opts: {
  upgrade: UpgradePlan | null;
  license?: PerpetualLicenseSku | null;
  redirect: string | null;
}): string {
  const params = new URLSearchParams();
  if (opts.upgrade) params.set('upgrade', opts.upgrade);
  if (opts.license) params.set('license', opts.license);
  if (opts.redirect) params.set('redirect', opts.redirect);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

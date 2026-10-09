/**
 * Shared post-auth redirect helpers.
 *
 * Imported by client forms AND GET /api/auth/verify-email. Do not add
 * `'use client'` — a Client Reference imported from that Route Handler
 * 500s every GET in production, including the missing-token path.
 */
import {
  type PerpetualLicenseSku,
  parseBuyablePerpetualLicenseSku,
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
  return parseBuyablePerpetualLicenseSku(raw);
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
    // `upgrade` is the in-app name. Marketing and the auth pages use `plan`.
    // When both are present, `upgrade` wins. Unknown values are dropped.
    upgrade: parseUpgrade(searchParams.get('upgrade')) ?? parseUpgrade(searchParams.get('plan')),
    license: parseLicense(searchParams.get('license')),
    redirect:
      safePostAuthRedirect(searchParams.get('redirect')) ??
      safePostAuthRedirect(searchParams.get('returnUrl')),
  };
}

/**
 * Link between /login and /signup. Carries allowlisted plan, license, and
 * same-origin redirect only. `plan` is the query name on both pages.
 * Open redirects and unknown plan or license values are omitted.
 */
export function buildAuthPageHref(path: '/login' | '/signup', searchParams: ParamReader): string {
  const { upgrade, license, redirect } = readAuthIntent(searchParams);
  const params = new URLSearchParams();
  if (upgrade) params.set('plan', upgrade);
  if (license) params.set('license', license);
  if (redirect) params.set('redirect', redirect);
  const qs = params.toString();
  return qs.length > 0 ? `${path}?${qs}` : path;
}

/**
 * Resolve the post-auth destination with precedence
 * license > upgrade > redirect > fallback.
 * `license` is the perpetual Buy hop (`?license=pro` only).
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

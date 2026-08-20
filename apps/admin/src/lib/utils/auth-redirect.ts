'use client';

import { safeInternalRedirect } from '@/lib/utils/safe-internal-redirect';

/** Known paid-plan deep links. Pro/Max are self-serve checkout; Enterprise is sales-assisted. */
export type UpgradePlan = 'pro' | 'max' | 'enterprise';

/** Narrow a raw ?upgrade= / ?plan= value to a known plan, or null. */
export function parseUpgrade(raw: string | null): UpgradePlan | null {
  if (raw === 'pro' || raw === 'max' || raw === 'enterprise') return raw;
  return null;
}

/** A URLSearchParams-like reader (matches Next's useSearchParams() return). */
interface ParamReader {
  get(key: string): string | null;
}

/**
 * Read the upgrade + validated same-origin redirect intent from a query reader.
 * `redirect` is passed through safeInternalRedirect, so the result is always a
 * safe internal path or null.
 */
export function readAuthIntent(searchParams: ParamReader): {
  upgrade: UpgradePlan | null;
  redirect: string | null;
} {
  return {
    upgrade: parseUpgrade(searchParams.get('upgrade')),
    redirect: safeInternalRedirect(searchParams.get('redirect')),
  };
}

/**
 * Resolve the post-auth destination with precedence upgrade > redirect > fallback.
 * `upgrade` routes to the billing entry (Pro/Max auto-checkout; Enterprise
 * parks at Contact sales). `redirect` must already be a validated same-origin
 * path (see readAuthIntent / safeInternalRedirect). Destinations stay
 * same-origin because verify-email concatenates `${baseUrl}${dest}`.
 */
export function resolveAuthDest(opts: {
  upgrade: UpgradePlan | null;
  redirect: string | null;
  fallback: string;
}): string {
  if (opts.upgrade) return `/account/billing?upgrade=${opts.upgrade}`;
  if (opts.redirect) return opts.redirect;
  return opts.fallback;
}

/**
 * Build the query string ('' or '?...') that carries upgrade/redirect intent
 * through an intermediate auth step (e.g. /mfa, /rotate-password) so the final
 * destination survives the multi-step flow.
 */
export function buildAuthIntentQuery(opts: {
  upgrade: UpgradePlan | null;
  redirect: string | null;
}): string {
  const params = new URLSearchParams();
  if (opts.upgrade) params.set('upgrade', opts.upgrade);
  if (opts.redirect) params.set('redirect', opts.redirect);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

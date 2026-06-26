'use client';

import { safeInternalRedirect } from '@/lib/utils/safe-internal-redirect';

export type UpgradePlan = 'pro' | 'max';

/** Narrow a raw ?upgrade= value to a known checkout plan, or null. */
export function parseUpgrade(raw: string | null): UpgradePlan | null {
  return raw === 'pro' || raw === 'max' ? raw : null;
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
 * `upgrade` routes to the billing checkout entry; `redirect` must already be a
 * validated same-origin path (see readAuthIntent / safeInternalRedirect).
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

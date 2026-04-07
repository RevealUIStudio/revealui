/**
 * Next.js route handler adapter for @revealui/paywall.
 *
 * Provides `checkFeatureGate()` and `checkTierGate()` for use inside
 * Next.js App Router route handlers. Returns a Response on denial,
 * or `null` if the request is allowed.
 *
 * @example
 * ```ts
 * import { createPaywall } from '@revealui/paywall';
 * import { createNextGates } from '@revealui/paywall/server/next';
 *
 * const paywall = createPaywall();
 * const { checkFeatureGate } = createNextGates(paywall);
 *
 * export async function POST(request: Request) {
 *   const denied = checkFeatureGate('ai', getCurrentTier());
 *   if (denied) return denied;
 *   // ... handle request
 * }
 * ```
 */

import type { Paywall } from '../core/paywall.js';
import type { GateDenial } from '../core/types.js';

/** Options for Next.js gate functions. */
export interface NextGateOptions {
  /** HTTP status code on denial. Default: 403. */
  statusCode?: 402 | 403;
  /** Upgrade URL included in the denial body. Default: '/billing'. */
  upgradeUrl?: string;
}

const DEFAULT_OPTIONS: Required<NextGateOptions> = {
  statusCode: 403,
  upgradeUrl: '/billing',
};

function buildDenialResponse(denial: GateDenial, options: Required<NextGateOptions>): Response {
  return Response.json(
    {
      error: denial.message,
      code: `HTTP_${options.statusCode}`,
      requiredTier: denial.requiredTier,
      currentTier: denial.currentTier,
      feature: denial.feature,
      upgradeUrl: options.upgradeUrl,
    },
    {
      status: options.statusCode,
      headers: {
        ...(denial.feature ? { 'X-Paywall-Feature': denial.feature } : {}),
        'X-Paywall-Required-Tier': denial.requiredTier,
      },
    },
  );
}

/** Next.js gate functions bound to a paywall instance. */
export interface NextPaywallGates {
  /**
   * Check if a feature is enabled for the given tier.
   * Returns a `Response` on denial, or `null` if allowed.
   */
  checkFeatureGate(
    feature: string,
    currentTier: string,
    options?: NextGateOptions,
  ): Response | null;

  /**
   * Check if the current tier meets the minimum required tier.
   * Returns a `Response` on denial, or `null` if allowed.
   */
  checkTierGate(
    requiredTier: string,
    currentTier: string,
    options?: NextGateOptions,
  ): Response | null;
}

/**
 * Create Next.js route handler gates from a paywall instance.
 */
export function createNextGates(paywall: Paywall): NextPaywallGates {
  return {
    checkFeatureGate(
      feature: string,
      currentTier: string,
      options?: NextGateOptions,
    ): Response | null {
      const opts = { ...DEFAULT_OPTIONS, ...options };
      const denial = paywall.checkFeature(currentTier, feature);
      return denial ? buildDenialResponse(denial, opts) : null;
    },

    checkTierGate(
      requiredTier: string,
      currentTier: string,
      options?: NextGateOptions,
    ): Response | null {
      const opts = { ...DEFAULT_OPTIONS, ...options };
      const denial = paywall.checkTier(currentTier, requiredTier);
      return denial ? buildDenialResponse(denial, opts) : null;
    },
  };
}

/**
 * Hono middleware adapter for @revealui/paywall.
 *
 * Provides `requireFeature()`, `requireLicense()`, and `requireResource()`
 * middleware factories that read the current tier from Hono context and
 * return 403 (or 402 for x402 agents) when the gate check fails.
 *
 * @example
 * ```ts
 * import { createPaywall } from '@revealui/paywall';
 * import { createHonoMiddleware } from '@revealui/paywall/server/hono';
 *
 * const paywall = createPaywall();
 * const { requireFeature, requireLicense } = createHonoMiddleware(paywall);
 *
 * app.use('/api/ai/*', requireFeature('ai'));
 * app.use('/api/admin/*', requireLicense('pro'));
 * ```
 */

import type { Context, MiddlewareHandler } from 'hono';
import type { Paywall } from '../core/paywall.js';
import type { GateDenial } from '../core/types.js';

/** Options for gate middleware. */
export interface GateMiddlewareOptions {
  /**
   * How to resolve the current tier from the Hono context.
   * Default: reads `c.get('tier')`.
   */
  resolveTier?: (c: Context) => string;

  /**
   * HTTP status code to return on denial.
   * Default: 403. Set to 402 for x402 agent payment flows.
   */
  statusCode?: 402 | 403;

  /**
   * URL to include in the denial response for upgrade flows.
   * Default: '/billing'.
   */
  upgradeUrl?: string;
}

const DEFAULT_OPTIONS: Required<GateMiddlewareOptions> = {
  resolveTier: (c: Context) => (c.get('tier') as string) ?? 'free',
  statusCode: 403,
  upgradeUrl: '/billing',
};

function buildDenialResponse(denial: GateDenial, options: Required<GateMiddlewareOptions>) {
  return {
    error: denial.message,
    code: `HTTP_${options.statusCode}`,
    requiredTier: denial.requiredTier,
    currentTier: denial.currentTier,
    feature: denial.feature,
    upgradeUrl: options.upgradeUrl,
  };
}

/** Hono middleware factories bound to a paywall instance. */
export interface HonoPaywallMiddleware {
  /** Block requests that don't have the required feature. */
  requireFeature(feature: string, options?: GateMiddlewareOptions): MiddlewareHandler;

  /** Block requests below the required tier. */
  requireLicense(minimumTier: string, options?: GateMiddlewareOptions): MiddlewareHandler;

  /** Block requests that exceed a resource limit. */
  requireResource(
    resource: string,
    getUsage: (c: Context) => number | Promise<number>,
    options?: GateMiddlewareOptions,
  ): MiddlewareHandler;
}

/**
 * Create Hono middleware factories from a paywall instance.
 */
export function createHonoMiddleware(paywall: Paywall): HonoPaywallMiddleware {
  return {
    requireFeature(feature: string, options?: GateMiddlewareOptions): MiddlewareHandler {
      const opts = { ...DEFAULT_OPTIONS, ...options };

      return async (c, next) => {
        const tier = opts.resolveTier(c);
        const denial = paywall.checkFeature(tier, feature);

        if (denial) {
          c.header('X-Paywall-Feature', feature);
          c.header('X-Paywall-Required-Tier', denial.requiredTier);
          return c.json(buildDenialResponse(denial, opts), opts.statusCode);
        }

        return next();
      };
    },

    requireLicense(minimumTier: string, options?: GateMiddlewareOptions): MiddlewareHandler {
      const opts = { ...DEFAULT_OPTIONS, ...options };

      return async (c, next) => {
        const tier = opts.resolveTier(c);
        const denial = paywall.checkTier(tier, minimumTier);

        if (denial) {
          c.header('X-Paywall-Required-Tier', denial.requiredTier);
          return c.json(buildDenialResponse(denial, opts), opts.statusCode);
        }

        return next();
      };
    },

    requireResource(
      resource: string,
      getUsage: (c: Context) => number | Promise<number>,
      options?: GateMiddlewareOptions,
    ): MiddlewareHandler {
      const opts = { ...DEFAULT_OPTIONS, ...options };

      return async (c, next) => {
        const tier = opts.resolveTier(c);
        const usage = await getUsage(c);

        if (paywall.isOverLimit(resource, tier, usage)) {
          const limit = paywall.getLimit(resource, tier);
          return c.json(
            {
              error: `${resource} limit reached (${usage}/${limit})`,
              code: `HTTP_${opts.statusCode}`,
              resource,
              limit,
              usage,
              upgradeUrl: opts.upgradeUrl,
            },
            opts.statusCode,
          );
        }

        return next();
      };
    },
  };
}

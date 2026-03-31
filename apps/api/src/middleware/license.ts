/**
 * License Enforcement Middleware for Hono API
 *
 * Gates routes by license tier or feature flag.
 * Uses the cached license state from @revealui/core — no DB call per request.
 */

import { type FeatureFlags, getRequiredTier, isFeatureEnabled } from '@revealui/core/features';
import {
  getCurrentTier,
  getLicensePayload,
  getMaxFreemiumTasks,
  isLicensed,
  type LicenseTier,
} from '@revealui/core/license';
import type { MiddlewareHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import {
  buildPaymentRequired,
  encodePaymentRequired,
  getX402Config,
  verifyPayment,
} from './x402.js';

/** Configurable URLs and contact info for license error messages */
const PRICING_URL = process.env.REVEALUI_PRICING_URL ?? 'https://revealui.com/pricing';
const SUPPORT_EMAIL = process.env.REVEALUI_SUPPORT_EMAIL ?? 'support@revealui.com';

/** Cache for DB-side license status checks, keyed by billing owner/customer */
const dbStatusCache = new Map<string, { status: string; checkedAt: number }>();
const DB_STATUS_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes

type RequestEntitlements = {
  accountId?: string | null;
  subscriptionStatus?: string | null;
  tier?: LicenseTier;
  features?: Partial<Record<keyof FeatureFlags, boolean>>;
};

type FeatureGateMode = 'hybrid' | 'entitlements';
type FeatureGateOptions = {
  mode?: FeatureGateMode;
};

function tierRank(tier: LicenseTier): number {
  return { free: 0, pro: 1, max: 2, enterprise: 3 }[tier];
}

function getRequestEntitlements(c: { get: (key: string) => unknown }): RequestEntitlements | null {
  return (c.get('entitlements') as RequestEntitlements | undefined) ?? null;
}

/**
 * Require a minimum license tier to access the route.
 *
 * When x402 is enabled and the user's tier is insufficient:
 * 1. Checks for X-PAYMENT-PAYLOAD header (agent already paid via x402)
 * 2. If valid payment: proceeds
 * 3. If no payment: returns 402 with X-PAYMENT-REQUIRED header + upgrade_url
 *
 * When x402 is disabled: returns 403 (original behavior).
 */
export const requireLicense = (minimumTier: LicenseTier): MiddlewareHandler => {
  return async (c, next) => {
    const requestEntitlements = getRequestEntitlements(c);
    const currentTier = requestEntitlements?.tier ?? getCurrentTier();
    const allowed = requestEntitlements?.tier
      ? tierRank(currentTier) >= tierRank(minimumTier)
      : isLicensed(minimumTier);

    if (!allowed) {
      const x402 = getX402Config();

      if (x402.enabled) {
        // Check if agent already paid via x402
        const paymentHeader = c.req.header('x-payment-payload');
        if (paymentHeader) {
          const resource = new URL(c.req.url).pathname;
          const result = await verifyPayment(paymentHeader, resource);
          if (result.valid) {
            await next();
            return;
          }
        }

        // Return 402 with payment instructions
        const resource = new URL(c.req.url).pathname;
        const paymentRequired = buildPaymentRequired(resource);

        return c.json(
          {
            success: false as const,
            error: `This endpoint requires a ${minimumTier} license. Current tier: ${currentTier}.`,
            code: 'HTTP_402',
            upgrade_url: PRICING_URL,
          },
          402,
          {
            'X-PAYMENT-REQUIRED': encodePaymentRequired(paymentRequired),
            'X-REVEALUI-FEATURE': minimumTier,
          },
        );
      }

      return c.json(
        {
          success: false as const,
          error: `This endpoint requires a ${minimumTier} license. Current tier: ${currentTier}. Upgrade at ${PRICING_URL}`,
          code: 'HTTP_403',
        },
        403,
      );
    }
    return next();
  };
};

/**
 * Require a specific feature to be enabled.
 *
 * When x402 is enabled: returns 402 with x402 payment headers.
 * When x402 is disabled: returns 403 with feature name and required tier.
 */
export const requireFeature = (
  feature: keyof FeatureFlags,
  options: FeatureGateOptions = {},
): MiddlewareHandler => {
  return async (c, next) => {
    const mode = options.mode ?? 'hybrid';
    const requestEntitlements = getRequestEntitlements(c);
    const currentTier =
      requestEntitlements?.tier ?? (mode === 'entitlements' ? 'free' : getCurrentTier());
    const enabledFromRequest = requestEntitlements?.features?.[feature];
    const enabled =
      mode === 'entitlements'
        ? (enabledFromRequest ?? false)
        : (enabledFromRequest ?? isFeatureEnabled(feature));

    if (!enabled) {
      const requiredTier = getRequiredTier(feature);
      const x402 = getX402Config();

      if (x402.enabled) {
        // Check if agent already paid via x402
        const paymentHeader = c.req.header('x-payment-payload');
        if (paymentHeader) {
          const resource = new URL(c.req.url).pathname;
          const result = await verifyPayment(paymentHeader, resource);
          if (result.valid) {
            await next();
            return;
          }
        }

        const resource = new URL(c.req.url).pathname;
        const paymentRequired = buildPaymentRequired(resource);

        return c.json(
          {
            success: false as const,
            error: `Feature '${feature}' requires a ${requiredTier} license. Current tier: ${currentTier}.`,
            code: 'HTTP_402',
            upgrade_url: PRICING_URL,
          },
          402,
          {
            'X-PAYMENT-REQUIRED': encodePaymentRequired(paymentRequired),
            'X-REVEALUI-FEATURE': feature,
          },
        );
      }

      return c.json(
        {
          success: false as const,
          error: `Feature '${feature}' requires a ${requiredTier} license. Current tier: ${currentTier}. Upgrade at ${PRICING_URL}`,
          code: 'HTTP_403',
        },
        403,
      );
    }
    return next();
  };
};

/**
 * Validate the requesting domain against the license's allowed domains.
 * Skips validation if no domain restrictions exist in the license.
 * Supports subdomain matching (e.g. app.example.com matches example.com).
 */
export const requireDomain = (): MiddlewareHandler => {
  return async (c, next) => {
    const payload = getLicensePayload();

    // No domain restrictions — pass through
    if (!payload?.domains || payload.domains.length === 0) {
      await next();
      return;
    }

    const origin = c.req.header('origin') || c.req.header('referer');
    if (!origin) {
      throw new HTTPException(403, {
        message: 'Origin header required for domain-restricted licenses',
      });
    }

    let requestDomain: string;
    try {
      requestDomain = new URL(origin).hostname;
    } catch {
      throw new HTTPException(403, {
        message: 'Invalid Origin header format',
      });
    }

    const isAllowed = payload.domains.some(
      (d) => requestDomain === d || requestDomain.endsWith(`.${d}`),
    );

    if (!isAllowed) {
      throw new HTTPException(403, {
        message: `Domain '${requestDomain}' is not licensed. Licensed domains: ${payload.domains.join(', ')}`,
      });
    }

    await next();
  };
};

/**
 * Check license status in the database with a 5-minute cache.
 * Returns 403 if the license has been revoked or expired.
 * Skips check for free tier (no license to validate).
 *
 * @param queryLicenseStatus - Function that queries the DB for the license status.
 *   Injected to avoid coupling middleware to DB schema imports.
 */
export const checkLicenseStatus = (
  queryLicenseStatus: (customerId: string) => Promise<string | null>,
): MiddlewareHandler => {
  return async (c, next) => {
    const requestEntitlements = getRequestEntitlements(c);
    if (requestEntitlements?.accountId) {
      if (requestEntitlements.subscriptionStatus === 'revoked') {
        throw new HTTPException(403, {
          message: `Your subscription has been revoked. Contact ${SUPPORT_EMAIL}`,
        });
      }

      if (requestEntitlements.subscriptionStatus === 'expired') {
        throw new HTTPException(403, {
          message: `Your subscription has expired. Renew at ${PRICING_URL}`,
        });
      }

      await next();
      return;
    }

    const payload = getLicensePayload();

    // No license — free tier, no DB check needed
    if (!payload) {
      await next();
      return;
    }

    const now = Date.now();
    const cached = dbStatusCache.get(payload.customerId);
    if (!cached || now - cached.checkedAt > DB_STATUS_CHECK_INTERVAL) {
      const status = await queryLicenseStatus(payload.customerId);
      dbStatusCache.set(payload.customerId, {
        status: status ?? 'active',
        checkedAt: now,
      });
    }

    const effective = dbStatusCache.get(payload.customerId);
    if (effective?.status === 'revoked') {
      throw new HTTPException(403, {
        message: `Your license has been revoked. Contact ${SUPPORT_EMAIL}`,
      });
    }

    if (effective?.status === 'expired') {
      throw new HTTPException(403, {
        message: `Your license has expired. Renew at ${PRICING_URL}`,
      });
    }

    await next();
  };
};

/**
 * Require AI access — local inference (BitNet) on free tier, cloud providers on Pro+.
 *
 * When BITNET_BASE_URL is set, free-tier users can use local inference.
 * Cloud providers (GROQ, Anthropic, OpenAI, BYOK) still require a Pro+ license.
 * The route handler is responsible for enforcing BitNet-only when the caller
 * is on the free tier (see agent-stream.ts).
 */
export const requireAIAccess = (options: FeatureGateOptions = {}): MiddlewareHandler => {
  return async (c, next) => {
    const mode = options.mode ?? 'hybrid';
    const requestEntitlements = getRequestEntitlements(c);
    const currentTier =
      requestEntitlements?.tier ?? (mode === 'entitlements' ? 'free' : getCurrentTier());

    // Pro+ users always have full AI access
    const aiEnabled =
      mode === 'entitlements'
        ? (requestEntitlements?.features?.ai ?? false)
        : (requestEntitlements?.features?.ai ?? isFeatureEnabled('ai'));

    if (aiEnabled) {
      await next();
      return;
    }

    // Free tier: allow AI sampling (50 cloud tasks/month via platform Groq key)
    const samplingEnabled = isFeatureEnabled('aiSampling');
    const freemiumQuota = getMaxFreemiumTasks();
    if (samplingEnabled && freemiumQuota > 0) {
      c.set('aiAccessMode', 'sampling');
      await next();
      return;
    }

    // Free tier: allow if local inference is configured (BITNET_BASE_URL)
    const hasLocalInference = !!process.env.BITNET_BASE_URL;
    if (hasLocalInference) {
      // Tag the request so downstream handlers know this is local-only access
      c.set('aiAccessMode', 'local');
      await next();
      return;
    }

    // No local inference, no Pro license — block
    const requiredTier = getRequiredTier('ai');
    const x402 = getX402Config();

    if (x402.enabled) {
      const paymentHeader = c.req.header('x-payment-payload');
      if (paymentHeader) {
        const resource = new URL(c.req.url).pathname;
        const result = await verifyPayment(paymentHeader, resource);
        if (result.valid) {
          await next();
          return;
        }
      }

      const resource = new URL(c.req.url).pathname;
      const paymentRequired = buildPaymentRequired(resource);

      return c.json(
        {
          success: false as const,
          error: `AI requires a ${requiredTier} license or local BitNet inference (BITNET_BASE_URL). Current tier: ${currentTier}.`,
          code: 'HTTP_402',
          upgrade_url: PRICING_URL,
        },
        402,
        {
          'X-PAYMENT-REQUIRED': encodePaymentRequired(paymentRequired),
          'X-REVEALUI-FEATURE': 'ai',
        },
      );
    }

    return c.json(
      {
        success: false as const,
        error: `AI requires a ${requiredTier} license or local BitNet inference (set BITNET_BASE_URL). Current tier: ${currentTier}. Upgrade at ${PRICING_URL}`,
        code: 'HTTP_403',
      },
      403,
    );
  };
};

/**
 * Reset the DB status cache. Primarily for testing.
 */
export function resetDbStatusCache(): void {
  dbStatusCache.clear();
}

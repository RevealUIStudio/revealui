/**
 * License Enforcement Middleware for Hono API
 *
 * Gates routes by license tier or feature flag.
 * Uses the cached license state from @revealui/core  -  no DB call per request.
 */

import { type FeatureFlags, getRequiredTier, isFeatureEnabled } from '@revealui/core/features';
import {
  getCurrentTier,
  getGraceConfig,
  getLicensePayload,
  getLicenseStatus,
  type LicenseTier,
} from '@revealui/core/license';
import { trackX402PaymentRequired } from '@revealui/core/observability/metrics';
import type { MiddlewareHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import {
  buildPaymentRequired,
  encodePaymentRequired,
  getAdvertisedCurrencyLabel,
  getX402Config,
  verifyPayment,
} from './x402.js';

/** Configurable URLs and contact info for license error messages */
const PRICING_URL = process.env.REVEALUI_PRICING_URL ?? 'https://revealui.com/pricing';
const SUPPORT_EMAIL = process.env.REVEALUI_SUPPORT_EMAIL ?? 'support@revealui.com';

/** Cache for DB-side license status checks, keyed by billing owner/customer */
const dbStatusCache = new Map<string, { status: string; checkedAt: number }>();

/**
 * TTL for the DB status cache. Defaults to 30s (was 5 min until GAP-139).
 *
 * Rationale: this cache sits on both the hosted path and the legacy
 * self-hosted JWT path. On the legacy path, a cancelled / refunded /
 * revoked customer continues to receive Pro feature access until the TTL
 * expires. A 5-minute window is too long for STRIPE_LIVE_MODE — for a
 * paying customer this is a billing-incorrect window; for a fraudulent /
 * abuse case it's a 5-minute escape hatch.
 *
 * 30s balances revocation propagation speed against per-request DB read
 * pressure on the hosted path. Operators can override via
 * `DB_STATUS_CHECK_INTERVAL_MS` env (e.g. `=0` to disable the cache for
 * incident debugging).
 *
 * The maximum is capped at 60_000ms (60s) so that a misconfigured value
 * cannot reintroduce the 5-min regression. Values >60_000 are clamped
 * with a warning.
 *
 * Mirrors the env-override pattern in `@revealui/core/license`'s
 * LICENSE_CACHE_TTL_MS (which is a separate, JWT-license cache; this one
 * is the DB-side status cache).
 *
 * See GAP-139.
 */
const DEFAULT_DB_STATUS_CHECK_INTERVAL_MS = 30 * 1000; // 30 seconds
const MAX_DB_STATUS_CHECK_INTERVAL_MS = 60 * 1000; // 60 seconds (hard cap)

function parseDbStatusCheckIntervalEnv(raw: string | undefined): number {
  if (!raw || raw.trim() === '') return DEFAULT_DB_STATUS_CHECK_INTERVAL_MS;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return DEFAULT_DB_STATUS_CHECK_INTERVAL_MS;
  if (parsed > MAX_DB_STATUS_CHECK_INTERVAL_MS) {
    process.stderr.write(
      `DB_STATUS_CHECK_INTERVAL_MS=${parsed} exceeds the ${MAX_DB_STATUS_CHECK_INTERVAL_MS}ms cap; using ${MAX_DB_STATUS_CHECK_INTERVAL_MS}. Longer TTLs extend the post-revocation Pro-access window and are not permitted.\n`,
    );
    return MAX_DB_STATUS_CHECK_INTERVAL_MS;
  }
  return parsed;
}

const DB_STATUS_CHECK_INTERVAL = parseDbStatusCheckIntervalEnv(
  process.env.DB_STATUS_CHECK_INTERVAL_MS,
);

/** Tracks when the DB became unreachable for infra grace period calculation */
let dbUnreachableSince: number | null = null;

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

function getRequestEntitlements(c: { get: (key: string) => unknown }): RequestEntitlements | null {
  return (c.get('entitlements') as RequestEntitlements | undefined) ?? null;
}

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
          const userId = (c.get('user') as { id?: string } | undefined)?.id ?? '';
          const result = await verifyPayment(
            paymentHeader,
            resource,
            { userId, amountUsd: x402.pricePerTask },
            'license-feature',
          );
          if (result.valid) {
            await next();
            return;
          }
        }

        const resource = new URL(c.req.url).pathname;
        const paymentRequired = buildPaymentRequired(resource);
        trackX402PaymentRequired('license-feature', getAdvertisedCurrencyLabel());

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

    // No domain restrictions  -  pass through
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

    // No license  -  free tier, no DB check needed
    if (!payload) {
      await next();
      return;
    }

    const now = Date.now();
    const cached = dbStatusCache.get(payload.customerId);
    if (!cached || now - cached.checkedAt > DB_STATUS_CHECK_INTERVAL) {
      try {
        const status = await queryLicenseStatus(payload.customerId);
        dbStatusCache.set(payload.customerId, {
          status: status ?? 'active',
          checkedAt: now,
        });
        // DB reachable — clear unreachable tracker
        dbUnreachableSince = null;
      } catch {
        // DB unreachable — use cached status if available, track grace period
        if (!dbUnreachableSince) {
          dbUnreachableSince = now;
        }

        const infraGraceMs = getGraceConfig().infraDays * 86_400_000;
        const unreachableDuration = now - dbUnreachableSince;

        if (unreachableDuration > infraGraceMs) {
          // Infra grace exhausted — degrade to free tier
          dbStatusCache.delete(payload.customerId);
          c.header('X-License-Mode', 'expired');
          c.header('X-License-Reason', 'infra-unreachable-grace-exhausted');
          await next();
          return;
        }

        // Within infra grace — use last known status (or 'active' if never checked)
        if (!cached) {
          dbStatusCache.set(payload.customerId, { status: 'active', checkedAt: now });
        }
        const graceRemainingMs = infraGraceMs - unreachableDuration;
        c.header('X-License-Mode', 'grace');
        c.header('X-License-Grace-Remaining', String(Math.ceil(graceRemainingMs / 86_400_000)));
      }
    }

    const effective = dbStatusCache.get(payload.customerId);

    // Revoked — immediate fail-closed, no grace period
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

    // Surface license status in response headers for client-side banners
    const status = getLicenseStatus();
    if (status.mode === 'grace') {
      c.header('X-License-Mode', 'grace');
      if (status.graceRemainingMs) {
        c.header(
          'X-License-Grace-Remaining',
          String(Math.ceil(status.graceRemainingMs / 86_400_000)),
        );
      }
    }

    await next();
  };
};

/**
 * Require AI access  -  local inference (Ollama/Snaps) on free tier, full harness on Pro+.
 *
 * When OLLAMA_BASE_URL or INFERENCE_SNAPS_BASE_URL is set, free-tier users can use local inference.
 * Cloud-hosted open models via the RevealUI harness require a Pro+ license.
 * The route handler is responsible for enforcing local-only when the caller
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

    // Free tier: allow if local inference is configured (Ollama or Snaps)
    const hasLocalInference =
      !!process.env.OLLAMA_BASE_URL || !!process.env.INFERENCE_SNAPS_BASE_URL;
    if (hasLocalInference) {
      // Tag the request so downstream handlers know this is local-only access
      c.set('aiAccessMode', 'local');
      await next();
      return;
    }

    // No local inference, no Pro license  -  block
    const requiredTier = getRequiredTier('ai');
    const x402 = getX402Config();

    if (x402.enabled) {
      const paymentHeader = c.req.header('x-payment-payload');
      if (paymentHeader) {
        const resource = new URL(c.req.url).pathname;
        const userId = (c.get('user') as { id?: string } | undefined)?.id ?? '';
        const result = await verifyPayment(
          paymentHeader,
          resource,
          { userId, amountUsd: x402.pricePerTask },
          'license-ai',
        );
        if (result.valid) {
          await next();
          return;
        }
      }

      const resource = new URL(c.req.url).pathname;
      const paymentRequired = buildPaymentRequired(resource);
      trackX402PaymentRequired('license-ai', getAdvertisedCurrencyLabel());

      return c.json(
        {
          success: false as const,
          error: `AI requires a ${requiredTier} license or local inference (OLLAMA_BASE_URL or INFERENCE_SNAPS_BASE_URL). Current tier: ${currentTier}.`,
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
        error: `AI requires a ${requiredTier} license or local inference (set OLLAMA_BASE_URL or INFERENCE_SNAPS_BASE_URL). Current tier: ${currentTier}. Upgrade at ${PRICING_URL}`,
        code: 'HTTP_403',
      },
      403,
    );
  };
};

/** Cache for perpetual support expiry checks, keyed by customer ID */
const supportExpiryCache = new Map<
  string,
  { supportExpiresAt: Date | null; perpetual: boolean; checkedAt: number }
>();

/**
 * Enforce support contract expiry on perpetual licenses.
 *
 * Perpetual licenses never expire  -  the holder keeps basic admin access forever.
 * However, the annual support contract (supportExpiresAt) gates premium features:
 * AI, dashboard, advanced sync, analytics, etc.
 *
 * When support is expired, this middleware:
 * 1. Downgrades the request entitlements to free tier (keeps basic admin)
 * 2. Sets an `X-Support-Expires` response header so clients can prompt for renewal
 *
 * When support is active, this middleware:
 * 1. Sets the `X-Support-Expires` header for proactive client-side renewal prompts
 *
 * @param querySupportExpiry - Function that queries the DB for perpetual support info.
 *   Injected to avoid coupling middleware to DB schema imports.
 */
export const checkSupportExpiry = (
  querySupportExpiry: (
    customerId: string,
  ) => Promise<{ supportExpiresAt: Date | null; perpetual: boolean }>,
): MiddlewareHandler => {
  return async (c, next) => {
    const payload = getLicensePayload();

    // Only applies to perpetual licenses identified by the JWT
    if (!payload?.perpetual) {
      await next();
      return;
    }

    const now = Date.now();
    const cached = supportExpiryCache.get(payload.customerId);

    if (!cached || now - cached.checkedAt > DB_STATUS_CHECK_INTERVAL) {
      const info = await querySupportExpiry(payload.customerId);
      supportExpiryCache.set(payload.customerId, {
        supportExpiresAt: info.supportExpiresAt,
        perpetual: info.perpetual,
        checkedAt: now,
      });
    }

    const effective = supportExpiryCache.get(payload.customerId);

    // Not a perpetual license in the DB (should not happen if JWT has perpetual=true, but be safe)
    if (!effective?.perpetual) {
      await next();
      return;
    }

    // Set the support expiry header so clients can show renewal prompts
    if (effective.supportExpiresAt) {
      c.header('X-Support-Expires', effective.supportExpiresAt.toISOString());
    }

    // Check if support has expired
    if (effective.supportExpiresAt && effective.supportExpiresAt.getTime() < now) {
      const perpetualGraceMs = getGraceConfig().perpetualDays * 86_400_000;
      const timeSinceExpiry = now - effective.supportExpiresAt.getTime();

      if (timeSinceExpiry <= perpetualGraceMs) {
        // Within 30-day grace — keep full access, warn via headers
        const graceRemainingDays = Math.ceil((perpetualGraceMs - timeSinceExpiry) / 86_400_000);
        c.header('X-Support-Status', 'grace');
        c.header('X-Support-Grace-Remaining', String(graceRemainingDays));
      } else {
        // Grace exhausted — read-only mode.
        // The perpetual license keeps basic admin read access,
        // but writes and premium features are blocked.
        const requestEntitlements = getRequestEntitlements(c);
        if (requestEntitlements) {
          c.set('entitlements', {
            ...requestEntitlements,
            tier: 'free' as const,
            features: {},
            subscriptionStatus: 'support_expired',
          });
        }

        c.header('X-Support-Status', 'expired');
        c.header('X-License-Mode', 'read-only');
      }
    }

    await next();
  };
};

/**
 * Reset the DB status cache. Primarily for testing.
 */
export function resetDbStatusCache(): void {
  dbStatusCache.clear();
}

/**
 * Reset the support expiry cache. Primarily for testing.
 */
export function resetSupportExpiryCache(): void {
  supportExpiryCache.clear();
}

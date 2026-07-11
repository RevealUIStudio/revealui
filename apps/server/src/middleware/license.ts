/**
 * License Enforcement Middleware for Hono API
 *
 * Gates routes by license tier or feature flag.
 * Uses the cached license state from @revealui/core  -  no DB call per request.
 */

import {
  type FeatureFlags,
  getFeaturesForTier,
  getRequiredTier,
  isFeatureEnabled,
} from '@revealui/core/features';
import {
  getCurrentTier,
  getGraceConfig,
  getLicensePayload,
  getLicenseStatus,
  hostMatchesLicensedDomains,
  type LicenseTier,
} from '@revealui/core/license';
import { logger } from '@revealui/core/observability/logger';
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
  graceUntil?: Date | null;
  tier?: LicenseTier;
  features?: Partial<Record<keyof FeatureFlags, boolean>>;
  /**
   * True when the license is in read-only mode (perpetual support lapsed past
   * grace): the purchased tier + features are retained for reads, but writes
   * are blocked by {@link enforceReadOnlyWrites}. GAP-310.
   */
  readOnly?: boolean;
};

// ---------------------------------------------------------------------------
// Read-only enforcement for lapsed perpetual support (GAP-310)
// ---------------------------------------------------------------------------

/**
 * Read-only enforcement mode, from `LICENSE_READ_ONLY_ENFORCE`:
 *   - `off` (default): inert — the historical free-tier downgrade is preserved
 *     and nothing is blocked. Behavior is byte-identical to pre-GAP-310.
 *   - `shadow`: the tier stays downgraded (no loosening) and the write-gate LOGS
 *     what it would block without blocking — used to confirm the exempt set is
 *     complete before enforcing.
 *   - `enforce`: the purchased tier is retained for reads AND writes are blocked.
 *     Both halves land together (the gap invariant: restoring the tier without
 *     the write-block would be a strict loosening).
 */
export type ReadOnlyMode = 'off' | 'shadow' | 'enforce';

/** Context key carrying the read-only signal from checkSupportExpiry to the gate. */
type ReadOnlyPending = { tier: LicenseTier; mode: ReadOnlyMode };

function getReadOnlyEnforcementMode(): ReadOnlyMode {
  const value = process.env.LICENSE_READ_ONLY_ENFORCE;
  if (value === 'enforce') return 'enforce';
  if (value === 'shadow') return 'shadow';
  return 'off';
}

/**
 * Paths always allowed even for a read-only (lapsed-support) license, matched by
 * prefix (zero authored regex per the fleet no-regex rule). This is the
 * load-bearing safety surface of the gate: a miss either locks the customer out
 * (can't renew or sign in) or leaks a write, so entries err toward the clearly
 * safe read/escape routes.
 */
const READ_ONLY_EXEMPT: readonly string[] = [
  // The renewal escape hatch — a lapsed customer MUST be able to buy back support.
  '/api/billing/checkout-support-renewal',
  '/api/v1/billing/checkout-support-renewal',
  // Auth / session — must be able to sign in to reach anything at all.
  '/api/auth/',
  '/api/v1/auth/',
  '/api/studio-auth/',
  '/api/v1/studio-auth/',
  '/api/terminal-auth/',
  '/api/v1/terminal-auth/',
  // License verify/features are reads despite arriving as POST; machines re-check.
  '/api/license/verify',
  '/api/v1/license/verify',
  '/api/license/features',
  '/api/v1/license/features',
  // Machine webhooks (Stripe etc.). Renewal settles here — never block a machine write.
  '/api/webhooks/',
  '/api/v1/webhooks/',
  // Safe diagnostics.
  '/api/pricing',
  '/api/v1/pricing',
  '/health',
];

/**
 * Explicit read/write overrides for the few routes the HTTP-method baseline gets
 * wrong (reads-over-POST, GETs with side effects, `/a2a` semantics). Keyed by
 * path prefix, first match wins, and evaluated BEFORE the method baseline so an
 * override can actually override it. Starts empty on purpose — shadow-mode
 * logging surfaces real misclassifications, which then earn an explicit entry
 * (the design's "grows only when a real false-classification is found").
 */
const READ_ONLY_OVERRIDES: ReadonlyArray<{ prefix: string; kind: 'read' | 'write' }> = [];

const WRITE_METHODS: ReadonlySet<string> = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function isReadOnlyExempt(path: string): boolean {
  for (const prefix of READ_ONLY_EXEMPT) {
    if (path === prefix || path.startsWith(prefix)) return true;
  }
  return false;
}

/**
 * Classify a request as `read` or `write` for read-only enforcement.
 * Order: explicit override → HTTP-method baseline. (Exempt paths are handled by
 * the caller before this runs.) The override precedes the method baseline so it
 * can correct method-baseline mistakes; `/a2a` task dispatch is a POST (already a
 * write) and result polling is a GET (already a read), so the baseline covers
 * both until a real exception is observed.
 */
function classifyReadOnlyRequest(method: string, path: string): 'read' | 'write' {
  for (const override of READ_ONLY_OVERRIDES) {
    if (path === override.prefix || path.startsWith(override.prefix)) return override.kind;
  }
  return WRITE_METHODS.has(method.toUpperCase()) ? 'write' : 'read';
}

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
          const result = await verifyPayment(paymentHeader, resource, 'license-feature');
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
 * Reject any request whose Host is not covered by the license's `domains`
 * claim. No-op when the license carries no domain restrictions (free tier or
 * unrestricted kits). Subdomain matching + the localhost allowance live in the
 * shared `hostMatchesLicensedDomains` matcher in `@revealui/core`.
 *
 * The allowed domains come from the verified JWT payload (`getLicensePayload`),
 * so the lock is cryptographically bound — it cannot be spoofed via an env var.
 * This is the single request-time domain-lock for RevForge/Fleet; it replaced
 * the env-var-driven `domainLockMiddleware` (deleted) and the duplicated inline
 * check in `apps/admin/src/proxy.ts`.
 */
export const requireDomain = (): MiddlewareHandler => {
  return async (c, next) => {
    const payload = getLicensePayload();

    // No domain restrictions  -  pass through
    if (!payload?.domains || payload.domains.length === 0) {
      await next();
      return;
    }

    // Bind to the served Host (always present), not Origin/Referer — this is a
    // deployment domain-lock, not a CORS check. localhost/127.0.0.1 are allowed
    // by the shared matcher so trial kits on http://localhost still serve.
    const host = c.req.header('host') ?? '';
    if (!hostMatchesLicensedDomains(host, payload.domains)) {
      throw new HTTPException(403, {
        message: `This RevealUI instance is not licensed for host '${host || '(none)'}'. Licensed domains: ${payload.domains.join(', ')}`,
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
      const status = requestEntitlements.subscriptionStatus;
      if (status === 'revoked') {
        throw new HTTPException(403, {
          message: `Your subscription has been revoked. Contact ${SUPPORT_EMAIL}`,
        });
      }

      if (status === 'expired') {
        throw new HTTPException(403, {
          message: `Your subscription has expired. Renew at ${PRICING_URL}`,
        });
      }

      // Enforce past_due at request time, not solely via the sweep-grace-periods
      // cron: once graceUntil has elapsed, deny regardless of whether the cron has
      // flipped the row to 'expired' yet. This mirrors the cron's exact transition
      // (status 'past_due' AND graceUntil <= now) so a paused/undeployed/mis-secreted
      // cron cannot leave a delinquent account on Pro indefinitely. A past_due row
      // with a null or future graceUntil is left to the grace window / the
      // entitlement-tier downgrade in entitlementMiddleware.
      if (status === 'past_due') {
        const graceUntil = requestEntitlements.graceUntil;
        const graceElapsed = graceUntil != null && graceUntil.getTime() <= Date.now();
        if (graceElapsed) {
          throw new HTTPException(403, {
            message: `Your subscription is past due and the grace period has ended. Renew at ${PRICING_URL}`,
          });
        }
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
        const result = await verifyPayment(paymentHeader, resource, 'license-ai');
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
        // Grace exhausted — read-only mode (GAP-310). In `enforce`, retain the
        // purchased tier for reads and mark `readOnly` so the write-gate blocks
        // writes (both halves land together). In `off`/`shadow`, preserve the
        // historical free-tier downgrade so nothing loosens before enforcement.
        const mode = getReadOnlyEnforcementMode();
        const requestEntitlements = getRequestEntitlements(c);
        if (requestEntitlements) {
          if (mode === 'enforce') {
            c.set('entitlements', {
              ...requestEntitlements,
              tier: payload.tier,
              features: getFeaturesForTier(payload.tier),
              subscriptionStatus: 'support_expired',
              readOnly: true,
            });
          } else {
            c.set('entitlements', {
              ...requestEntitlements,
              tier: 'free' as const,
              features: {},
              subscriptionStatus: 'support_expired',
            });
          }
        }

        // Hand the write-gate its signal. Skipped in `off` so that mode stays a
        // true no-op; set in `shadow` so the gate can log would-be blocks.
        if (mode !== 'off') {
          c.set('readOnlyPending', { tier: payload.tier, mode } satisfies ReadOnlyPending);
        }

        c.header('X-Support-Status', 'expired');
        c.header('X-License-Mode', 'read-only');
      }
    }

    await next();
  };
};

/**
 * Write-gate for lapsed-perpetual-support (read-only) licenses — GAP-310.
 *
 * Consumes the `readOnlyPending` signal set by {@link checkSupportExpiry}. Mount
 * AFTER checkSupportExpiry (which sets the signal) and BEFORE the feature gates
 * and route handlers, on the same path prefixes checkSupportExpiry covers.
 *
 * Behavior by mode (see {@link ReadOnlyMode}):
 *   - `off`: no signal is set, so this is a pass-through.
 *   - `shadow`: logs what it WOULD block; blocks nothing.
 *   - `enforce`: blocks non-exempt writes with 403; reads and exempt writes pass.
 *
 * The tier-restore half lives in checkSupportExpiry and is gated on the SAME
 * mode, so the tier is only restored when writes are actually blocked (both
 * halves together — the gap invariant).
 */
export const enforceReadOnlyWrites = (): MiddlewareHandler => {
  return async (c, next) => {
    const pending = c.get('readOnlyPending') as ReadOnlyPending | undefined;
    if (!pending || pending.mode === 'off') {
      await next();
      return;
    }

    const path = c.req.path;
    const method = c.req.method;

    // Reads and exempt routes always pass, in every mode.
    if (isReadOnlyExempt(path) || classifyReadOnlyRequest(method, path) === 'read') {
      await next();
      return;
    }

    // A write on a non-exempt route by a read-only (lapsed-support) license.
    if (pending.mode === 'shadow') {
      logger.info('license.read-only would block write (shadow mode)', {
        path,
        method,
        tier: pending.tier,
      });
      await next();
      return;
    }

    // enforce: block the write with an actionable, honest message.
    c.header('X-License-Mode', 'read-only');
    c.header('X-Support-Status', 'expired');
    return c.json(
      {
        error: 'support_expired_read_only',
        message:
          'Your license is active and your tier is retained for reads, but support has lapsed so writes are blocked. Renew support to restore write access.',
        renewUrl: PRICING_URL,
        supportEmail: SUPPORT_EMAIL,
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

/**
 * Reset the support expiry cache. Primarily for testing.
 */
export function resetSupportExpiryCache(): void {
  supportExpiryCache.clear();
}

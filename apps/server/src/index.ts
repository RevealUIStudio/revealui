import * as Sentry from '@sentry/node';

// Initialize Sentry before all other imports for proper instrumentation
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV ?? 'production',
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    beforeSend(event) {
      // Don't send events in non-production environments
      if (process.env.NODE_ENV !== 'production') return null;
      // Strip sensitive headers
      if (event.request?.headers) {
        const { cookie: _, authorization: __, ...safe } = event.request.headers;
        event.request.headers = safe;
      }
      return event;
    },
  });
}

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { getHeapStatistics } from 'node:v8';
import { serve } from '@hono/node-server';
import { initializeLicense } from '@revealui/core/license';
import {
  alerting,
  consoleChannel,
  createDatabaseAlert,
  createMemoryUsageAlert,
} from '@revealui/core/observability/alerts';
import { logger } from '@revealui/core/observability/logger';
import { audit, SecurityHeaders, SecurityPresets } from '@revealui/core/security';
import { closeAllPools, getClient } from '@revealui/db';
import { createDbLogHandler } from '@revealui/db/log-transport';
import { sites, users } from '@revealui/db/schema';
import { OpenAPIHono } from '@revealui/openapi';
import { configureClientIp } from '@revealui/security';
import { sql } from 'drizzle-orm';
import { createMiddleware } from 'hono/factory';
import { logger as honoLogger } from 'hono/logger';
// Side-effect import: registers durable-queue handlers at module top
// level so both the producer (POST /api/agent-tasks) and the worker
// (POST /api/jobs/run) invocations see the same registry. See
// CR8-P2-01 phase C.
import { assertDispatchFlagConfigured } from './jobs/register-handlers.js';
import {
  assertAuditStorageEnv,
  auditStorageSelfTest,
  installAuditStorage,
} from './lib/audit-storage.js';
import { queryBillingStatusByCustomerId, querySupportExpiry } from './lib/billing-status.js';
import { createLazyHonoRoute } from './lib/lazy-hono-route.js';
import { runHostedLicenseCanary } from './lib/license-canary.js';
import { wireMcpHypervisorIfEnabled } from './lib/mcp-hypervisor-wire.js';
import { resolveSelfApiBaseUrl } from './lib/self-api-url.js';
import {
  validateBillingCatalogAtStartup,
  validateLicenseAtStartup,
  validateStartup,
  validateStripeTaxConfigAtStartup,
} from './lib/validate-startup.js';
import { auditMiddleware } from './middleware/audit.js';
import { authMiddleware, requireRole } from './middleware/auth.js';
import { requirePermission } from './middleware/authorization.js';
import { bodyLimitGate } from './middleware/body-limits.js';
import {
  noCacheCacheMiddleware,
  noStoreCacheMiddleware,
  publicCacheMiddleware,
} from './middleware/cache-control.js';
import { csrfMiddleware } from './middleware/csrf.js';
import { dbMiddleware } from './middleware/db.js';
import { entitlementMiddleware } from './middleware/entitlements.js';
import { errorHandler } from './middleware/error.js';
import {
  checkLicenseStatus,
  checkSupportExpiry,
  enforceReadOnlyWrites,
  requireAIAccess,
  requireDomain,
  requireFeature,
} from './middleware/license.js';
import { rateLimitMiddleware, tieredRateLimitMiddleware } from './middleware/rate-limit.js';
import { requestIdMiddleware } from './middleware/request-id.js';
import { enforceSiteLimit, enforceUserLimit } from './middleware/resource-limits.js';
import { requireTaskQuota } from './middleware/task-quota.js';
import { createTenantMembershipValidator, tenantMiddleware } from './middleware/tenant.js';
import { a2aRoutes, wellKnownRoutes } from './routes/a2a.js';
import adminCoordinationRoute from './routes/admin/coordination.js';
import adminInferenceConfigRoute from './routes/admin/inference-config.js';
import adminLocalAiStatusRoute from './routes/admin/local-ai-status.js';
import adminObservabilityRoute from './routes/admin/observability.js';
import admissionWaitlistRoute from './routes/admission/waitlist.js';
import { createAgentCollabRoute } from './routes/agent-collab.js';
import agentStreamRoute from './routes/agent-stream.js';
import agentStreamElicitRoute from './routes/agent-stream-elicit.js';
import agentTasksRoute from './routes/agent-tasks.js';
import analyticsRoute from './routes/analytics.js';
import apiKeysRoute from './routes/api-keys.js';
import auditRoute from './routes/audit.js';
import authRoute from './routes/auth.js';
import authSsoRoute from './routes/auth-sso.js';
import billingRoute from './routes/billing.js';
import provenanceRoute from './routes/code-provenance.js';
import { createCollabRoute } from './routes/collab.js';
import contactRoute from './routes/contact.js';
import contentRoute from './routes/content/index.js';
import cronBillingReadinessRoute from './routes/cron/billing-readiness.js';
import cronCleanupRoute from './routes/cron/cleanup.js';
import cronDispatchRoute from './routes/cron/dispatch.js';
import cronDrainUnreconciledRoute from './routes/cron/drain-unreconciled.js';
import cronJobsSafetyNetRoute from './routes/cron/jobs-safety-net.js';
import cronLifecycleEmailsRoute from './routes/cron/lifecycle-emails.js';
import cronMarginSnapshotRoute from './routes/cron/margin-snapshot.js';
import cronMarketplacePayoutsRoute from './routes/cron/marketplace-payouts.js';
import cronPublishRoute from './routes/cron/publish-scheduled.js';
import cronReconcileCustomersRoute from './routes/cron/reconcile-customers.js';
import cronReconcileStripeSubscriptionsRoute from './routes/cron/reconcile-stripe-subscriptions.js';
import cronReconcileSubscriptionsRoute from './routes/cron/reconcile-subscriptions.js';
import cronSweepGraceRoute from './routes/cron/sweep-grace-periods.js';
import cronWorkerLivenessRoute from './routes/cron/worker-liveness.js';
import devkitRoute from './routes/devkit.js';
import errorsRoute from './routes/errors.js';
import gdprRoute from './routes/gdpr.js';
import ghcrRoute from './routes/ghcr.js';
import { mountHarnessReceipts } from './routes/harness-receipts.js';
import healthRoute from './routes/health.js';
import jobsRoute from './routes/jobs/index.js';
import kitsRoute from './routes/kits.js';
import licenseRoute from './routes/license.js';
import logsRoute from './routes/logs.js';
import maintenanceRoute from './routes/maintenance.js';
import marketplaceRoute from './routes/marketplace.js';
import { mountMcpEndpoint } from './routes/mcp-endpoint.js';
import mcpUsageRoute from './routes/mcp-usage.js';
import nudgesRoute from './routes/nudges.js';
import pricingRoute from './routes/pricing.js';
import ragIndexRoute from './routes/rag-index.js';
import revmarketRoute from './routes/revmarket.js';
import rotationRoute from './routes/rotation.js';
import ssoProvidersRoute from './routes/sso-providers.js';
import studioAuthRoute from './routes/studio-auth.js';
import terminalAuthRoute from './routes/terminal-auth.js';
import { createTerminalRoute } from './routes/terminal-ws.js';
import ticketsRoute from './routes/tickets/index.js';
import waitlistRoute from './routes/waitlist.js';
import webhooksRoute from './routes/webhooks.js';

// Ship warn+ logs to NeonDB in production
if (process.env.NODE_ENV === 'production') {
  logger.addLogHandler(createDbLogHandler('api'));
}

// Signal handlers and fatal-error catchers are only meaningful when the
// server is the live process entry point.  In the test suite (VITEST=true)
// the module is imported repeatedly via vi.resetModules(); registering
// listeners on every import causes MaxListenersExceededWarning and keeps
// the Node process alive after the suite finishes.
if (!process.env.VITEST) {
  // Catch fatal errors that escape all middleware
  process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught exception  -  process will exit', error);
    setTimeout(() => process.exit(1), 1000);
  });

  process.on('unhandledRejection', (reason: unknown) => {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    logger.error('Unhandled promise rejection', error);
  });

  // Graceful shutdown  -  close database connection pools and stop background tasks
  const gracefulShutdown = async (signal: string): Promise<void> => {
    logger.info(`${signal} received — shutting down`);

    // Stop alerting monitor
    if (monitoringInterval) {
      clearInterval(monitoringInterval);
    }

    // Close database pools
    try {
      await closeAllPools();
      logger.info('Database pools closed');
    } catch (err) {
      logger.error(
        'Error closing database pools',
        err instanceof Error ? err : new Error(String(err)),
      );
    }
    process.exit(0);
  };

  process.once('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.once('SIGINT', () => gracefulShutdown('SIGINT'));
}

// Validate durable-dispatch flag config (CR8-P2-01 phase C) — if the
// flag is on, the wake secret must be set, or every dispatch silently
// falls back to the daily cron cadence.
assertDispatchFlagConfigured();

/**
 * Parse and validate CORS origins from environment variable.
 * Throws an error in production if CORS_ORIGIN is not properly configured.
 *
 * @returns Array of allowed CORS origins
 * @throws {Error} If CORS_ORIGIN is not set or empty in production
 */
import { hydrateInferenceConfigs } from './lib/hydrate-inference-configs.js';
import { setCorsConfigMissing } from './lib/startup-state.js';

/** Known production origins  -  hardcoded fallback if CORS_ORIGIN env var is missing or unreadable */
const PRODUCTION_ORIGINS = [
  'https://admin.revealui.com',
  'https://revealui.com',
  'https://www.revealui.com',
  'https://marketing.revealui.com',
];

export function getCorsOrigins(): string[] {
  const isProduction = process.env.NODE_ENV?.trim() === 'production';

  if (!isProduction) {
    return [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3005',
      'http://localhost:4000',
      'http://localhost:5173',
    ];
  }

  const envOrigins = process.env.CORS_ORIGIN?.split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  if (envOrigins && envOrigins.length > 0) {
    return envOrigins;
  }

  // Hard-fail in production: CORS_ORIGIN must be explicitly configured.
  // Falling back to hardcoded origins risks accepting unintended cross-origin
  // requests if the env var is misconfigured. Fail loudly instead.
  const message =
    'CORS_ORIGIN env var missing or empty in production  -  refusing to start with implicit origins. ' +
    'Set CORS_ORIGIN to a comma-separated list of allowed origins.';
  logger.error(message, undefined, {
    nodeEnv: process.env.NODE_ENV,
    rawValue: process.env.CORS_ORIGIN ?? '(undefined)',
  });
  setCorsConfigMissing(true);

  // In serverless environments (Vercel), process.exit is unreliable  -
  // log the error and fall back to the known production origins so the
  // deployment isn't bricked, but surface the misconfiguration loudly.
  if (process.env.VERCEL) {
    return PRODUCTION_ORIGINS;
  }

  // In long-running server mode, exit hard.
  throw new Error(message);
}

const app = new OpenAPIHono();
const corsOrigins = getCorsOrigins();
logger.info('CORS origins loaded', { origins: corsOrigins, count: corsOrigins.length });

// Security headers (environment-appropriate preset)
// Vercel Live (preview/prod Toolbar) needs vercel.live in CSP for feedback widget.
const strict = SecurityPresets.strict();
const strictCsp = strict.contentSecurityPolicy;
const strictWithVercelLive =
  strictCsp && typeof strictCsp === 'object'
    ? {
        ...strict,
        contentSecurityPolicy: {
          ...strictCsp,
          scriptSrc: [...(strictCsp.scriptSrc ?? []), 'https://vercel.live'],
          styleSrc: [...(strictCsp.styleSrc ?? []), 'https://vercel.live'],
          imgSrc: [...(strictCsp.imgSrc ?? []), 'https://vercel.live'],
          connectSrc: [...(strictCsp.connectSrc ?? []), 'https://vercel.live', 'wss://vercel.live'],
          frameSrc: ['https://vercel.live'],
        },
      }
    : strict;
const securityPreset =
  process.env.NODE_ENV?.trim() === 'production'
    ? strictWithVercelLive
    : SecurityPresets.development();
const securityHeaders = new SecurityHeaders(securityPreset);

// Global middleware
// License domain-lock: reject any request whose Host isn't covered by the
// license's signed JWT `domains` claim. No-op when the license carries no
// domains claim (free tier / unrestricted kits). Cryptographically bound —
// the allowed domains come from the verified JWT, not a spoofable env var.
app.use('*', requireDomain());
app.use('*', requestIdMiddleware());
// Body-size gate: media uploads (POST) get the per-type image ceiling (10MB);
// every other route gets 1MB. A single path-aware middleware avoids the prior
// bug where a global '*' 1MB limit registered after the media-specific limit ran
// second in Hono's chain and rejected all media uploads >1MB (the 100MB media
// limit was dead code). See ./middleware/body-limits.ts.
app.use('*', bodyLimitGate());
app.use('*', honoLogger());
/** Check if origin matches Vercel preview URL pattern: https://revealui*-revealuistudios-projects.vercel.app */
function isVercelPreviewOrigin(origin: string): boolean {
  if (!origin.startsWith('https://revealui')) return false;
  return origin.endsWith('-revealuistudios-projects.vercel.app');
}

/**
 * Check if origin is a trusted desktop-app client (RevealUI Studio).
 *
 * Tauri 2 webviews issue requests from one of three origins depending on
 * platform and scheme registration:
 *   - `tauri://localhost`        — Linux + macOS (custom scheme)
 *   - `https://tauri.localhost`  — Windows when HTTPS asset protocol enabled
 *   - `http://tauri.localhost`   — Windows WebView2 default (HTTP asset protocol)
 *
 * The third was missing originally (2026-05-10 discovery via Windows Studio
 * dogfood — CORS preflight returned no Allow-Origin → `TypeError: Failed to
 * fetch` for every request). The Studio app ships signed binaries and talks
 * to the public API on behalf of authenticated users, so its origin is
 * allow-listed here rather than via CORS_ORIGIN env (which is reserved for
 * HTTPS web clients).
 */
function isDesktopClientOrigin(origin: string): boolean {
  return (
    origin === 'tauri://localhost' ||
    origin === 'https://tauri.localhost' ||
    origin === 'http://tauri.localhost'
  );
}

/** Check if origin matches test/dev subdomain: https://(dev|test).(admin.|api.|docs.)?revealui.com */
function isTestSubdomainOrigin(origin: string): boolean {
  if (!origin.startsWith('https://')) return false;
  const host = origin.slice(8); // strip https://
  const validSuffixes = [
    'revealui.com',
    'admin.revealui.com',
    'api.revealui.com',
    'docs.revealui.com',
  ];
  return validSuffixes.some((suffix) => host === `dev.${suffix}` || host === `test.${suffix}`);
}

// Public GET endpoints that are CDN-cacheable (Cache-Control: public, s-maxage)
// and carry NO credentials. They receive wildcard CORS so a single cached
// variant is safe for every origin. Exact-match set — no regex, no prefix
// surprises. Add a path here only if it is genuinely public, credential-free,
// and cacheable.
const PUBLIC_CACHEABLE_CORS_PATHS = new Set([
  '/api/pricing',
  // GAP-355 Stage 3: the audit-log public key is published for offline receipt
  // verification — genuinely public, credential-free, cacheable.
  '/api/audit/public-key',
  '/api/v1/audit/public-key',
]);
export function isPublicCacheableCorsPath(path: string): boolean {
  return PUBLIC_CACHEABLE_CORS_PATHS.has(path);
}

// Manual CORS middleware  -  Hono's cors() middleware was not reliably setting
// Access-Control-Allow-Origin headers in the Vercel serverless runtime.
app.use('*', async (c, next) => {
  const origin = c.req.header('origin') || c.req.header('Origin') || '';

  // Wildcard CORS for public, cacheable, credential-free endpoints. Coupling
  // public CDN caching with per-origin CREDENTIALED CORS is a footgun: the CDN
  // stores one variant (keyed by `Vary: Origin`, or none when a request arrives
  // without an Origin — e.g. an SSR fetch/prefetch), and that variant can then
  // be served to a browser whose origin doesn't match, surfacing as
  // "No 'Access-Control-Allow-Origin' header is present" in the browser. These
  // routes need no credentials, so one '*' variant is correct and cache-safe.
  if (isPublicCacheableCorsPath(c.req.path)) {
    c.header('Access-Control-Allow-Origin', '*');
    if (c.req.method === 'OPTIONS') {
      c.header('Access-Control-Allow-Methods', 'GET,HEAD,OPTIONS');
      c.header(
        'Access-Control-Allow-Headers',
        c.req.header('Access-Control-Request-Headers') || 'Content-Type',
      );
      c.header('Access-Control-Max-Age', '86400');
      return c.body(null, 204);
    }
    await next();
    return;
  }

  // Preview CORS: allow project-scoped Vercel preview URLs and test subdomains.
  // Pattern: revealui-<app>-<hash>-revealuistudios-projects.vercel.app
  const isPreviewAllowed =
    process.env.VERCEL_ENV === 'preview' &&
    (isVercelPreviewOrigin(origin) || isTestSubdomainOrigin(origin));

  const isAllowed =
    corsOrigins.includes(origin) || isPreviewAllowed || isDesktopClientOrigin(origin);

  if (isAllowed) {
    c.header('Access-Control-Allow-Origin', origin);
    c.header('Access-Control-Allow-Credentials', 'true');
    c.header('Vary', 'Origin');
  } else if (origin) {
    // Still set Vary so CDN doesn't serve wrong cache
    c.header('Vary', 'Origin');
  }

  // Handle preflight
  if (c.req.method === 'OPTIONS') {
    if (isAllowed) {
      c.header('Access-Control-Allow-Methods', 'GET,HEAD,PUT,POST,DELETE,PATCH');
      c.header(
        'Access-Control-Allow-Headers',
        c.req.header('Access-Control-Request-Headers') || 'Content-Type,Authorization',
      );
      c.header('Access-Control-Max-Age', '86400');
    }
    return c.body(null, 204);
  }

  await next();
});
// Apply security headers (CSP, HSTS, X-Frame-Options, etc.) to all responses
app.use('*', async (c, next) => {
  await next();
  const headers = securityHeaders.getHeaders();
  for (const [key, value] of Object.entries(headers)) {
    c.header(key, value);
  }
});
app.use('*', dbMiddleware());
// Audit logging  -  fire-and-forget, never crashes the request
app.use('/api/*', auditMiddleware(audit));
app.use('/api/v1/*', auditMiddleware(audit));

// ---------------------------------------------------------------------------
// Content cache strategy A (1s freshness)  -  published-content GET reads carry
// a 1-second shared-CDN cache with a small stale-while-revalidate window. With
// s-maxage=1 an edit-session publish is visible within ~1s without an active
// cache purge. Edit-session routes are NOT cached here (they expose auth'd
// drafts)  -  they get no-store below.
// ---------------------------------------------------------------------------
const publishedContentCache = publicCacheMiddleware({ sMaxAge: 1, staleWhileRevalidate: 5 });
app.use('/api/content/pages/*', publishedContentCache);
app.use('/api/v1/content/pages/*', publishedContentCache);
app.use('/api/content/globals/*', publishedContentCache);
app.use('/api/v1/content/globals/*', publishedContentCache);
app.use('/api/content/posts/*', publishedContentCache);
app.use('/api/v1/content/posts/*', publishedContentCache);

// Edit-session routes expose draft content  -  never cache them.
app.use('/api/content/sessions', noStoreCacheMiddleware());
app.use('/api/v1/content/sessions', noStoreCacheMiddleware());
app.use('/api/content/sessions/*', noStoreCacheMiddleware());
app.use('/api/v1/content/sessions/*', noStoreCacheMiddleware());

// ---------------------------------------------------------------------------
// Rate limit configuration  -  all tunables in one place
// Override per-route limits via configureRateLimits() in tests or deployment
// ---------------------------------------------------------------------------

const ONE_MINUTE = 60_000;
const FIFTEEN_MINUTES = 15 * ONE_MINUTE;
const ONE_HOUR = 60 * ONE_MINUTE;

interface RateLimitEntry {
  maxRequests: number;
  windowMs: number;
}

interface RateLimitsConfig {
  /** Global tiered limits (per license tier) */
  tiers: {
    free: RateLimitEntry;
    pro: RateLimitEntry;
    max: RateLimitEntry;
    enterprise: RateLimitEntry;
  };
  /** Per-route limits */
  routes: Record<string, RateLimitEntry>;
}

const DEFAULT_RATE_LIMITS: RateLimitsConfig = {
  tiers: {
    free: { maxRequests: 200, windowMs: ONE_MINUTE },
    pro: { maxRequests: 300, windowMs: ONE_MINUTE },
    max: { maxRequests: 600, windowMs: ONE_MINUTE },
    enterprise: { maxRequests: 1000, windowMs: ONE_MINUTE },
  },
  routes: {
    'license-gen': { maxRequests: 5, windowMs: FIFTEEN_MINUTES },
    'a2a-discovery': { maxRequests: 60, windowMs: ONE_MINUTE },
    agent: { maxRequests: 10, windowMs: ONE_MINUTE },
    'agent-stream': { maxRequests: 10, windowMs: ONE_MINUTE },
    rag: { maxRequests: 20, windowMs: ONE_MINUTE },
    'error-capture': { maxRequests: 50, windowMs: ONE_MINUTE },
    'log-ingest': { maxRequests: 200, windowMs: ONE_MINUTE },
    'api-keys': { maxRequests: 20, windowMs: ONE_MINUTE },
    'auth-signup': { maxRequests: 5, windowMs: FIFTEEN_MINUTES },
    /** GAP-256 admission waitlist status + claim (not marketing waitlist) */
    'admission-waitlist': { maxRequests: 5, windowMs: FIFTEEN_MINUTES },
    /** Enterprise SSO OIDC init/callback (GAP-464) — aligned with sign-in abuse budget */
    'auth-sso': { maxRequests: 20, windowMs: FIFTEEN_MINUTES },
    /** Enterprise SSO provider admin CRUD + test-connection (GAP-464) */
    'sso-providers': { maxRequests: 30, windowMs: ONE_MINUTE },
    'billing-checkout': { maxRequests: 10, windowMs: FIFTEEN_MINUTES },
    'billing-upgrade': { maxRequests: 5, windowMs: FIFTEEN_MINUTES },
    'billing-downgrade': { maxRequests: 5, windowMs: FIFTEEN_MINUTES },
    'billing-checkout-perpetual': { maxRequests: 5, windowMs: ONE_MINUTE },
    'billing-portal': { maxRequests: 10, windowMs: ONE_MINUTE },
    'billing-refund': { maxRequests: 3, windowMs: ONE_MINUTE },
    'billing-checkout-credits': { maxRequests: 5, windowMs: ONE_MINUTE },
    'billing-checkout-support-renewal': { maxRequests: 5, windowMs: ONE_MINUTE },
    'billing-subscription': { maxRequests: 30, windowMs: ONE_MINUTE },
    'billing-usage': { maxRequests: 30, windowMs: ONE_MINUTE },
    'billing-credits': { maxRequests: 30, windowMs: ONE_MINUTE },
    'billing-invoices': { maxRequests: 20, windowMs: ONE_MINUTE },
    'billing-pause': { maxRequests: 5, windowMs: ONE_MINUTE },
    'billing-resume': { maxRequests: 5, windowMs: ONE_MINUTE },
    'billing-metrics': { maxRequests: 10, windowMs: ONE_MINUTE },
    'admin-observability': { maxRequests: 30, windowMs: ONE_MINUTE },
    'content-batch': { maxRequests: 10, windowMs: ONE_MINUTE },
    'content-export': { maxRequests: 5, windowMs: FIFTEEN_MINUTES },
    'marketplace-publish': { maxRequests: 10, windowMs: ONE_HOUR },
    'marketplace-invoke': { maxRequests: 30, windowMs: ONE_MINUTE },
    'revmarket-agents': { maxRequests: 30, windowMs: ONE_MINUTE },
    'revmarket-tasks': { maxRequests: 20, windowMs: ONE_MINUTE },
    'revmarket-reviews': { maxRequests: 10, windowMs: ONE_MINUTE },
    pricing: { maxRequests: 10, windowMs: ONE_MINUTE },
    'studio-auth': { maxRequests: 5, windowMs: ONE_MINUTE },
    'terminal-auth': { maxRequests: 5, windowMs: ONE_MINUTE },
    'terminal-sessions': { maxRequests: 10, windowMs: ONE_MINUTE },
    maintenance: { maxRequests: 1, windowMs: ONE_MINUTE },
    webhook: { maxRequests: 500, windowMs: ONE_MINUTE },
  },
};

// Apply env-var overrides for tier-level rate limits.
// Format: RATE_LIMIT_<TIER>=<requests-per-minute> (e.g. RATE_LIMIT_PRO=500)
function applyEnvRateLimits(defaults: RateLimitsConfig): RateLimitsConfig {
  const tiers = { ...defaults.tiers };
  for (const tier of ['free', 'pro', 'max', 'enterprise'] as const) {
    const envVal = process.env[`RATE_LIMIT_${tier.toUpperCase()}`];
    if (envVal) {
      const parsed = Number.parseInt(envVal, 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        tiers[tier] = { maxRequests: parsed, windowMs: ONE_MINUTE };
      }
    }
  }
  return { tiers, routes: { ...defaults.routes } };
}

let rateLimitsConfig: RateLimitsConfig = applyEnvRateLimits(DEFAULT_RATE_LIMITS);

/** Override rate limit defaults (useful for tests or per-environment tuning) */
export function configureRateLimits(overrides: Partial<RateLimitsConfig>): void {
  rateLimitsConfig = {
    tiers: { ...DEFAULT_RATE_LIMITS.tiers, ...overrides.tiers },
    routes: { ...DEFAULT_RATE_LIMITS.routes, ...overrides.routes },
  };
}

function routeLimit(key: string, opts?: { failOpen?: boolean }) {
  const cfg = rateLimitsConfig.routes[key] ?? DEFAULT_RATE_LIMITS.routes[key];
  return rateLimitMiddleware({ ...cfg, keyPrefix: key, ...opts });
}

// Rate limiting  -  tiered global + per-route overrides
// Applied to both /api/* and /api/v1/* for versioned route support
const tieredRateLimit = tieredRateLimitMiddleware({
  tiers: rateLimitsConfig.tiers,
  keyPrefix: 'api',
});
app.use('/api/*', tieredRateLimit);
app.use('/api/v1/*', tieredRateLimit);

app.use('/api/license/generate', routeLimit('license-gen'));
app.use('/api/v1/license/generate', routeLimit('license-gen'));

// A2A discovery endpoints are public per the A2A spec  -  fail-open so discovery
// works even when the rate-limit DB is temporarily unreachable.
app.use('/.well-known/*', routeLimit('a2a-discovery', { failOpen: true }));
app.use('/a2a/agents', routeLimit('a2a-discovery', { failOpen: true }));
app.use('/a2a/agents/*', routeLimit('a2a-discovery', { failOpen: true }));

app.use('/api/agent-tasks/*', routeLimit('agent'));
app.use('/api/v1/agent-tasks/*', routeLimit('agent'));

app.use('/api/agent-stream', routeLimit('agent-stream'));
app.use('/api/v1/agent-stream', routeLimit('agent-stream'));

app.use('/api/rag/*', routeLimit('rag'));
app.use('/api/v1/rag/*', routeLimit('rag'));

app.use('/api/errors', routeLimit('error-capture'));
app.use('/api/v1/errors', routeLimit('error-capture'));

app.use('/api/logs', routeLimit('log-ingest'));
app.use('/api/v1/logs', routeLimit('log-ingest'));

// API keys manage long-lived credentials  -  tight limits to slow enumeration/abuse
app.use('/api/api-keys/*', routeLimit('api-keys'));
app.use('/api/v1/api-keys/*', routeLimit('api-keys'));

// Billing endpoints create Stripe objects  -  tighter limits to prevent abuse
app.use('/api/billing/checkout', routeLimit('billing-checkout'));
app.use('/api/v1/billing/checkout', routeLimit('billing-checkout'));
app.use('/api/billing/upgrade', routeLimit('billing-upgrade'));
app.use('/api/v1/billing/upgrade', routeLimit('billing-upgrade'));
app.use('/api/billing/downgrade', routeLimit('billing-downgrade'));
app.use('/api/v1/billing/downgrade', routeLimit('billing-downgrade'));
app.use('/api/billing/checkout-perpetual', routeLimit('billing-checkout-perpetual'));
app.use('/api/v1/billing/checkout-perpetual', routeLimit('billing-checkout-perpetual'));
app.use('/api/billing/portal', routeLimit('billing-portal'));
app.use('/api/v1/billing/portal', routeLimit('billing-portal'));
app.use('/api/billing/refund', routeLimit('billing-refund'));
app.use('/api/v1/billing/refund', routeLimit('billing-refund'));
app.use('/api/billing/checkout-credits', routeLimit('billing-checkout-credits'));
app.use('/api/v1/billing/checkout-credits', routeLimit('billing-checkout-credits'));
app.use('/api/billing/checkout-support-renewal', routeLimit('billing-checkout-support-renewal'));
app.use('/api/v1/billing/checkout-support-renewal', routeLimit('billing-checkout-support-renewal'));
app.use('/api/billing/subscription', routeLimit('billing-subscription'));
app.use('/api/v1/billing/subscription', routeLimit('billing-subscription'));
app.use('/api/billing/usage', routeLimit('billing-usage'));
app.use('/api/v1/billing/usage', routeLimit('billing-usage'));
app.use('/api/billing/credits', routeLimit('billing-credits'));
app.use('/api/v1/billing/credits', routeLimit('billing-credits'));
app.use('/api/billing/invoices', routeLimit('billing-invoices'));
app.use('/api/v1/billing/invoices', routeLimit('billing-invoices'));
app.use('/api/billing/pause', routeLimit('billing-pause'));
app.use('/api/v1/billing/pause', routeLimit('billing-pause'));
app.use('/api/billing/resume', routeLimit('billing-resume'));
app.use('/api/v1/billing/resume', routeLimit('billing-resume'));
app.use('/api/billing/metrics', routeLimit('billing-metrics'));
app.use('/api/v1/billing/metrics', routeLimit('billing-metrics'));

// Content batch/export  -  limit heavy operations
app.use('/api/content/batch/*', routeLimit('content-batch'));
app.use('/api/v1/content/batch/*', routeLimit('content-batch'));
app.use('/api/content/export/*', routeLimit('content-export'));
app.use('/api/v1/content/export/*', routeLimit('content-export'));

// Marketplace publish  -  prevent server spam
app.use('/api/marketplace/servers', routeLimit('marketplace-publish'));
app.use('/api/v1/marketplace/servers', routeLimit('marketplace-publish'));

// Marketplace invoke  -  payment is the primary gate; still rate-limit to prevent probe abuse
app.use('/api/marketplace/servers/*/invoke', routeLimit('marketplace-invoke'));
app.use('/api/v1/marketplace/servers/*/invoke', routeLimit('marketplace-invoke'));

// RevMarket  -  agent marketplace rate limits
app.use('/api/revmarket/agents', routeLimit('revmarket-agents'));
app.use('/api/v1/revmarket/agents', routeLimit('revmarket-agents'));
app.use('/api/revmarket/tasks', routeLimit('revmarket-tasks'));
app.use('/api/v1/revmarket/tasks', routeLimit('revmarket-tasks'));
app.use('/api/revmarket/agents/*/reviews', routeLimit('revmarket-reviews'));
app.use('/api/v1/revmarket/agents/*/reviews', routeLimit('revmarket-reviews'));

// Pricing endpoint  -  public, heavily cached (ISR clients need at most 1 req/hour).
// Fail-open: pricing fetches from Stripe with server-side fallback, no DB needed.
app.use('/api/pricing', routeLimit('pricing', { failOpen: true }));
app.use('/api/v1/pricing', routeLimit('pricing', { failOpen: true }));

// Maintenance cron  -  1 req/min (cron-secret protected, limit prevents accidental hammering)
app.use('/api/maintenance/*', routeLimit('maintenance'));
app.use('/api/v1/maintenance/*', routeLimit('maintenance'));

// Content scheduling cron  -  same limits as maintenance
app.use('/api/cron/*', routeLimit('maintenance'));
app.use('/api/v1/cron/*', routeLimit('maintenance'));

// Admin observability  -  read-only dashboards, moderate limit
app.use('/api/admin/*', routeLimit('admin-observability'));
app.use('/api/v1/admin/*', routeLimit('admin-observability'));

// GDPR consent endpoints  -  moderate limits, deletion requests tighter
const gdprConsentLimit = rateLimitMiddleware({
  maxRequests: 30,
  windowMs: 60_000,
  keyPrefix: 'gdpr-consent',
});
app.use('/api/gdpr/consent/*', gdprConsentLimit);
app.use('/api/v1/gdpr/consent/*', gdprConsentLimit);

const gdprDeletionLimit = rateLimitMiddleware({
  maxRequests: 5,
  windowMs: 15 * 60_000,
  keyPrefix: 'gdpr-deletion',
});
app.use('/api/gdpr/deletion', gdprDeletionLimit);
app.use('/api/v1/gdpr/deletion', gdprDeletionLimit);

// Stripe Connect onboarding  -  tight limit (creates external Stripe objects)
const marketplaceConnectLimit = rateLimitMiddleware({
  maxRequests: 5,
  windowMs: 15 * 60_000,
  keyPrefix: 'marketplace-connect',
});
app.use('/api/marketplace/connect/*', marketplaceConnectLimit);
app.use('/api/v1/marketplace/connect/*', marketplaceConnectLimit);

// Public contact form  -  tight limit (unauthenticated, sends email)
const contactLimit = rateLimitMiddleware({
  maxRequests: 5,
  windowMs: 15 * 60_000,
  keyPrefix: 'contact',
});
app.use('/api/contact', contactLimit);
app.use('/api/v1/contact', contactLimit);

// Public waitlist / email capture  -  same tight limit (unauthenticated, DB write)
const waitlistLimit = rateLimitMiddleware({
  maxRequests: 5,
  windowMs: 15 * 60_000,
  keyPrefix: 'waitlist',
});
app.use('/api/waitlist', waitlistLimit);
app.use('/api/v1/waitlist', waitlistLimit);

// Populate session if present (non-blocking  -  sets user context for all API routes)
const optionalAuth = authMiddleware({ required: false });
app.use('/api/*', optionalAuth);
app.use('/api/v1/*', optionalAuth);
// Multi-tenant context (optional by default  -  routes that require it use requireTenant()).
// Membership-validated: a request may only claim a tenant its authenticated user
// belongs to (active accountMemberships row); anything else is 403'd here, before
// any tenant-scoped vault/DB/MCP access runs.
const optionalTenant = tenantMiddleware({
  required: false,
  validateTenant: createTenantMembershipValidator(getClient),
});
app.use('/api/*', optionalTenant);
app.use('/api/v1/*', optionalTenant);
// Additive hosted-SaaS entitlement context. Does not replace legacy license gates yet.
app.use('/api/*', entitlementMiddleware());
app.use('/api/v1/*', entitlementMiddleware());

// CSRF protection  -  defense-in-depth on top of sameSite:lax cookies
// Skips: safe methods, non-cookie clients, webhooks, cron routes
app.use('/api/*', csrfMiddleware());
app.use('/api/v1/*', csrfMiddleware());

// License status enforcement  -  catches revoked/expired licenses (5-minute DB cache)
const licenseStatusCheck = checkLicenseStatus(async (customerId) => {
  return queryBillingStatusByCustomerId(getClient(), customerId);
});
app.use('/api/*', licenseStatusCheck);
app.use('/api/v1/*', licenseStatusCheck);

// Perpetual license support expiry enforcement  -  downgrades premium features to free
// when the annual support contract has expired. Basic admin access remains perpetual.
// Sets X-Support-Expires header so clients can show renewal prompts.
const supportExpiryCheck = checkSupportExpiry(async (customerId) => {
  return querySupportExpiry(getClient(), customerId);
});
app.use('/api/*', supportExpiryCheck);
app.use('/api/v1/*', supportExpiryCheck);

// A2A routes live outside /api/* so they need their own entitlement + license status check.
// Without this, a revoked license retains A2A task execution access until the
// 5-minute in-memory feature-flag cache expires.
app.use('/a2a/*', entitlementMiddleware());
app.use('/a2a/*', licenseStatusCheck);
app.use('/a2a/*', supportExpiryCheck);

// GAP-310: block writes for lapsed-perpetual (read-only) licenses. Runs after
// checkSupportExpiry (which sets the read-only signal) and before the feature
// gates + route handlers. Governed by LICENSE_READ_ONLY_ENFORCE
// (off default / shadow / enforce); inert unless a license is in read-only mode.
app.use('/api/*', enforceReadOnlyWrites());
app.use('/api/v1/*', enforceReadOnlyWrites());
app.use('/a2a/*', enforceReadOnlyWrites());

// License enforcement  -  gate premium routes by feature
// Agent stream + tasks: free tier allowed with local inference, Pro+ for cloud providers
app.use('/api/agent-tasks/*', requireAIAccess({ mode: 'entitlements' }));
app.use('/api/v1/agent-tasks/*', requireAIAccess({ mode: 'entitlements' }));
app.use('/api/agent-stream', requireAIAccess({ mode: 'entitlements' }));
app.use('/api/v1/agent-stream', requireAIAccess({ mode: 'entitlements' }));
// RAG and collab/agent remain Pro+ only (cloud infrastructure required)
app.use('/api/rag/*', requireFeature('ai', { mode: 'entitlements' }));
app.use('/api/v1/rag/*', requireFeature('ai', { mode: 'entitlements' }));
app.use('/api/collab/agent/*', requireFeature('ai', { mode: 'entitlements' }));
app.use('/api/v1/collab/agent/*', requireFeature('ai', { mode: 'entitlements' }));
app.use('/api/provenance/*', requireFeature('dashboard', { mode: 'entitlements' }));
app.use('/api/v1/provenance/*', requireFeature('dashboard', { mode: 'entitlements' }));
// Billing mutation endpoints  -  checkout is open to all authenticated users (it's the
// entry point to becoming a subscriber). Upgrade/downgrade/portal require an existing
// subscription, so they stay gated behind the 'payments' feature (Pro+).
// Read-only metrics and webhook routes are excluded  -  they serve all tiers.
app.post('/api/billing/upgrade', requireFeature('payments', { mode: 'entitlements' }));
app.post('/api/v1/billing/upgrade', requireFeature('payments', { mode: 'entitlements' }));
app.post('/api/billing/downgrade', requireFeature('payments', { mode: 'entitlements' }));
app.post('/api/v1/billing/downgrade', requireFeature('payments', { mode: 'entitlements' }));
app.post('/api/billing/portal', requireFeature('payments', { mode: 'entitlements' }));
app.post('/api/v1/billing/portal', requireFeature('payments', { mode: 'entitlements' }));

// ---------------------------------------------------------------------------
// Role-based access control (RBAC)  -  uses core AuthorizationSystem with CommonRoles.
// Runs AFTER auth middleware, so user context is guaranteed for protected routes.
// Permissions are defined in packages/core/src/security/authorization.ts (CommonRoles).
// ---------------------------------------------------------------------------

// Content mutations: editor+ can create/update, admin+ can delete
app.post('/api/content/*', requirePermission('content', 'create'));
app.post('/api/v1/content/*', requirePermission('content', 'create'));
app.patch('/api/content/*', requirePermission('content', 'update'));
app.patch('/api/v1/content/*', requirePermission('content', 'update'));
app.delete('/api/content/*', requirePermission('content', 'delete'));
app.delete('/api/v1/content/*', requirePermission('content', 'delete'));

// RAG index writes and deletes are administrative operations (rebuilding/managing the vector index).
// Any authenticated user can read RAG query results, but only admins can modify index contents.
app.use('/api/rag/*/index/*', requirePermission('rag', 'admin'));
app.use('/api/v1/rag/*/index/*', requirePermission('rag', 'admin'));
app.delete('/api/rag/*', requirePermission('rag', 'admin'));
app.delete('/api/v1/rag/*', requirePermission('rag', 'admin'));

// API key management: admin-only (creates long-lived credentials)
app.post('/api/api-keys/*', requirePermission('api-keys', 'admin'));
app.post('/api/v1/api-keys/*', requirePermission('api-keys', 'admin'));
app.delete('/api/api-keys/*', requirePermission('api-keys', 'admin'));
app.delete('/api/v1/api-keys/*', requirePermission('api-keys', 'admin'));

// Marketplace server publish/delete: admin-only (registers services for all users)
app.post('/api/marketplace/servers', requirePermission('marketplace', 'admin'));
app.post('/api/v1/marketplace/servers', requirePermission('marketplace', 'admin'));
app.delete('/api/marketplace/servers/*', requirePermission('marketplace', 'admin'));
app.delete('/api/v1/marketplace/servers/*', requirePermission('marketplace', 'admin'));

// Collab sync routes require Pro+ (advancedSync feature)
app.use('/api/collab/snapshot/*', requireFeature('advancedSync', { mode: 'entitlements' }));
app.use('/api/v1/collab/snapshot/*', requireFeature('advancedSync', { mode: 'entitlements' }));
app.use('/api/collab/update', requireFeature('advancedSync', { mode: 'entitlements' }));
app.use('/api/v1/collab/update', requireFeature('advancedSync', { mode: 'entitlements' }));

// MCP usage aggregations are a Pro feature — without this gate, the
// `mcp` capability we sell to Pro+ tiers leaks via /api/mcp/usage to
// the free tier (caller's account-scoped, but the metering itself is
// the Pro-tier sell). Both versioned + unversioned mounts are gated.
app.use('/api/mcp/usage*', requireFeature('mcp', { mode: 'entitlements' }));
app.use('/api/v1/mcp/usage*', requireFeature('mcp', { mode: 'entitlements' }));

// Audit log export is a Max+ tier feature ("auditLog" in DEFAULT_FEATURES).
// The basic /api/admin/audit listing stays admin-role-gated only — this
// adds richer capability (CSV / JSON export of filtered windows) on top
// for Max+ tiers, without removing any existing admin's access.
app.use('/api/admin/audit/export', requireFeature('auditLog', { mode: 'entitlements' }));
app.use('/api/v1/admin/audit/export', requireFeature('auditLog', { mode: 'entitlements' }));

// Per-site inference configuration is a Max+ tier feature ("aiInference" in
// DEFAULT_FEATURES). Backed by workspace_inference_configs + the in-memory
// WorkspaceProviderRegistry hydrated at boot (lib/hydrate-inference-configs.ts).
app.use('/api/admin/inference/config*', requireFeature('aiInference', { mode: 'entitlements' }));
app.use('/api/v1/admin/inference/config*', requireFeature('aiInference', { mode: 'entitlements' }));

// Per-user DevKit profile selection is a Max+ tier feature ("devkitProfiles"
// in DEFAULT_FEATURES). Only the PUT to set the active profile is gated;
// GET /profiles (list) and GET /profile/active (read own selection) are
// authenticated but free for all tiers.
app.put('/api/devkit/profile/active', requireFeature('devkitProfiles', { mode: 'entitlements' }));
app.put(
  '/api/v1/devkit/profile/active',
  requireFeature('devkitProfiles', { mode: 'entitlements' }),
);

// Analytics is a Pro+ tier feature ("analytics" in DEFAULT_FEATURES). All
// analytics routes are read-only aggregations over usage_meters scoped to
// the authenticated user's account; gate the entire surface.
app.use('/api/analytics/*', requireFeature('analytics', { mode: 'entitlements' }));
app.use('/api/v1/analytics/*', requireFeature('analytics', { mode: 'entitlements' }));

// Credential rotation history is a Pro+ tier feature ("vaultRotation" in
// DEFAULT_FEATURES). The rotate/create/revoke operations themselves stay
// free for all tiers (the audit emission is just a side-effect); the
// Pro-tier value is the queryable history surface at /api/rotation/*.
app.use('/api/rotation/*', requireFeature('vaultRotation', { mode: 'entitlements' }));
app.use('/api/v1/rotation/*', requireFeature('vaultRotation', { mode: 'entitlements' }));

// Write-protect mutation endpoints  -  these require authentication
const writeProtected = authMiddleware({ required: true });

// GAP-355 Stage 4 S4-4: Merkle anchor download + inclusion proof (Max+ auditLog).
// Public-key stays unauthenticated under /api/audit/public-key.
app.use('/api/audit/anchors', writeProtected);
app.use('/api/audit/anchors/*', writeProtected);
app.use('/api/v1/audit/anchors', writeProtected);
app.use('/api/v1/audit/anchors/*', writeProtected);
app.use('/api/audit/anchors', requireFeature('auditLog', { mode: 'entitlements' }));
app.use('/api/audit/anchors/*', requireFeature('auditLog', { mode: 'entitlements' }));
app.use('/api/v1/audit/anchors', requireFeature('auditLog', { mode: 'entitlements' }));
app.use('/api/v1/audit/anchors/*', requireFeature('auditLog', { mode: 'entitlements' }));

// Block recovery sessions (magic link) from mutating routes.
// Recovery sessions should only be used for password change and sign-out.
const rejectRecovery = createMiddleware(async (c, next) => {
  const session = c.get('session') as Record<string, unknown> | undefined;
  const metadata = session?.metadata as Record<string, unknown> | undefined;
  if (metadata?.recovery === true) {
    return c.json(
      { error: 'Recovery sessions cannot perform this action. Please sign in with your password.' },
      403,
    );
  }
  return next();
});
app.get('/api/collab/snapshot/*', writeProtected);
app.get('/api/v1/collab/snapshot/*', writeProtected);
app.get('/api/collab/agent/snapshot/*', writeProtected);
app.get('/api/v1/collab/agent/snapshot/*', writeProtected);
app.post('/api/collab/*', writeProtected);
app.post('/api/v1/collab/*', writeProtected);
app.post('/api/collab/agent/*', writeProtected);
app.post('/api/v1/collab/agent/*', writeProtected);
// Ticket routes: all methods require auth  -  boards/tickets are private workspace data
app.get('/api/tickets/*', writeProtected);
app.get('/api/v1/tickets/*', writeProtected);
app.post('/api/tickets/*', writeProtected);
app.post('/api/v1/tickets/*', writeProtected);
app.patch('/api/tickets/*', writeProtected);
app.patch('/api/v1/tickets/*', writeProtected);
app.delete('/api/tickets/*', writeProtected);
app.delete('/api/v1/tickets/*', writeProtected);
app.post('/api/agent-tasks/*', writeProtected);
app.post('/api/v1/agent-tasks/*', writeProtected);
app.post('/api/agent-stream', writeProtected);
app.post('/api/v1/agent-stream', writeProtected);
app.post('/api/agent-stream/elicit', writeProtected);
app.post('/api/v1/agent-stream/elicit', writeProtected);
app.get('/api/rag/*', writeProtected);
app.get('/api/v1/rag/*', writeProtected);
app.post('/api/rag/*', writeProtected);
app.post('/api/v1/rag/*', writeProtected);
app.delete('/api/rag/*', writeProtected);
app.delete('/api/v1/rag/*', writeProtected);
app.get('/api/provenance/*', writeProtected);
app.get('/api/v1/provenance/*', writeProtected);
app.post('/api/provenance/*', writeProtected);
app.post('/api/v1/provenance/*', writeProtected);
app.patch('/api/provenance/*', writeProtected);
app.patch('/api/v1/provenance/*', writeProtected);
app.delete('/api/provenance/*', writeProtected);
app.delete('/api/v1/provenance/*', writeProtected);
app.get('/api/admin/*', writeProtected);
app.get('/api/v1/admin/*', writeProtected);
app.get('/api/billing/metrics', writeProtected);
app.get('/api/v1/billing/metrics', writeProtected);
// Billing POST auth  -  skip cron routes (they use X-Cron-Secret, not session auth)
const BILLING_CRON_SUFFIXES = [
  '/support-renewal-check',
  '/report-agent-overage',
  '/sweep-expired-licenses',
];
const billingWriteGuard = createMiddleware(async (c, next) => {
  if (BILLING_CRON_SUFFIXES.some((s) => c.req.path.endsWith(s))) return next();
  return writeProtected(c, next);
});
app.post('/api/billing/*', billingWriteGuard);
app.post('/api/v1/billing/*', billingWriteGuard);
app.post('/api/billing/*', rejectRecovery);
app.post('/api/v1/billing/*', rejectRecovery);
app.get('/api/gdpr/*', writeProtected);
app.get('/api/v1/gdpr/*', writeProtected);
app.post('/api/gdpr/*', writeProtected);
app.post('/api/v1/gdpr/*', writeProtected);
app.post('/api/gdpr/*', rejectRecovery);
app.post('/api/v1/gdpr/*', rejectRecovery);
app.post('/api/content/*', writeProtected);
app.post('/api/v1/content/*', writeProtected);
app.patch('/api/content/*', writeProtected);
app.patch('/api/v1/content/*', writeProtected);
app.delete('/api/content/*', writeProtected);
app.delete('/api/v1/content/*', writeProtected);
app.post('/api/content/*', rejectRecovery);
app.post('/api/v1/content/*', rejectRecovery);
app.patch('/api/content/*', rejectRecovery);
app.patch('/api/v1/content/*', rejectRecovery);
app.delete('/api/content/*', rejectRecovery);
app.delete('/api/v1/content/*', rejectRecovery);

// Resource limits  -  enforce tier-based caps on site creation
const siteLimit = enforceSiteLimit(() => sites);
app.post('/api/content/sites', siteLimit);
app.post('/api/v1/content/sites', siteLimit);

// Resource limits  -  enforce tier-based caps on user signup
app.use('/api/auth/signup', routeLimit('auth-signup'));
app.use('/api/v1/auth/signup', routeLimit('auth-signup'));
// GAP-256 admission waitlist (status + claim)
app.use('/api/admission/*', routeLimit('admission-waitlist'));
app.use('/api/v1/admission/*', routeLimit('admission-waitlist'));
// Enterprise SSO OIDC init/callback (GAP-464)
app.use('/api/auth/sso/*', routeLimit('auth-sso'));
app.use('/api/v1/auth/sso/*', routeLimit('auth-sso'));
// Enterprise SSO provider admin config (GAP-464)
app.use('/api/accounts/*', routeLimit('sso-providers'));
app.use('/api/v1/accounts/*', routeLimit('sso-providers'));
const userLimit = enforceUserLimit(() => users);
app.post('/api/auth/signup', userLimit);
app.post('/api/v1/auth/signup', userLimit);

// Task quota metering (Track B)  -  runs after auth + feature gate so user context is set.
// Applied to all AI task endpoints: agent-tasks, agent-stream, and A2A (a2a.ts wires its own).
app.post('/api/agent-tasks/*', requireTaskQuota);
app.post('/api/v1/agent-tasks/*', requireTaskQuota);
app.post('/api/agent-stream', requireTaskQuota);
app.post('/api/v1/agent-stream', requireTaskQuota);

// OpenAPI documentation
app.doc('/openapi.json', {
  openapi: '3.0.0',
  info: {
    version: '1.0.0',
    title: 'RevealUI API',
    description: 'REST API for RevealUI application with OpenAPI 3.0 specification',
  },
  servers: [
    {
      url: resolveSelfApiBaseUrl() || 'http://localhost:3004',
      description: process.env.NODE_ENV === 'production' ? 'Production' : 'Development server',
    },
  ],
});

// Self-hosted Swagger UI (no CDN, CSP-strict compatible).
// Resolve assets via import.meta.resolve so BOTH runtimes work (GAP-401):
// - `tsx watch` has no tsup banner `require`
// - the tsup banner injects `createRequire` + `const require`; a second
//   `import { createRequire }` in this file becomes a SyntaxError in the
//   bundled chunk (Identifier 'createRequire' has already been declared)
//
// Lazy-load on first /docs* hit. Top-level readFileSync of swagger-ui-dist
// (or missing NFT-traced node_modules files on Vercel) would crash module
// evaluation and take down /health with FUNCTION_INVOCATION_FAILED — same
// class as the 2026-07-21 post-#2027 API outage.
interface SwaggerAssets {
  css: string;
  bundleJs: string;
  presetJs: string;
}

let swaggerAssetsCache: SwaggerAssets | null = null;

function loadSwaggerAssets(): SwaggerAssets {
  if (!swaggerAssetsCache) {
    swaggerAssetsCache = {
      css: readFileSync(
        fileURLToPath(import.meta.resolve('swagger-ui-dist/swagger-ui.css')),
        'utf-8',
      ),
      bundleJs: readFileSync(
        fileURLToPath(import.meta.resolve('swagger-ui-dist/swagger-ui-bundle.js')),
        'utf-8',
      ),
      presetJs: readFileSync(
        fileURLToPath(import.meta.resolve('swagger-ui-dist/swagger-ui-standalone-preset.js')),
        'utf-8',
      ),
    };
  }
  return swaggerAssetsCache;
}

const swaggerInitJs = `window.addEventListener('load', function () {
  window.ui = SwaggerUIBundle({
    url: '/openapi.json',
    dom_id: '#swagger-ui',
    presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
    layout: 'BaseLayout',
    deepLinking: true,
  });
});`;

const IMMUTABLE_ASSET = 'public, max-age=31536000, immutable';

app.get('/docs/swagger-ui.css', (c) =>
  c.body(loadSwaggerAssets().css, 200, {
    'content-type': 'text/css; charset=utf-8',
    'cache-control': IMMUTABLE_ASSET,
  }),
);
app.get('/docs/swagger-ui-bundle.js', (c) =>
  c.body(loadSwaggerAssets().bundleJs, 200, {
    'content-type': 'application/javascript; charset=utf-8',
    'cache-control': IMMUTABLE_ASSET,
  }),
);
app.get('/docs/swagger-ui-standalone-preset.js', (c) =>
  c.body(loadSwaggerAssets().presetJs, 200, {
    'content-type': 'application/javascript; charset=utf-8',
    'cache-control': IMMUTABLE_ASSET,
  }),
);
app.get('/docs/swagger-init.js', (c) =>
  c.body(swaggerInitJs, 200, {
    'content-type': 'application/javascript; charset=utf-8',
    'cache-control': IMMUTABLE_ASSET,
  }),
);

const SWAGGER_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>RevealUI API · Reference</title>
    <link rel="stylesheet" href="/docs/swagger-ui.css" />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="/docs/swagger-ui-bundle.js"></script>
    <script src="/docs/swagger-ui-standalone-preset.js"></script>
    <script src="/docs/swagger-init.js"></script>
  </body>
</html>`;

app.get('/docs', (c) =>
  c.html(SWAGGER_HTML, 200, { 'cache-control': 'public, max-age=300, must-revalidate' }),
);

// This page ships as a standalone HTML string with its own <style> block and
// no stylesheet link, so it can't reference the app's --rvui-font-sans custom
// property. The literal stack below mirrors that token (Inter first).
const LANDING_FONT_SANS = `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif`;

const LANDING_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>RevealUI API</title>
    <meta name="description" content="RevealUI API — the backend for RevealUI Studio and the RevealUI platform." />
    <style>
      :root { color-scheme: light dark; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: ${LANDING_FONT_SANS};
        background: #0b0b0f;
        color: #e6e6ea;
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 2rem;
      }
      .card {
        max-width: 560px;
        width: 100%;
        background: #14141b;
        border: 1px solid #23232e;
        border-radius: 16px;
        padding: 2.5rem;
        box-shadow: 0 30px 60px -20px rgba(0,0,0,0.5);
      }
      h1 { margin: 0 0 0.25rem; font-size: 1.75rem; letter-spacing: -0.01em; }
      .status { display: inline-flex; align-items: center; gap: 0.5rem; color: #7ee787; font-size: 0.875rem; margin-bottom: 1.5rem; }
      .status::before { content: ''; width: 8px; height: 8px; border-radius: 50%; background: #7ee787; box-shadow: 0 0 12px #7ee787; }
      p { color: #a0a0ae; line-height: 1.6; margin: 0 0 1.5rem; }
      ul { list-style: none; padding: 0; margin: 0; display: grid; gap: 0.5rem; }
      a {
        display: flex; align-items: center; justify-content: space-between;
        padding: 0.875rem 1rem;
        background: #1c1c26;
        border: 1px solid #2a2a38;
        border-radius: 10px;
        color: #e6e6ea;
        text-decoration: none;
        transition: background 0.15s, border-color 0.15s;
      }
      a:hover { background: #23232e; border-color: #3a3a4a; }
      a span.label { font-weight: 500; }
      a span.path { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.8125rem; color: #8a8a98; }
      footer { margin-top: 2rem; font-size: 0.8125rem; color: #6a6a78; text-align: center; }
      footer a { display: inline; background: none; border: none; padding: 0; color: #8a8a98; }
      footer a:hover { color: #e6e6ea; background: none; }
    </style>
  </head>
  <body>
    <main class="card">
      <h1>RevealUI API</h1>
      <div class="status">Operational</div>
      <p>The backend for RevealUI Studio and the RevealUI platform. Not a user-facing site — use the links below for documentation and health checks.</p>
      <ul>
        <li><a href="/docs"><span class="label">Interactive API Reference</span><span class="path">/docs</span></a></li>
        <li><a href="/openapi.json"><span class="label">OpenAPI Specification</span><span class="path">/openapi.json</span></a></li>
        <li><a href="/health"><span class="label">Service Health</span><span class="path">/health</span></a></li>
      </ul>
      <footer>
        <a href="https://revealui.com">revealui.com</a> · <a href="https://github.com/RevealUIStudio/revealui">GitHub</a>
      </footer>
    </main>
  </body>
</html>`;

app.get('/', (c) =>
  c.html(LANDING_HTML, 200, { 'cache-control': 'public, max-age=300, must-revalidate' }),
);

// ---------------------------------------------------------------------------
// Cache-Control headers  -  ensure all routes have appropriate caching directives
// ---------------------------------------------------------------------------

// Health/monitoring: no-cache (always fresh, but not sensitive)
const noCache = noCacheCacheMiddleware();
app.use('/health/*', noCache);
app.use('/health', noCache);

// Sensitive endpoints: no-store (never cache auth, billing, GDPR, webhooks)
const noStore = noStoreCacheMiddleware();
app.use('/api/auth/*', noStore);
app.use('/api/v1/auth/*', noStore);
app.use('/api/billing/*', noStore);
app.use('/api/v1/billing/*', noStore);
app.use('/api/webhooks/*', noStore);
app.use('/api/v1/webhooks/*', noStore);
app.use('/api/gdpr/*', noStore);
app.use('/api/v1/gdpr/*', noStore);
app.use('/api/license/*', noStore);
app.use('/api/v1/license/*', noStore);
app.use('/api/ghcr/*', noStore);
app.use('/api/v1/ghcr/*', noStore);
app.use('/api/studio-auth/*', noStore);
app.use('/api/v1/studio-auth/*', noStore);
app.use('/api/terminal-auth/*', noStore);
app.use('/api/v1/terminal-auth/*', noStore);
// console-auth: forward-compat alias for the desktop-client auth routes.
// Same handler, same rate limits as /api/terminal-auth/*. Lets the Studio
// DNS cutover target the new path without requiring an internal rename.
app.use('/api/console-auth/*', noStore);
app.use('/api/v1/console-auth/*', noStore);
app.use('/api/api-keys/*', noStore);
app.use('/api/v1/api-keys/*', noStore);
app.use('/api/admin/*', noStore);
app.use('/api/v1/admin/*', noStore);
app.use('/api/agent-tasks/*', noStore);
app.use('/api/v1/agent-tasks/*', noStore);
app.use('/api/agent-stream', noStore);
app.use('/api/v1/agent-stream', noStore);

// Cron/maintenance: no-cache (not sensitive, but always fresh)
app.use('/api/cron/*', noCache);
app.use('/api/v1/cron/*', noCache);
app.use('/api/maintenance/*', noCache);
app.use('/api/v1/maintenance/*', noCache);

// Routes
app.route('/.well-known', wellKnownRoutes);
app.route('/a2a', a2aRoutes);
app.route('/health', healthRoute);
app.route('/api/errors', errorsRoute);
app.route('/api/gdpr', gdprRoute);
app.route('/api/logs', logsRoute);
app.route('/api/license', licenseRoute);
app.route('/api/kits', kitsRoute);
app.route('/api/auth', authRoute);
app.route('/api/auth', authSsoRoute);
app.route('/api/accounts', ssoProvidersRoute);
app.route('/api/billing', billingRoute);
app.route('/api/contact', contactRoute);
app.route('/api/v1/contact', contactRoute);
app.route('/api/waitlist', waitlistRoute);
app.route('/api/v1/waitlist', waitlistRoute);
// GAP-256 admission waitlist (distinct from marketing waitlist)
app.route('/api/admission', admissionWaitlistRoute);
app.route('/api/v1/admission', admissionWaitlistRoute);
// Webhooks are rate-limited to prevent replay abuse and resource exhaustion.
// Stripe's DB-backed idempotency handles dedup; this limits request volume.
app.use('/api/webhooks/*', rateLimitMiddleware(rateLimitsConfig.routes.webhook));
app.route('/api/webhooks', webhooksRoute);
app.route('/api/provenance', provenanceRoute);
app.route('/api/tickets', ticketsRoute);
app.route('/api/agent-tasks', agentTasksRoute);
// A.2b: elicitation-response endpoint for in-flight agent runs. Mounted
// BEFORE the parent `/api/agent-stream` route so Hono's trie-based router
// matches the more-specific path first. The OpenAPIHono instance for
// agent-stream is already bound to `/` for its POST streaming handler, so
// elicit must be a sibling rather than a sub-route.
app.route('/api/agent-stream/elicit', agentStreamElicitRoute);
app.route('/api/agent-stream', agentStreamRoute);
// A.3: Usage aggregation endpoint for the /admin/mcp Usage tab.
app.route('/api/mcp/usage', mcpUsageRoute);
// GAP-371 Phase 1: governed MCP endpoint. Bound to the EXACT path /api/mcp
// (auth → entitlements → requireFeature('mcp') → Streamable HTTP), so it does
// not shadow the /api/mcp/usage route mounted above.
mountMcpEndpoint(app);
// GAP-381 Phase A: harness hook receipts + policy snapshot (device-token only)
mountHarnessReceipts(app);
app.route('/api/content', contentRoute);
app.route('/api/rag', ragIndexRoute);
app.route('/api/admin', adminObservabilityRoute);
app.route('/api/admin/inference/config', adminInferenceConfigRoute);
app.route('/api/admin/local-ai/status', adminLocalAiStatusRoute);
app.route('/api/admin/coordination', adminCoordinationRoute);
app.route('/api/analytics', analyticsRoute);
app.route('/api/nudges', nudgesRoute);
app.route('/api/devkit', devkitRoute);
app.route('/api/rotation', rotationRoute);
app.route('/api/api-keys', apiKeysRoute);
app.route('/api/cron', cronBillingReadinessRoute);
app.route('/api/cron', cronDispatchRoute);
app.route('/api/cron', cronDrainUnreconciledRoute);
app.route('/api/cron', cronMarketplacePayoutsRoute);
app.route('/api/cron', cronPublishRoute);
app.route('/api/cron', cronReconcileCustomersRoute);
app.route('/api/cron', cronReconcileStripeSubscriptionsRoute);
app.route('/api/cron', cronReconcileSubscriptionsRoute);
app.route('/api/cron', cronSweepGraceRoute);
app.route('/api/cron', cronCleanupRoute);
app.route('/api/cron', cronJobsSafetyNetRoute);
app.route('/api/cron', cronLifecycleEmailsRoute);
app.route('/api/cron', cronMarginSnapshotRoute);
app.route('/api/cron', cronWorkerLivenessRoute);
app.route('/api/jobs', jobsRoute);
app.route('/api/ghcr', ghcrRoute);
app.route('/api/maintenance', maintenanceRoute);
app.route('/api/marketplace', marketplaceRoute);
// OG image generation: lazy-load satori/resvg/fonts — never on cold-start path.
app.route(
  '/api/og',
  createLazyHonoRoute(() => import('./routes/og.js')),
);
app.route('/api/pricing', pricingRoute);
app.route('/api/audit', auditRoute);
app.route('/api/revmarket', revmarketRoute);
app.use('/api/studio-auth/*', routeLimit('studio-auth'));
app.use('/api/v1/studio-auth/*', routeLimit('studio-auth'));
app.route('/api/studio-auth', studioAuthRoute);
app.use('/api/terminal-auth/*', routeLimit('terminal-auth'));
app.use('/api/v1/terminal-auth/*', routeLimit('terminal-auth'));
app.route('/api/terminal-auth', terminalAuthRoute);
// Alias mount (see comment above for console-auth no-store middleware).
app.use('/api/console-auth/*', routeLimit('terminal-auth'));
app.use('/api/v1/console-auth/*', routeLimit('terminal-auth'));
app.route('/api/console-auth', terminalAuthRoute);

// Terminal WebSocket bridge  -  daemon PTY sessions for remote access
// Operator-gated: terminal sessions give PTY access to the server host, so
// bare authentication is not enough — only owner/admin may reach the surface.
app.use('/api/terminal/*', writeProtected);
app.use('/api/terminal/*', requireRole('owner', 'admin'));
app.use('/api/terminal/*', routeLimit('terminal-sessions'));
export const terminalWs = createTerminalRoute();
app.route('/api/terminal', terminalWs.app);

app.route('', createCollabRoute());
app.route('', createAgentCollabRoute());

// Versioned routes (/api/v1/*)  -  mirrors of /api/* for forward compatibility.
// Non-API routes (/.well-known, /a2a, /health) are not versioned.
app.route('/api/v1/errors', errorsRoute);
app.route('/api/v1/gdpr', gdprRoute);
app.route('/api/v1/logs', logsRoute);
app.route('/api/v1/license', licenseRoute);
app.route('/api/v1/kits', kitsRoute);
app.route('/api/v1/auth', authRoute);
app.route('/api/v1/auth', authSsoRoute);
app.route('/api/v1/accounts', ssoProvidersRoute);
app.route('/api/v1/billing', billingRoute);
app.use('/api/v1/webhooks/*', rateLimitMiddleware(rateLimitsConfig.routes.webhook));
app.route('/api/v1/webhooks', webhooksRoute);
app.route('/api/v1/provenance', provenanceRoute);
app.route('/api/v1/tickets', ticketsRoute);
app.route('/api/v1/agent-tasks', agentTasksRoute);
app.route('/api/v1/agent-stream/elicit', agentStreamElicitRoute);
app.route('/api/v1/agent-stream', agentStreamRoute);
app.route('/api/v1/mcp/usage', mcpUsageRoute);
app.route('/api/v1/content', contentRoute);
app.route('/api/v1/rag', ragIndexRoute);
app.route('/api/v1/admin', adminObservabilityRoute);
app.route('/api/v1/admin/inference/config', adminInferenceConfigRoute);
app.route('/api/v1/admin/local-ai/status', adminLocalAiStatusRoute);
app.route('/api/v1/admin/coordination', adminCoordinationRoute);
app.route('/api/v1/analytics', analyticsRoute);
app.route('/api/v1/nudges', nudgesRoute);
app.route('/api/v1/devkit', devkitRoute);
app.route('/api/v1/rotation', rotationRoute);
app.route('/api/v1/api-keys', apiKeysRoute);
app.route('/api/v1/cron', cronBillingReadinessRoute);
app.route('/api/v1/cron', cronDispatchRoute);
app.route('/api/v1/cron', cronDrainUnreconciledRoute);
app.route('/api/v1/cron', cronMarketplacePayoutsRoute);
app.route('/api/v1/cron', cronPublishRoute);
app.route('/api/v1/cron', cronReconcileCustomersRoute);
app.route('/api/v1/cron', cronReconcileSubscriptionsRoute);
app.route('/api/v1/cron', cronSweepGraceRoute);
app.route('/api/v1/cron', cronCleanupRoute);
app.route('/api/v1/cron', cronJobsSafetyNetRoute);
app.route('/api/v1/cron', cronLifecycleEmailsRoute);
app.route('/api/v1/cron', cronMarginSnapshotRoute);
app.route('/api/v1/cron', cronWorkerLivenessRoute);
app.route('/api/v1/jobs', jobsRoute);
app.route('/api/v1/ghcr', ghcrRoute);
app.route('/api/v1/maintenance', maintenanceRoute);
app.route('/api/v1/marketplace', marketplaceRoute);
app.route(
  '/api/v1/og',
  createLazyHonoRoute(() => import('./routes/og.js')),
);
app.route('/api/v1/pricing', pricingRoute);
app.route('/api/v1/audit', auditRoute);
app.route('/api/v1/revmarket', revmarketRoute);
app.route('/api/v1/studio-auth', studioAuthRoute);

// Error handling
app.onError(errorHandler);

// For Vercel serverless
export default app;

// Alerting  -  register channels and rules, start periodic evaluation.
// Runs in both dev and prod. Console channel always active.
let monitoringInterval: NodeJS.Timeout | undefined;

export function initAlerting(): void {
  alerting.addChannel(consoleChannel);

  alerting.registerRule(
    createMemoryUsageAlert(() => {
      const mem = process.memoryUsage();
      return Math.round((mem.heapUsed / getHeapStatistics().heap_size_limit) * 100);
    }, 85),
  );

  alerting.registerRule(
    createDatabaseAlert(async () => {
      try {
        const db = getClient();
        await db.execute(sql`SELECT 1`);
        return true;
      } catch {
        return false;
      }
    }),
  );

  monitoringInterval = alerting.startMonitoring(60_000);
  logger.info('Alerting system started (60s interval)');
}

// For local development (but not in test environment).
// The OUTER predicate string is asserted verbatim by index.startup.test.ts
// (it locates this block to check serve()/license invariants) — keep it exact.
if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test') {
  // NODE_ENV='test' normally short-circuits this block under Vitest, but the
  // integration suite (isolate:false) has tests that stub NODE_ENV to
  // 'development'/'production' and re-import this module via vi.resetModules
  // (e.g. api-cors). Without this inner guard the dev bootstrap then fires
  // serve() and binds a port → EADDRINUSE / hung worker. VITEST is set by the
  // runner regardless of any NODE_ENV stub, so it's the reliable signal.
  if (!process.env.VITEST) {
    // Swap in persistent audit storage (replaces default InMemoryAuditStorage).
    assertAuditStorageEnv();
    installAuditStorage();
    // GAP-406 WIRE: opt-in MCPHypervisor sinks (+ optional process-local spawn).
    void wireMcpHypervisorIfEnabled().catch((err: unknown) => {
      logger.error(
        '[mcp-hypervisor-wire] boot failed',
        err instanceof Error ? err : new Error(String(err)),
      );
    });
    validateStartup();
    // validateLicenseAtStartup is a no-op in hosted mode (REVEALUI_LICENSE_PRIVATE_KEY
    // present); in self-hosted Forge mode it throws on missing/invalid license,
    // which we surface as process.exit(1) so a stamped kit refuses to serve
    // traffic without a valid studio-issued JWT.
    //
    // validateBillingCatalogAtStartup is a no-op outside production-hosted-live
    // (the dev branch is NODE_ENV !== 'production' so it short-circuits
    // immediately); kept in the chain for symmetry with the production block
    // below, where it fails boot if `billing_catalog` isn't seeded for live
    // mode (prevents mid-customer-transaction 500s).
    //
    // auditStorageSelfTest writes a synthetic event through the just-installed
    // storage and reads it back, exiting the process if the round trip fails —
    // fail-closed integrity (ADR §2a). Sequenced AFTER installAuditStorage() so
    // it exercises the real persistent path, not the in-memory default.
    //
    // validateStripeTaxConfigAtStartup (GAP-437) runs LAST — same shape as
    // worker.ts (see that file's comment + the function's own docstring): a
    // SECONDARY, structurally fail-open advisory signal, never the authoritative
    // control (that's the daily billing-readiness cron). This dev block is local
    // developer feedback only; it also short-circuits immediately outside
    // production-hosted-live, which `pnpm dev:api` never is.
    validateLicenseAtStartup()
      .then(() => validateBillingCatalogAtStartup())
      .then(() => auditStorageSelfTest())
      .then(() => runHostedLicenseCanary())
      .then(() => initializeLicense())
      .then((tier) => {
        logger.info(`License tier: ${tier}`);
        return validateStripeTaxConfigAtStartup().catch(() => {
          // Belt-and-suspenders (mirrors worker.ts): the function itself is
          // structurally fail-open, but this call site must never let a
          // defect in this advisory step reach the chain's exit(1) catch.
        });
      })
      .catch((err: unknown) => {
        logger.error(
          'Startup validation failed; exiting',
          err instanceof Error ? err : new Error(String(err)),
        );
        process.exit(1);
      });
    initAlerting();
    // Best-effort hydration of per-site LLM provider configs into the
    // in-memory registry. Skipped silently if @revealui/ai not installed or DB
    // unreachable; agents fall back to env-based config in those cases.
    hydrateInferenceConfigs();
    const port = Number(process.env.API_PORT || process.env.PORT) || 3004;
    const server = serve({ fetch: app.fetch, port });
    terminalWs.injectWebSocket(server);
    logger.info(`🚀 API server running on http://localhost:${port}`);
    logger.info(`📚 API documentation available at http://localhost:${port}/docs`);
    logger.info(`📄 OpenAPI spec available at http://localhost:${port}/openapi.json`);
  }
}

// Configure trusted-proxy-aware client IP extraction for session-binding
// validation. See GAP-130 + packages/security/src/request-ip.ts.
// trustedProxyCount: 1 reflects the current Vercel-only proxy chain. When
// Cloudflare is added in front of api.revealui.com (GAP-133 phases 5-6), bump
// to 2 in the SAME PR as the orange-cloud cutover — leaving N=1 after Cloudflare
// goes orange = spoofable IPs again; setting N=2 before Cloudflare = garbage
// IPs / 'unknown' for everyone.
configureClientIp({ trustedProxyCount: 1 });

// NODE_ENV === 'production' LONG-RUNNING boot is handled by src/worker.ts (Fly
// entry). This module stays free of long-running side effects in production so
// the Vercel serverless handler (api/index.js → dist/index.js) doesn't kick off
// serve(), injectWebSocket, initAlerting, hydrateInferenceConfigs, or
// startExecutor on every cold start. The dev block above still fires for
// `pnpm dev:api` (NODE_ENV=development). See the internal infra-consolidation
// lane plan (Phase 2) for the extraction history.
//
// One synchronous, side-effect-free exception runs here: validateStartup().
// The Vercel serverless API executes ONLY this module's top-level code, so
// without this call it had NO boot-time env validation at all — a deploy whose
// config was internally inconsistent (e.g. a live Stripe key with
// STRIPE_LIVE_MODE unset, or a malformed REVEALUI_KEK) booted clean and failed
// only on the first request that happened to touch the broken value.
// validateStartup() is pure (process.env reads + format checks + a stderr
// warning) and throws on misconfig, so calling it at module load fails the cold
// start fast and loud. We deliberately do NOT run the async chain here:
// validateLicenseAtStartup is a no-op in hosted mode, validateBillingCatalog-
// AtStartup is a per-cold-start DB round-trip we don't want on the request path
// (the daily billing-readiness cron already covers catalog drift), and
// serve()/intervals/executor are serverless-incompatible. Those stay in worker.ts.
//
// Trade-off (intentional): any missing/malformed REQUIRED_IN_PRODUCTION_HOSTED
// var now fails the WHOLE API at cold start rather than degrading one feature.
// For a money-handling deployment that fail-fast posture is the desired one and
// matches worker.ts. SKIP_ENV_VALIDATION (honored inside validateStartup) still
// lets Docker-build / build-only contexts compile without live credentials.
//
// The VITEST inner guard mirrors the dev block: the runner sets VITEST
// regardless of any NODE_ENV stub, and several suites re-import this module with
// NODE_ENV='production' (vi.resetModules) — without the guard those imports
// would throw on the test env's intentionally-incomplete config.
//
// installAuditStorage() also runs here: the Vercel serverless handler serves
// `/api/*` (with auditMiddleware mounted), so THIS process must swap the audit
// system onto persistent storage — otherwise request-level audit events fall
// into the default InMemoryAuditStorage and evaporate on every invocation
// (the core defect of GAP-355). It is synchronous and side-effect-free at call
// time (getClient() is lazy), so it does NOT reintroduce the cold-start
// port-binding / DB-round-trip cost the Phase-2 extraction removed. The
// round-trip self-test (auditStorageSelfTest) deliberately does NOT run here —
// it lives on the long-running worker + dev boot chains, where an async boot
// path already exists and process.exit(1) gives "refuse to serve" clean
// semantics that serverless cold-start cannot.
if (process.env.NODE_ENV === 'production') {
  if (!process.env.VITEST) {
    validateStartup();
    // Fail the deploy if audit-critical env has diverged, rather than installing
    // a store that can never write (GAP-355 Stage 1 closure). Synchronous, no
    // round trip — the serverless-safe substitute for the worker's self-test.
    assertAuditStorageEnv();
    installAuditStorage();
    // GAP-406 WIRE: opt-in MCPHypervisor sinks (+ optional process-local spawn).
    void wireMcpHypervisorIfEnabled().catch((err: unknown) => {
      logger.error(
        '[mcp-hypervisor-wire] boot failed',
        err instanceof Error ? err : new Error(String(err)),
      );
    });
  }
}

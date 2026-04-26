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
import { bodyLimit } from 'hono/body-limit';
import { createMiddleware } from 'hono/factory';
import { logger as honoLogger } from 'hono/logger';
// Side-effect import: registers durable-queue handlers at module top
// level so both the producer (POST /api/agent-tasks) and the worker
// (POST /api/jobs/run) invocations see the same registry. See
// CR8-P2-01 phase C.
import { assertDispatchFlagConfigured } from './jobs/register-handlers.js';
import { queryBillingStatusByCustomerId, querySupportExpiry } from './lib/billing-status.js';
import { PostgresAuditStorage } from './lib/postgres-audit-storage.js';
import { validateStartup } from './lib/validate-startup.js';
import { auditMiddleware } from './middleware/audit.js';
import { authMiddleware } from './middleware/auth.js';
import { requirePermission } from './middleware/authorization.js';
import { noCacheCacheMiddleware, noStoreCacheMiddleware } from './middleware/cache-control.js';
import { csrfMiddleware } from './middleware/csrf.js';
import { dbMiddleware } from './middleware/db.js';
import { domainLockMiddleware, validateForgeConfig } from './middleware/domain-lock.js';
import { entitlementMiddleware } from './middleware/entitlements.js';
import { errorHandler } from './middleware/error.js';
import {
  checkLicenseStatus,
  checkSupportExpiry,
  requireAIAccess,
  requireDomain,
  requireFeature,
} from './middleware/license.js';
import { rateLimitMiddleware, tieredRateLimitMiddleware } from './middleware/rate-limit.js';
import { requestIdMiddleware } from './middleware/request-id.js';
import { enforceSiteLimit, enforceUserLimit } from './middleware/resource-limits.js';
import { requireTaskQuota } from './middleware/task-quota.js';
import { tenantMiddleware } from './middleware/tenant.js';
import { a2aRoutes, wellKnownRoutes } from './routes/a2a.js';
import adminObservabilityRoute from './routes/admin/observability.js';
import { createAgentCollabRoute } from './routes/agent-collab.js';
import agentStreamRoute from './routes/agent-stream.js';
import agentStreamElicitRoute from './routes/agent-stream-elicit.js';
import agentTasksRoute from './routes/agent-tasks.js';
import apiKeysRoute from './routes/api-keys.js';
import authRoute from './routes/auth.js';
import billingRoute from './routes/billing.js';
import provenanceRoute from './routes/code-provenance.js';
import { createCollabRoute } from './routes/collab.js';
import contentRoute from './routes/content/index.js';
import cronBillingReadinessRoute from './routes/cron/billing-readiness.js';
import cronCleanupRoute from './routes/cron/cleanup.js';
import cronDispatchRoute from './routes/cron/dispatch.js';
import cronDrainUnreconciledRoute from './routes/cron/drain-unreconciled.js';
import cronJobsSafetyNetRoute from './routes/cron/jobs-safety-net.js';
import cronMarketplacePayoutsRoute from './routes/cron/marketplace-payouts.js';
import cronPublishRoute from './routes/cron/publish-scheduled.js';
import cronReconcileCustomersRoute from './routes/cron/reconcile-customers.js';
import cronReconcileSubscriptionsRoute from './routes/cron/reconcile-subscriptions.js';
import cronSweepGraceRoute from './routes/cron/sweep-grace-periods.js';
import errorsRoute from './routes/errors.js';
import gdprRoute from './routes/gdpr.js';
import ghcrRoute from './routes/ghcr.js';
import healthRoute from './routes/health.js';
import jobsRoute from './routes/jobs/index.js';
import licenseRoute from './routes/license.js';
import logsRoute from './routes/logs.js';
import maintenanceRoute from './routes/maintenance.js';
import marketplaceRoute from './routes/marketplace.js';
import mcpUsageRoute from './routes/mcp-usage.js';
import pricingRoute from './routes/pricing.js';
import ragIndexRoute from './routes/rag-index.js';
import revmarketRoute from './routes/revmarket.js';
import studioAuthRoute from './routes/studio-auth.js';
import terminalAuthRoute from './routes/terminal-auth.js';
import { createTerminalRoute } from './routes/terminal-ws.js';
import ticketsRoute from './routes/tickets/index.js';
import webhooksRoute from './routes/webhooks.js';

// Ship warn+ logs to NeonDB in production
if (process.env.NODE_ENV === 'production') {
  logger.addLogHandler(createDbLogHandler('api'));
}

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
async function gracefulShutdown(signal: string): Promise<void> {
  logger.info(`${signal} received — shutting down`);

  // Stop alerting monitor
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
  }

  // Stop RVUI price oracle polling
  try {
    const mod = (await import('@revealui/services/revealcoin')) as Record<string, unknown>;
    if (typeof mod.stopPriceOracle === 'function') {
      (mod.stopPriceOracle as () => void)();
    }
  } catch {
    // @revealui/services not available  -  ignore
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
}

process.once('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.once('SIGINT', () => gracefulShutdown('SIGINT'));

// Validate Forge config at startup  -  exits if FORGE_* env vars are inconsistent
validateForgeConfig();

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
app.use('*', domainLockMiddleware()); // Forge: reject requests from unlicensed domains
app.use('*', requestIdMiddleware());
// Media upload routes need a higher body limit
app.use(
  '/api/content/media/*',
  bodyLimit({
    maxSize: 100 * 1024 * 1024,
    onError: (c) =>
      c.json({ success: false, error: 'File too large. Maximum size is 100MB.' }, 413),
  }),
);
app.use(
  '/api/v1/content/media/*',
  bodyLimit({
    maxSize: 100 * 1024 * 1024,
    onError: (c) =>
      c.json({ success: false, error: 'File too large. Maximum size is 100MB.' }, 413),
  }),
);
app.use(
  '*',
  bodyLimit({
    maxSize: 1024 * 1024,
    onError: (c) =>
      c.json({ success: false, error: 'Request body too large. Maximum size is 1MB.' }, 413),
  }),
);
app.use('*', honoLogger());
/** Check if origin matches Vercel preview URL pattern: https://revealui*-revealuistudios-projects.vercel.app */
function isVercelPreviewOrigin(origin: string): boolean {
  if (!origin.startsWith('https://revealui')) return false;
  return origin.endsWith('-revealuistudios-projects.vercel.app');
}

/**
 * Check if origin is a trusted desktop-app client (RevealUI Studio).
 *
 * Tauri webviews issue requests from `tauri://localhost` (Linux/Windows) or
 * `https://tauri.localhost` (macOS/Windows HTTPS mode). The Studio app ships
 * signed binaries and talks to the public API on behalf of authenticated
 * users, so its origin is allow-listed here rather than via CORS_ORIGIN env
 * (which is reserved for HTTPS web clients).
 */
function isDesktopClientOrigin(origin: string): boolean {
  return origin === 'tauri://localhost' || origin === 'https://tauri.localhost';
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

// Manual CORS middleware  -  Hono's cors() middleware was not reliably setting
// Access-Control-Allow-Origin headers in the Vercel serverless runtime.
app.use('*', async (c, next) => {
  const origin = c.req.header('origin') || c.req.header('Origin') || '';

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
    'billing-checkout': { maxRequests: 10, windowMs: FIFTEEN_MINUTES },
    'billing-upgrade': { maxRequests: 5, windowMs: FIFTEEN_MINUTES },
    'billing-downgrade': { maxRequests: 5, windowMs: FIFTEEN_MINUTES },
    'billing-checkout-perpetual': { maxRequests: 5, windowMs: ONE_MINUTE },
    'billing-portal': { maxRequests: 10, windowMs: ONE_MINUTE },
    'billing-refund': { maxRequests: 3, windowMs: ONE_MINUTE },
    'billing-rvui-payment': { maxRequests: 5, windowMs: ONE_MINUTE },
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
    webhook: { maxRequests: 100, windowMs: ONE_MINUTE },
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
app.use('/api/billing/rvui-payment', routeLimit('billing-rvui-payment'));
app.use('/api/v1/billing/rvui-payment', routeLimit('billing-rvui-payment'));
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

// Populate session if present (non-blocking  -  sets user context for all API routes)
const optionalAuth = authMiddleware({ required: false });
app.use('/api/*', optionalAuth);
app.use('/api/v1/*', optionalAuth);
// Multi-tenant context (optional by default  -  routes that require it use requireTenant())
const optionalTenant = tenantMiddleware({ required: false });
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

// Domain restriction enforcement  -  validates the request origin against the license's
// allowed domains. Skips validation when no domain restrictions exist (most licenses).
app.use('/api/*', requireDomain());
app.use('/api/v1/*', requireDomain());

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

// Write-protect mutation endpoints  -  these require authentication
const writeProtected = authMiddleware({ required: true });

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
      url: process.env.NEXT_PUBLIC_API_URL ?? process.env.API_URL ?? 'http://localhost:3004',
      description: process.env.NODE_ENV === 'production' ? 'Production' : 'Development server',
    },
  ],
});

// Self-hosted Swagger UI (no CDN, CSP-strict compatible).
// `require` here is the CJS-style require injected by tsup's banner
// (see apps/api/tsup.config.ts) so we don't import createRequire a second time.
const swaggerCss = readFileSync(require.resolve('swagger-ui-dist/swagger-ui.css'), 'utf-8');
const swaggerBundleJs = readFileSync(
  require.resolve('swagger-ui-dist/swagger-ui-bundle.js'),
  'utf-8',
);
const swaggerPresetJs = readFileSync(
  require.resolve('swagger-ui-dist/swagger-ui-standalone-preset.js'),
  'utf-8',
);
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
  c.body(swaggerCss, 200, {
    'content-type': 'text/css; charset=utf-8',
    'cache-control': IMMUTABLE_ASSET,
  }),
);
app.get('/docs/swagger-ui-bundle.js', (c) =>
  c.body(swaggerBundleJs, 200, {
    'content-type': 'application/javascript; charset=utf-8',
    'cache-control': IMMUTABLE_ASSET,
  }),
);
app.get('/docs/swagger-ui-standalone-preset.js', (c) =>
  c.body(swaggerPresetJs, 200, {
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
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
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
app.route('/api/auth', authRoute);
app.route('/api/billing', billingRoute);
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
app.route('/api/content', contentRoute);
app.route('/api/rag', ragIndexRoute);
app.route('/api/admin', adminObservabilityRoute);
app.route('/api/api-keys', apiKeysRoute);
app.route('/api/cron', cronBillingReadinessRoute);
app.route('/api/cron', cronDispatchRoute);
app.route('/api/cron', cronDrainUnreconciledRoute);
app.route('/api/cron', cronMarketplacePayoutsRoute);
app.route('/api/cron', cronPublishRoute);
app.route('/api/cron', cronReconcileCustomersRoute);
app.route('/api/cron', cronReconcileSubscriptionsRoute);
app.route('/api/cron', cronSweepGraceRoute);
app.route('/api/cron', cronCleanupRoute);
app.route('/api/cron', cronJobsSafetyNetRoute);
app.route('/api/jobs', jobsRoute);
app.route('/api/ghcr', ghcrRoute);
app.route('/api/maintenance', maintenanceRoute);
app.route('/api/marketplace', marketplaceRoute);
app.route('/api/pricing', pricingRoute);
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
// Auth required: terminal sessions give PTY access to the server
app.use('/api/terminal/*', writeProtected);
app.use('/api/terminal/*', routeLimit('terminal-sessions'));
const terminalWs = createTerminalRoute();
app.route('/api/terminal', terminalWs.app);

app.route('', createCollabRoute());
app.route('', createAgentCollabRoute());

// Versioned routes (/api/v1/*)  -  mirrors of /api/* for forward compatibility.
// Non-API routes (/.well-known, /a2a, /health) are not versioned.
app.route('/api/v1/errors', errorsRoute);
app.route('/api/v1/gdpr', gdprRoute);
app.route('/api/v1/logs', logsRoute);
app.route('/api/v1/license', licenseRoute);
app.route('/api/v1/auth', authRoute);
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
app.route('/api/v1/jobs', jobsRoute);
app.route('/api/v1/ghcr', ghcrRoute);
app.route('/api/v1/maintenance', maintenanceRoute);
app.route('/api/v1/marketplace', marketplaceRoute);
app.route('/api/v1/pricing', pricingRoute);
app.route('/api/v1/revmarket', revmarketRoute);
app.route('/api/v1/studio-auth', studioAuthRoute);

// Error handling
app.onError(errorHandler);

// For Vercel serverless
export default app;

// Alerting  -  register channels and rules, start periodic evaluation.
// Runs in both dev and prod. Console channel always active.
let monitoringInterval: NodeJS.Timeout | undefined;

function initAlerting(): void {
  alerting.addChannel(consoleChannel);

  alerting.registerRule(
    createMemoryUsageAlert(() => {
      const mem = process.memoryUsage();
      return Math.round((mem.heapUsed / mem.heapTotal) * 100);
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

// RVUI price oracle  -  start polling when Jupiter API key is configured.
// Runs in both dev and prod. Safe no-op if JUPITER_API_KEY is unset.
// Uses dynamic import to avoid hard dependency on @revealui/services build.
function initPriceOracle(): void {
  import('@revealui/services/revealcoin')
    .then((mod: Record<string, unknown>) => {
      if (typeof mod.startPriceOracle === 'function') {
        (mod.startPriceOracle as () => void)();
      }
    })
    .catch((err: unknown) => {
      logger.warn('RVUI price oracle not available', {
        error: err instanceof Error ? err.message : String(err),
      });
    });
}

// For local development (but not in test environment)
if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test') {
  // Swap in persistent audit storage (replaces default InMemoryAuditStorage)
  audit.setStorage(new PostgresAuditStorage());
  validateStartup();
  initializeLicense()
    .then((tier) => {
      logger.info(`License tier: ${tier}`);
    })
    .catch((err: unknown) => {
      logger.error(
        'License initialization failed',
        err instanceof Error ? err : new Error(String(err)),
      );
    });
  initPriceOracle();
  initAlerting();
  const port = Number(process.env.API_PORT || process.env.PORT) || 3004;
  const server = serve({ fetch: app.fetch, port });
  terminalWs.injectWebSocket(server);
  logger.info(`🚀 API server running on http://localhost:${port}`);
  logger.info(`📚 API documentation available at http://localhost:${port}/docs`);
  logger.info(`📄 OpenAPI spec available at http://localhost:${port}/openapi.json`);
}

// Configure trusted-proxy-aware client IP extraction for session-binding
// validation. See GAP-130 + packages/security/src/request-ip.ts.
// trustedProxyCount: 1 reflects the current Vercel-only proxy chain. When
// Cloudflare is added in front of api.revealui.com (GAP-133 phases 5-6), bump
// to 2 in the SAME PR as the orange-cloud cutover — leaving N=1 after Cloudflare
// goes orange = spoofable IPs again; setting N=2 before Cloudflare = garbage
// IPs / 'unknown' for everyone.
configureClientIp({ trustedProxyCount: 1 });

// Also validate in production before accepting traffic
if (process.env.NODE_ENV === 'production') {
  // Swap in persistent audit storage (replaces default InMemoryAuditStorage)
  audit.setStorage(new PostgresAuditStorage());
  validateStartup();
  initializeLicense()
    .then((tier) => {
      logger.info(`License tier: ${tier}`);
    })
    .catch((err: unknown) => {
      logger.error(
        'License initialization failed',
        err instanceof Error ? err : new Error(String(err)),
      );
    });
  initPriceOracle();
  initAlerting();
}

import { resolveSentryEnvironment } from '@revealui/core/sentry-environment';
import * as Sentry from '@sentry/node';

// Initialize Sentry before all other imports for proper instrumentation.
// Environment is not NODE_ENV: staging boots with NODE_ENV=production.
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: resolveSentryEnvironment(process.env),
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
import { closeAllPools, getClient } from '@revealui/db';
import { createDbLogHandler } from '@revealui/db/log-transport';
import { sql } from 'drizzle-orm';
import app, { corsOrigins, terminalWs } from './app.js';
import { assertDispatchFlagConfigured } from './jobs/register-handlers.js';
import {
  assertAuditStorageEnv,
  auditStorageSelfTest,
  installAuditStorage,
} from './lib/audit-storage.js';
import { hydrateInferenceConfigs } from './lib/hydrate-inference-configs.js';
import { runHostedLicenseCanary } from './lib/license-canary.js';
import { wireMcpHypervisorIfEnabled } from './lib/mcp-hypervisor-wire.js';
import {
  validateBillingCatalogAtStartup,
  validateLicenseAtStartup,
  validateStartup,
  validateStripeTaxConfigAtStartup,
} from './lib/validate-startup.js';

export {
  configureRateLimits,
  getCorsOrigins,
  isPublicCacheableCorsPath,
  terminalWs,
} from './app.js';
export default app;

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
logger.info('CORS origins loaded', { origins: corsOrigins, count: corsOrigins.length });

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

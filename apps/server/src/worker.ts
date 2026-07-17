// apps/server/src/worker.ts
//
// Fly entry point. Boots the long-running subset of the apps/server runtime —
// alerting, terminal-ws (Forge-gated), Yjs collab WS, agent-collab WS,
// RVMarket executor (flag-gated). Replaces the NODE_ENV === 'production'
// boot block that used to live in apps/server/src/index.ts and ran as a
// side effect of importing the Hono app from api/index.js on Vercel cold
// start (bound a useless port, leaked setIntervals on instance shutdown,
// attempted WS upgrades that can't function in serverless).
//
// Vercel cold-start now only executes apps/server/src/index.ts module-level
// code (Hono app composition + middleware + routes + the dev block guard
// that short-circuits when NODE_ENV === 'production'). No serve(), no
// injectWebSocket, no setIntervals, no executor poll loop.
//
// Local-dev caveat: worker.ts assumes NODE_ENV === 'production'. Running it
// with NODE_ENV === 'development' will trigger the dev block in index.ts
// AND the worker boot here = double-init. For local worker testing, set
// NODE_ENV=production explicitly: `NODE_ENV=production tsx src/worker.ts`.

import * as Sentry from '@sentry/node';

// Initialize Sentry before all other imports for proper instrumentation
// (mirrors apps/server/src/index.ts:4-20). The Vercel entry initializes
// its own Sentry instance; both honor the same SENTRY_DSN env.
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV ?? 'production',
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    beforeSend(event) {
      if (process.env.NODE_ENV !== 'production') return null;
      if (event.request?.headers) {
        const { cookie: _, authorization: __, ...safe } = event.request.headers;
        event.request.headers = safe;
      }
      return event;
    },
  });
}

import { serve } from '@hono/node-server';
import { initializeLicense } from '@revealui/core/license';
import { logger } from '@revealui/core/observability/logger';
import app, { initAlerting, terminalWs } from './index.js';
import {
  assertAuditStorageEnv,
  auditStorageSelfTest,
  installAuditStorage,
} from './lib/audit-storage.js';
import { hydrateInferenceConfigs } from './lib/hydrate-inference-configs.js';
import { runHostedLicenseCanary } from './lib/license-canary.js';
import {
  validateBillingCatalogAtStartup,
  validateLicenseAtStartup,
  validateStartup,
} from './lib/validate-startup.js';
import { startExecutor } from './services/revmarket-executor.js';

// Persistent audit storage (replaces default InMemoryAuditStorage). The env
// parity assertion fails the deploy on diverged audit-critical env; the async
// round-trip self-test below is the worker's superset check (GAP-355 Stage 1).
assertAuditStorageEnv();
installAuditStorage();

// Environment + license + billing catalog validation.
// validateLicenseAtStartup throws on invalid/expired/missing license in Forge
// mode; process.exit(1) makes the container restart-loop instead of silently
// degrading to free tier. validateBillingCatalogAtStartup runs only with
// STRIPE_LIVE_MODE=true and fails boot on missing billing_catalog rows
// (prevents mid-customer-transaction 500s). auditStorageSelfTest writes a
// synthetic event through the just-installed storage and reads it back, exiting
// the process if the round trip fails (fail-closed integrity, ADR §2a) — the
// worker boots once per deploy, so this is the deploy-time proof that the audit
// path works end to end.
validateStartup();
validateLicenseAtStartup()
  .then(() => validateBillingCatalogAtStartup())
  .then(() => auditStorageSelfTest())
  .then(() => runHostedLicenseCanary())
  .then(() => initializeLicense())
  .then((tier) => {
    logger.info(`License tier: ${tier}`);
  })
  .catch((err: unknown) => {
    logger.error(
      'Worker startup validation failed; exiting',
      err instanceof Error ? err : new Error(String(err)),
    );
    process.exit(1);
  });

initAlerting();
hydrateInferenceConfigs();

// RVMarket executor — gated on REVMARKET_EXECUTOR_ENABLED, default OFF.
// The executor's poll loop (configurable interval, default 60s) claims
// queued tasks and forks child processes per task with a 60s exec budget.
// Until the marketplace UI / pricing / payouts surface is ready for real
// customer task submissions, the executor stays dormant. Flip the env to
// 'true' when marketplace is ready to begin consuming tasks.
if (process.env.REVMARKET_EXECUTOR_ENABLED === 'true') {
  startExecutor();
} else {
  logger.info('RVMarket executor not started (set REVMARKET_EXECUTOR_ENABLED=true to enable)');
}

const port = Number(process.env.WORKER_PORT || process.env.PORT) || 8080;
const server = serve({ fetch: app.fetch, port });

// Terminal WebSocket bridge — gated on REVEALUI_FORGE, default OFF. The
// bridge proxies to a local harness daemon Unix socket at
// ~/.local/share/revealui/harness.sock; that daemon only exists in
// self-hosted/Forge deployments. Mounting on hosted SaaS would expose a
// WS endpoint with no working backend.
if (process.env.REVEALUI_FORGE === 'true') {
  terminalWs.injectWebSocket(server);
  logger.info('Terminal WebSocket bridge mounted (REVEALUI_FORGE=true)');
} else {
  logger.info('Terminal WebSocket bridge not mounted (REVEALUI_FORGE != "true")');
}

logger.info(`🚀 Worker running on http://localhost:${port}`);
logger.info(`📚 API documentation available at http://localhost:${port}/docs`);
logger.info(`📄 OpenAPI spec available at http://localhost:${port}/openapi.json`);

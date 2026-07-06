import { timingSafeEqual } from 'node:crypto';
import { getLicenseStatus } from '@revealui/core/license';
import {
  createDatabaseHealthCheck,
  createMemoryHealthCheck,
  healthCheck,
  metrics,
  trackHTTPRequest,
} from '@revealui/core/observability';
import { getClient } from '@revealui/db';
import { createRoute, OpenAPIHono, z } from '@revealui/openapi';
import { sql } from 'drizzle-orm';
import {
  corsConfigMissing,
  licenseCanaryDegraded,
  licenseCanaryDegradedReason,
} from '../lib/startup-state.js';

const app = new OpenAPIHono();

/**
 * Verify metrics access via Bearer token or X-Metrics-Secret header.
 * Uses METRICS_SECRET or CRON_SECRET env var. Returns 401 if missing or invalid.
 */
function verifyMetricsAccess(c: {
  req: { header: (name: string) => string | undefined };
}): boolean {
  const secret = process.env.METRICS_SECRET ?? process.env.CRON_SECRET;
  if (!secret) return false;

  const authHeader = c.req.header('authorization');
  const metricsHeader = c.req.header('x-metrics-secret');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : metricsHeader;

  if (!token) return false;

  const tokenBuf = Buffer.from(token);
  const secretBuf = Buffer.from(secret);
  if (tokenBuf.length !== secretBuf.length) return false;

  return timingSafeEqual(tokenBuf, secretBuf);
}

// ---------------------------------------------------------------------------
// Register health checks with the core HealthCheckSystem
// ---------------------------------------------------------------------------

healthCheck.register(
  createDatabaseHealthCheck(async () => {
    const db = getClient();
    await db.execute(sql`SELECT 1`);
  }),
);

healthCheck.register(createMemoryHealthCheck(90));

// License readiness — surfaces the otherwise-silent hosted `initializeLicense`
// free-fall (GAP-259 P0-4). When a license key is present but fails validation,
// initializeLicense degrades to free tier with keyPresentButInvalid set, which
// getLicenseStatus() reports as mode 'expired'. Reuse that state (do not
// re-derive it) and report unhealthy so /health/ready flips red — a deployment
// silently serving free tier after a broken license key is a readiness fault,
// not a healthy boot. `critical: true` so an unhealthy result drives the overall
// status to 'unhealthy' (→ 503), matching the corsConfigMissing posture.
healthCheck.register({
  name: 'license',
  critical: true,
  timeout: 1000,
  check: async () => {
    const status = getLicenseStatus();
    if (status.mode === 'expired') {
      return {
        status: 'unhealthy',
        message:
          status.reason ?? 'License key present but failed validation (degraded to free tier)',
        details: { mode: status.mode, tier: status.tier },
      };
    }
    return {
      status: 'healthy',
      message: `License mode: ${status.mode}`,
      details: { mode: status.mode, tier: status.tier },
    };
  },
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

const livenessRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['health'],
  summary: 'Liveness probe',
  description:
    'Instant response with no dependencies. Kubernetes/load balancers use this to decide whether to restart the pod.',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            status: z.string(),
            timestamp: z.string(),
            version: z.string(),
            service: z.string(),
            uptime: z.number(),
          }),
        },
      },
      description: 'Service is alive',
    },
  },
});

/**
 * Service identity for the liveness payload.
 *
 * White-label deployments (Forge customer kits) override the brand name via
 * REVEALUI_BRAND_NAME or REVEALUI_TENANT_NAME — uptime monitors / status
 * pages then show the operator's brand instead of the framework name.
 * Hosted SaaS (no overrides) keeps the canonical "RevealUI API" identity.
 */
function getServiceName(): string {
  // `||` not `??`: Compose `${VAR:-}` interpolation delivers unset vars as
  // empty strings, which must fall through to the next candidate.
  const name = process.env.REVEALUI_BRAND_NAME || process.env.REVEALUI_TENANT_NAME || 'RevealUI';
  return `${name} API`;
}

function livenessResponse() {
  return {
    status: 'ok' as const,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version ?? '1.0.0',
    service: getServiceName(),
    uptime: healthCheck.getUptime(),
  };
}

app.openapi(livenessRoute, (c) => {
  return c.json(livenessResponse());
});

const liveAliasRoute = createRoute({
  method: 'get',
  path: '/live',
  tags: ['health'],
  summary: 'Liveness probe (alias)',
  description:
    'Alias for the root liveness probe  -  used by Playwright smoke tests and some load balancer conventions.',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            status: z.string(),
            timestamp: z.string(),
            version: z.string(),
            service: z.string(),
            uptime: z.number(),
          }),
        },
      },
      description: 'Service is alive',
    },
  },
});

app.openapi(liveAliasRoute, (c) => {
  return c.json(livenessResponse());
});

const readyRoute = createRoute({
  method: 'get',
  path: '/ready',
  tags: ['health'],
  summary: 'Readiness probe',
  description:
    'Runs all registered health checks. Returns 200 when ready to serve traffic, 503 when a critical check fails.',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            status: z.string(),
            timestamp: z.string(),
            uptime: z.number(),
            checks: z.unknown(),
          }),
        },
      },
      description: 'Service is ready',
    },
    503: {
      content: {
        'application/json': {
          schema: z.object({
            status: z.string(),
            timestamp: z.string(),
            uptime: z.number(),
            checks: z.unknown(),
          }),
        },
      },
      description: 'Service is not ready',
    },
  },
});

app.openapi(readyRoute, async (c) => {
  const startTime = Date.now();
  const health = await healthCheck.checkHealth();

  // Readiness-red on: any critical check unhealthy (DB, license free-fall),
  // a missing CORS config, or a degraded hosted license canary (a jose/parse
  // fault caught at boot that keeps the process alive but must not take traffic).
  const ready = health.status !== 'unhealthy' && !corsConfigMissing && !licenseCanaryDegraded;

  const duration = Date.now() - startTime;
  trackHTTPRequest('GET', '/health/ready', ready ? 200 : 503, duration);

  // Pool metrics are internal  -  only expose to authenticated metrics endpoints.
  // The readiness probe returns status + checks only.
  return c.json(
    {
      status: health.status,
      timestamp: health.timestamp,
      uptime: health.uptime,
      checks: health.checks,
      ...(corsConfigMissing && { corsConfigMissing: true }),
      ...(licenseCanaryDegraded && {
        licenseCanaryDegraded: true,
        licenseCanaryReason: licenseCanaryDegradedReason,
      }),
    },
    ready ? 200 : 503,
  );
});

const metricsRoute = createRoute({
  method: 'get',
  path: '/metrics',
  tags: ['health'],
  summary: 'Prometheus metrics',
  description:
    'Exposes all application metrics collected by the core MetricsCollector in Prometheus text format. Requires METRICS_SECRET or CRON_SECRET authentication.',
  responses: {
    200: {
      description: 'Prometheus-compatible metrics in text/plain format',
    },
    401: {
      description: 'Unauthorized  -  missing or invalid metrics secret',
    },
  },
});

app.openapi(metricsRoute, (c) => {
  if (!verifyMetricsAccess(c)) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  return c.text(metrics.exportPrometheus(), 200, {
    'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
  });
});

const metricsJsonRoute = createRoute({
  method: 'get',
  path: '/metrics/json',
  tags: ['health'],
  summary: 'Metrics (JSON)',
  description:
    'Metrics in JSON format  -  useful for internal dashboards and debugging. Requires METRICS_SECRET or CRON_SECRET authentication.',
  responses: {
    401: {
      description: 'Unauthorized  -  missing or invalid metrics secret',
    },
    200: {
      content: {
        'application/json': {
          schema: z.unknown(),
        },
      },
      description: 'Metrics as JSON',
    },
  },
});

app.openapi(metricsJsonRoute, (c) => {
  if (!verifyMetricsAccess(c)) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  return c.json(metrics.exportJSON());
});

export default app;

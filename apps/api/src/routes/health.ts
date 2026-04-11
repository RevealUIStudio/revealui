import { timingSafeEqual } from 'node:crypto';
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
import { corsConfigMissing } from '../lib/startup-state.js';

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

function livenessResponse() {
  return {
    status: 'ok' as const,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version ?? '1.0.0',
    service: 'RevealUI API',
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

  const ready = health.status !== 'unhealthy' && !corsConfigMissing;

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

import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import {
  createDatabaseHealthCheck,
  createMemoryHealthCheck,
  healthCheck,
  metrics,
  trackHTTPRequest,
} from '@revealui/core/observability';
import { getClient, getPoolMetrics } from '@revealui/db';
import { sql } from 'drizzle-orm';

const app = new OpenAPIHono();

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
    'Alias for the root liveness probe — used by Playwright smoke tests and some load balancer conventions.',
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
            pools: z.unknown().optional(),
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
            pools: z.unknown().optional(),
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

  // Supplement with pool metrics from @revealui/db
  const pools = getPoolMetrics();

  const ready = health.status !== 'unhealthy';

  const duration = Date.now() - startTime;
  trackHTTPRequest('GET', '/health/ready', ready ? 200 : 503, duration);

  return c.json(
    {
      status: health.status,
      timestamp: health.timestamp,
      uptime: health.uptime,
      checks: health.checks,
      ...(pools.length > 0 && { pools }),
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
    'Exposes all application metrics collected by the core MetricsCollector in Prometheus text format.',
  responses: {
    200: {
      description: 'Prometheus-compatible metrics in text/plain format',
    },
  },
});

app.openapi(metricsRoute, (c) => {
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
  description: 'Metrics in JSON format — useful for internal dashboards and debugging.',
  responses: {
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
  return c.json(metrics.exportJSON());
});

export default app;

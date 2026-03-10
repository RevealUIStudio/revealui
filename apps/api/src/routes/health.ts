import {
  createDatabaseHealthCheck,
  createMemoryHealthCheck,
  healthCheck,
  metrics,
  trackHTTPRequest,
} from '@revealui/core/observability'
import { getClient, getPoolMetrics } from '@revealui/db'
import { sql } from 'drizzle-orm'
import { Hono } from 'hono'

const app = new Hono()

// ---------------------------------------------------------------------------
// Register health checks with the core HealthCheckSystem
// ---------------------------------------------------------------------------

healthCheck.register(
  createDatabaseHealthCheck(async () => {
    const db = getClient()
    await db.execute(sql`SELECT 1`)
  }),
)

healthCheck.register(createMemoryHealthCheck(90))

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/**
 * Liveness probe — instant response, no dependencies.
 * Kubernetes/load balancers use this to decide whether to restart the pod.
 */
function liveness(c: import('hono').Context) {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version ?? '1.0.0',
    service: 'RevealUI API',
    uptime: healthCheck.getUptime(),
  })
}

// Root liveness — GET /health
app.get('/', liveness)

// /live alias — used by Playwright smoke tests and some load balancer conventions
app.get('/live', liveness)

/**
 * Readiness probe — runs all registered health checks.
 * Returns 200 when ready to serve traffic, 503 when a critical check fails.
 */
app.get('/ready', async (c) => {
  const startTime = Date.now()
  const health = await healthCheck.checkHealth()

  // Supplement with pool metrics from @revealui/db
  const pools = getPoolMetrics()

  const ready = health.status !== 'unhealthy'

  const duration = Date.now() - startTime
  trackHTTPRequest('GET', '/health/ready', ready ? 200 : 503, duration)

  return c.json(
    {
      status: health.status,
      timestamp: health.timestamp,
      uptime: health.uptime,
      checks: health.checks,
      ...(pools.length > 0 && { pools }),
    },
    ready ? 200 : 503,
  )
})

/**
 * Prometheus-compatible metrics endpoint.
 * Exposes all application metrics collected by the core MetricsCollector.
 */
app.get('/metrics', (c) => {
  return c.text(metrics.exportPrometheus(), 200, {
    'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
  })
})

/**
 * Metrics in JSON format — useful for internal dashboards and debugging.
 */
app.get('/metrics/json', (c) => {
  return c.json(metrics.exportJSON())
})

export default app

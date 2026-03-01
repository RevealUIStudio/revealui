import { getClient } from '@revealui/db'
import { sql } from 'drizzle-orm'
import { Hono } from 'hono'

const app = new Hono()

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
  })
}

// Root liveness — GET /health
app.get('/', liveness)

// /live alias — used by Playwright smoke tests and some load balancer conventions
app.get('/live', liveness)

/**
 * Readiness probe — checks live dependencies.
 * Returns 200 when ready to serve traffic, 503 when a dependency is down.
 * Kubernetes uses this to decide whether to send traffic to the pod.
 */
app.get('/ready', async (c) => {
  const checks: Array<{ name: string; status: 'ok' | 'error'; message?: string }> = []
  let ready = true

  // Database connectivity
  try {
    const db = getClient()
    await db.execute(sql`SELECT 1`)
    checks.push({ name: 'database', status: 'ok' })
  } catch (err) {
    ready = false
    checks.push({
      name: 'database',
      status: 'error',
      message: err instanceof Error ? err.message : 'connection failed',
    })
  }

  // Required environment variables
  const requiredEnvVars = ['POSTGRES_URL', 'NODE_ENV']
  const missingEnv = requiredEnvVars.filter((key) => !process.env[key])
  if (missingEnv.length > 0) {
    ready = false
    checks.push({
      name: 'env',
      status: 'error',
      message: `Missing required env vars: ${missingEnv.join(', ')}`,
    })
  } else {
    checks.push({ name: 'env', status: 'ok' })
  }

  return c.json(
    {
      status: ready ? 'ready' : 'not_ready',
      timestamp: new Date().toISOString(),
      checks,
    },
    ready ? 200 : 503,
  )
})

export default app

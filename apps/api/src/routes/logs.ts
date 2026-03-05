/**
 * Log Ingestion Route — POST /api/logs
 *
 * Accepts structured log entries from CMS and other Next.js apps that cannot
 * import @revealui/db directly (Edge bundle constraints). Writes to app_logs table.
 *
 * No authentication required — internal-use endpoint, rate-limited.
 * Only persists warn/error/fatal levels. Debug/info entries are dropped.
 */

import { createRoute, OpenAPIHono } from '@hono/zod-openapi'
import { getClient } from '@revealui/db'
import { appLogs } from '@revealui/db/schema'
import { HTTPException } from 'hono/http-exception'
import { z } from 'zod/v4'

const app = new OpenAPIHono()

const LogPayloadSchema = z.object({
  level: z.enum(['warn', 'error', 'fatal']),
  message: z.string().max(2000),
  app: z.string().max(50),
  environment: z.string().max(50).optional(),
  requestId: z.string().max(255).optional(),
  data: z.record(z.string(), z.unknown()).optional(),
})

const LogResponseSchema = z.object({ received: z.boolean() })
const ErrorSchema = z.object({ error: z.string() })

const logRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['observability'],
  summary: 'Ingest a structured log entry',
  description:
    'Accepts warn/error/fatal log entries from apps that cannot write to the DB directly. Rate-limited.',
  request: {
    body: {
      content: { 'application/json': { schema: LogPayloadSchema } },
    },
  },
  responses: {
    202: {
      content: { 'application/json': { schema: LogResponseSchema } },
      description: 'Log entry accepted',
    },
    400: {
      content: { 'application/json': { schema: ErrorSchema } },
      description: 'Invalid payload',
    },
  },
})

app.openapi(logRoute, async (c) => {
  const payload = c.req.valid('json')

  const db = getClient()
  ;(async () => {
    await db.insert(appLogs).values({
      level: payload.level,
      message: payload.message,
      app: payload.app,
      environment: payload.environment ?? process.env.NODE_ENV ?? 'production',
      requestId: payload.requestId ?? null,
      userId: null, // userId is not accepted from untrusted clients
      data: payload.data ?? null,
    })
  })().catch(() => {
    /* fire-and-forget — never propagate log transport errors to callers */
  })

  return c.json({ received: true }, 202)
})

// Silently drop unknown routes under /api/logs
app.notFound((_c) => {
  throw new HTTPException(404, { message: 'Not found' })
})

export default app

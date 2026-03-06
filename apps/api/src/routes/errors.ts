/**
 * Error Capture Route
 *
 * POST /api/errors — accepts structured error payloads from CMS client-side
 * and any other app that can't write to the DB directly.
 *
 * No authentication required — errors can occur before login.
 * Protected by a dedicated IP rate limit (50 req/min) to prevent abuse.
 */

import { logger } from '@revealui/core/observability/logger'
import { getClient } from '@revealui/db'
import { errorEvents } from '@revealui/db/schema'
import { Hono } from 'hono'
import { z } from 'zod/v4'

const app = new Hono()

const ErrorPayloadSchema = z.object({
  level: z.enum(['warn', 'error', 'fatal']).default('error'),
  message: z.string().max(2000),
  stack: z.string().max(10_000).optional(),
  app: z.string().max(50),
  context: z.string().max(50).optional(),
  environment: z.string().max(50).optional(),
  url: z.string().max(2000).optional(),
  requestId: z.string().max(255).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

app.post('/', async (c) => {
  // Verify shared secret — rejects requests not originating from trusted RevealUI apps
  const token = c.req.header('X-Internal-Token')
  const secret = process.env.REVEALUI_SECRET
  if (!(secret && token) || token !== secret) {
    return c.json({ success: false, error: 'Forbidden' }, 403)
  }

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ success: false, error: 'Invalid JSON' }, 400)
  }

  const parsed = ErrorPayloadSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ success: false, error: 'Invalid payload' }, 400)
  }

  const { level, message, stack, app: appName, context, url, requestId, metadata } = parsed.data
  const environment = parsed.data.environment ?? process.env.NODE_ENV ?? 'production'

  // Fire-and-forget — never fail the caller if DB write fails
  ;(async () => {
    try {
      const db = getClient()
      await db.insert(errorEvents).values({
        id: crypto.randomUUID(),
        level,
        message,
        stack,
        app: appName,
        context,
        environment,
        url,
        userId: null, // userId is not accepted from untrusted clients
        requestId,
        metadata: metadata ?? null,
      })
    } catch (err) {
      logger.error(
        'error-capture: failed to persist error event',
        err instanceof Error ? err : new Error(String(err)),
      )
    }
  })()

  return c.json({ success: true }, 202)
})

export default app

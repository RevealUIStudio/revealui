/**
 * Log Ingestion Route  -  POST /api/logs
 *
 * Accepts structured log entries from admin and other Next.js apps that cannot
 * import @revealui/db directly (Edge bundle constraints). Writes to app_logs table.
 *
 * No authentication required  -  internal-use endpoint, rate-limited.
 * Only persists warn/error/fatal levels. Debug/info entries are dropped.
 */

import { getClient } from '@revealui/db';
import { appLogs } from '@revealui/db/schema';
import { createRoute, OpenAPIHono } from '@revealui/openapi';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod/v4';

// Minimal stderr fallback  -  avoids importing the full logger bundle in this hot path
function logTransportError(err: unknown): void {
  process.stderr.write(
    `[log-ingest] failed to persist log entry: ${err instanceof Error ? err.message : String(err)}\n`,
  );
}

const app = new OpenAPIHono();

const LogPayloadSchema = z.object({
  level: z.enum(['warn', 'error', 'fatal']),
  message: z
    .string()
    .max(2000)
    .transform((s) => s.replace(/[\r\n]/g, ' ')),
  app: z.string().max(50),
  environment: z.string().max(50).optional(),
  requestId: z.string().max(255).optional(),
  data: z.record(z.string(), z.unknown()).optional(),
});

const LogResponseSchema = z.object({ received: z.boolean() });
const ErrorSchema = z.object({ error: z.string() });

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
    403: {
      content: { 'application/json': { schema: ErrorSchema } },
      description: 'Forbidden  -  missing or invalid X-Internal-Token',
    },
  },
});

app.openapi(logRoute, async (c) => {
  // Verify shared secret  -  rejects requests not originating from trusted RevealUI apps
  const { timingSafeEqual } = await import('node:crypto');
  const token = c.req.header('X-Internal-Token');
  const secret = process.env.REVEALUI_SECRET;
  if (!(secret && token)) {
    throw new HTTPException(403, { message: 'Forbidden' });
  }
  const a = Buffer.from(token);
  const b = Buffer.from(secret);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new HTTPException(403, { message: 'Forbidden' });
  }

  const payload = c.req.valid('json');

  const db = getClient();
  (async () => {
    await db.insert(appLogs).values({
      level: payload.level,
      message: payload.message,
      app: payload.app,
      environment: payload.environment ?? process.env.NODE_ENV ?? 'production',
      requestId: payload.requestId ?? null,
      userId: null, // userId is not accepted from untrusted clients
      data: payload.data ?? null,
    });
  })().catch((err: unknown) => {
    // Fire-and-forget  -  never propagate log transport errors to callers,
    // but do record the failure so it surfaces in process monitoring.
    logTransportError(err);
  });

  return c.json({ received: true }, 202);
});

// Silently drop unknown routes under /api/logs
app.notFound((_c) => {
  throw new HTTPException(404, { message: 'Not found' });
});

export default app;

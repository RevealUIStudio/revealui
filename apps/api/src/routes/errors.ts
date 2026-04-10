/**
 * Error Capture Route
 *
 * POST /api/errors — accepts structured error payloads from admin client-side
 * and any other app that can't write to the DB directly.
 *
 * No authentication required — errors can occur before login.
 * Protected by a dedicated IP rate limit (50 req/min) to prevent abuse.
 */

import { timingSafeEqual } from 'node:crypto';
import { logger } from '@revealui/core/observability/logger';
import { getClient } from '@revealui/db';
import { errorEvents } from '@revealui/db/schema';
import { createRoute, OpenAPIHono, z } from '@revealui/openapi';

const app = new OpenAPIHono();

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
});

const captureErrorRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['errors'],
  summary: 'Capture client-side error',
  description:
    'Accepts structured error payloads from admin client-side and any other app that cannot write to the DB directly. Requires X-Internal-Token header.',
  request: {
    body: {
      content: {
        'application/json': {
          schema: ErrorPayloadSchema,
        },
      },
    },
  },
  responses: {
    202: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(true),
          }),
        },
      },
      description: 'Error accepted for processing',
    },
    400: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(false),
            error: z.string(),
          }),
        },
      },
      description: 'Invalid JSON or payload',
    },
    403: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.literal(false),
            error: z.string(),
          }),
        },
      },
      description: 'Forbidden — invalid or missing internal token',
    },
  },
});

app.openapi(captureErrorRoute, async (c) => {
  // Verify shared secret — rejects requests not originating from trusted RevealUI apps
  const token = c.req.header('X-Internal-Token');
  const secret = process.env.REVEALUI_SECRET;
  if (!(secret && token)) {
    return c.json({ success: false as const, error: 'Forbidden' }, 403);
  }
  // Use timing-safe comparison to prevent character-by-character brute force
  const tokenBuf = Buffer.from(token);
  const secretBuf = Buffer.from(secret);
  if (tokenBuf.length !== secretBuf.length || !timingSafeEqual(tokenBuf, secretBuf)) {
    return c.json({ success: false as const, error: 'Forbidden' }, 403);
  }

  const body = c.req.valid('json');

  const { level, message, stack, app: appName, context, url, requestId, metadata } = body;
  const environment = body.environment ?? process.env.NODE_ENV ?? 'production';

  // Fire-and-forget — never fail the caller if DB write fails
  (async () => {
    try {
      const db = getClient();
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
      });
    } catch (err) {
      logger.error(
        'error-capture: failed to persist error event',
        err instanceof Error ? err : new Error(String(err)),
      );
    }
  })();

  return c.json({ success: true as const }, 202);
});

export default app;

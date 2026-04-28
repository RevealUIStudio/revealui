/**
 * Maintenance Routes  -  Cross-DB orphan cleanup cron endpoint
 *
 * Removes orphaned vector data (Supabase) for sites that have been
 * soft-deleted in NeonDB. Called by a Vercel cron job or external scheduler.
 * Protected by X-Cron-Secret header (REVEALUI_CRON_SECRET env var).
 */

import { logger } from '@revealui/core/observability/logger';
import { getRestClient, getVectorClient } from '@revealui/db';
import { cleanupOrphanedVectorData } from '@revealui/db/cleanup';
import { createRoute, OpenAPIHono, z } from '@revealui/openapi';
import { HTTPException } from 'hono/http-exception';

const app = new OpenAPIHono();

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const CleanupResultSchema = z.object({
  agentMemoriesDeleted: z
    .number()
    .openapi({ description: 'Number of orphaned agent memories deleted' }),
  ragDocumentsDeleted: z
    .number()
    .openapi({ description: 'Number of orphaned RAG documents deleted' }),
  ragChunksDeleted: z.number().openapi({ description: 'Number of orphaned RAG chunks deleted' }),
  deletedSiteIds: z
    .array(z.string())
    .openapi({ description: 'Site IDs whose orphaned data was cleaned up' }),
  dryRun: z.boolean().openapi({ description: 'Whether this was a dry-run (no actual deletions)' }),
});

const ErrorSchema = z.object({
  error: z.string(),
});

// ---------------------------------------------------------------------------
// POST /cleanup-orphans  -  Cross-DB orphan cleanup (internal cron)
// ---------------------------------------------------------------------------

const cleanupOrphansRoute = createRoute({
  method: 'post',
  path: '/cleanup-orphans',
  tags: ['maintenance'],
  summary: 'Clean up orphaned vector data (internal cron)',
  description:
    'Removes orphaned Supabase vector data (agent memories, RAG documents, RAG chunks) ' +
    'for sites that have been soft-deleted in NeonDB. Protected by X-Cron-Secret.',
  responses: {
    200: {
      content: { 'application/json': { schema: CleanupResultSchema } },
      description: 'Cleanup completed successfully',
    },
    403: {
      content: { 'application/json': { schema: ErrorSchema } },
      description: 'Invalid cron secret',
    },
    500: {
      content: { 'application/json': { schema: ErrorSchema } },
      description: 'Cleanup failed',
    },
  },
});

app.openapi(cleanupOrphansRoute, async (c) => {
  const { timingSafeEqual } = await import('node:crypto');
  const cronSecret = process.env.REVEALUI_CRON_SECRET;
  const provided = c.req.header('X-Cron-Secret');

  if (!(cronSecret && provided)) {
    throw new HTTPException(403, { message: 'Forbidden' });
  }
  const a = Buffer.from(provided);
  const b = Buffer.from(cronSecret);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new HTTPException(403, { message: 'Forbidden' });
  }

  try {
    const restDb = getRestClient();
    const vectorDb = getVectorClient();

    const result = await cleanupOrphanedVectorData(restDb, vectorDb);

    logger.info('Cross-DB orphan cleanup completed', {
      agentMemoriesDeleted: result.agentMemoriesDeleted,
      ragDocumentsDeleted: result.ragDocumentsDeleted,
      ragChunksDeleted: result.ragChunksDeleted,
      deletedSiteIds: result.deletedSiteIds.length,
      dryRun: result.dryRun,
    });

    return c.json(result, 200);
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error('Cross-DB orphan cleanup failed', error);
    return c.json({ error: 'Cross-DB orphan cleanup failed' }, 500);
  }
});

export default app;

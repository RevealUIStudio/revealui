/**
 * Batch operations for content collections.
 *
 * POST /api/content/batch/create — Create multiple items in one request
 * POST /api/content/batch/update — Update multiple items
 * POST /api/content/batch/delete — Delete multiple items
 *
 * All operations are admin-only and rate-limited.
 * Max 100 items per batch request.
 */

import { logger } from '@revealui/core/observability/logger';
import * as mediaQueries from '@revealui/db/queries/media';
import * as pageQueries from '@revealui/db/queries/pages';
import * as postQueries from '@revealui/db/queries/posts';
import * as siteQueries from '@revealui/db/queries/sites';
import { createRoute, OpenAPIHono, z } from '@revealui/openapi';
import { HTTPException } from 'hono/http-exception';
import type { ContentVariables } from './index.js';

const app = new OpenAPIHono<{ Variables: ContentVariables }>();

// =============================================================================
// Batch Configuration
// =============================================================================

interface BatchConfig {
  maxItems: number;
}

const DEFAULT_BATCH_CONFIG: BatchConfig = {
  maxItems: 100,
};

let batchConfig: BatchConfig = { ...DEFAULT_BATCH_CONFIG };

/** Override batch limits (useful for tests) */
export function configureBatch(overrides: Partial<BatchConfig>): void {
  batchConfig = { ...DEFAULT_BATCH_CONFIG, ...overrides };
}

// =============================================================================
// Constants
// =============================================================================

const ALLOWED_COLLECTIONS = ['posts', 'pages', 'sites', 'media'] as const;
type CollectionName = (typeof ALLOWED_COLLECTIONS)[number];

function isAllowedCollection(value: string): value is CollectionName {
  return (ALLOWED_COLLECTIONS as readonly string[]).includes(value);
}

// =============================================================================
// Batch Schemas
// =============================================================================

const BatchResultItemSchema = z.object({
  id: z.string(),
  status: z.enum(['created', 'updated', 'deleted', 'error']),
  error: z.string().optional(),
});

const BatchResponseSchema = z.object({
  success: z.literal(true),
  results: z.array(BatchResultItemSchema),
});

const ErrorSchema = z.object({ success: z.literal(false), error: z.string() });

// =============================================================================
// Collection Operations
// =============================================================================

interface BatchResult {
  id: string;
  status: 'created' | 'updated' | 'deleted' | 'error';
  error?: string;
}

type DatabaseClient = Parameters<typeof postQueries.createPost>[0];

async function batchCreate(
  db: DatabaseClient,
  collection: CollectionName,
  items: Array<Record<string, unknown>>,
  userId: string,
): Promise<BatchResult[]> {
  const results: BatchResult[] = [];

  for (const item of items) {
    const id = (item.id as string) || crypto.randomUUID();
    try {
      switch (collection) {
        case 'posts':
          await postQueries.createPost(db, {
            id,
            title: String(item.title ?? ''),
            slug: String(item.slug ?? ''),
            excerpt: item.excerpt != null ? String(item.excerpt) : undefined,
            content: item.content,
            status: item.status != null ? String(item.status) : undefined,
            authorId: userId,
          });
          break;
        case 'sites':
          await siteQueries.createSite(db, {
            id,
            name: String(item.name ?? ''),
            slug: String(item.slug ?? ''),
            description: item.description != null ? String(item.description) : undefined,
            status: item.status != null ? String(item.status) : undefined,
            ownerId: userId,
          });
          break;
        case 'pages':
          await pageQueries.createPage(db, {
            id,
            siteId: String(item.siteId ?? ''),
            title: String(item.title ?? ''),
            slug: String(item.slug ?? ''),
            path: String(item.path ?? '/'),
            status: item.status != null ? String(item.status) : undefined,
          });
          break;
        case 'media':
          await mediaQueries.createMedia(db, {
            id,
            filename: String(item.filename ?? ''),
            mimeType: String(item.mimeType ?? 'application/octet-stream'),
            url: String(item.url ?? ''),
            alt: item.alt != null ? String(item.alt) : undefined,
            uploadedBy: userId,
          });
          break;
      }
      results.push({ id, status: 'created' });
    } catch (err) {
      logger.error('Batch create failed for item', undefined, {
        id,
        collection,
        error: err instanceof Error ? err.message : String(err),
      });
      results.push({
        id,
        status: 'error',
        error: 'Operation failed',
      });
    }
  }

  return results;
}

async function batchUpdate(
  db: DatabaseClient,
  collection: CollectionName,
  items: Array<Record<string, unknown>>,
): Promise<BatchResult[]> {
  const results: BatchResult[] = [];

  for (const item of items) {
    const id = String(item.id ?? '');
    if (!id) {
      results.push({ id: '(missing)', status: 'error', error: 'Item id is required for update' });
      continue;
    }
    try {
      // Strip id from the data to avoid overwriting primary key
      const { id: _itemId, ...data } = item;
      let updated: unknown;

      switch (collection) {
        case 'posts':
          updated = await postQueries.updatePost(db, id, data);
          break;
        case 'sites':
          updated = await siteQueries.updateSite(db, id, data);
          break;
        case 'pages':
          updated = await pageQueries.updatePage(db, id, data);
          break;
        case 'media':
          updated = await mediaQueries.updateMedia(db, id, data);
          break;
      }

      if (!updated) {
        results.push({ id, status: 'error', error: `${collection.slice(0, -1)} not found` });
      } else {
        results.push({ id, status: 'updated' });
      }
    } catch (err) {
      logger.error('Batch update failed for item', undefined, {
        id,
        collection,
        error: err instanceof Error ? err.message : String(err),
      });
      results.push({
        id,
        status: 'error',
        error: 'Operation failed',
      });
    }
  }

  return results;
}

async function batchDelete(
  db: DatabaseClient,
  collection: CollectionName,
  items: Array<Record<string, unknown>>,
): Promise<BatchResult[]> {
  const results: BatchResult[] = [];

  for (const item of items) {
    const id = String(item.id ?? '');
    if (!id) {
      results.push({ id: '(missing)', status: 'error', error: 'Item id is required for delete' });
      continue;
    }
    try {
      switch (collection) {
        case 'posts':
          await postQueries.deletePost(db, id);
          break;
        case 'sites':
          await siteQueries.deleteSite(db, id);
          break;
        case 'pages':
          await pageQueries.deletePage(db, id);
          break;
        case 'media':
          await mediaQueries.deleteMedia(db, id);
          break;
      }
      results.push({ id, status: 'deleted' });
    } catch (err) {
      logger.error('Batch delete failed for item', undefined, {
        id,
        collection,
        error: err instanceof Error ? err.message : String(err),
      });
      results.push({
        id,
        status: 'error',
        error: 'Operation failed',
      });
    }
  }

  return results;
}

// =============================================================================
// Batch Routes
// =============================================================================

// POST /batch/create
app.openapi(
  createRoute({
    method: 'post',
    path: '/batch/create',
    tags: ['content'],
    summary: 'Batch create items in a collection',
    request: {
      body: {
        content: {
          'application/json': {
            schema: z.object({
              collection: z.string().openapi({ example: 'posts' }),
              items: z.array(z.record(z.string(), z.unknown())).min(1),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        content: { 'application/json': { schema: BatchResponseSchema } },
        description: 'Batch create results',
      },
      400: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Bad request' },
    },
  }),
  async (c) => {
    const db = c.get('db');
    const user = c.get('user');
    if (!user) throw new HTTPException(401, { message: 'Authentication required' });
    if (user.role !== 'admin') throw new HTTPException(403, { message: 'Admin access required' });

    const { collection, items } = c.req.valid('json');

    if (!isAllowedCollection(collection)) {
      throw new HTTPException(400, {
        message: `Invalid collection: ${collection}. Allowed: ${ALLOWED_COLLECTIONS.join(', ')}`,
      });
    }

    if (items.length > batchConfig.maxItems) {
      throw new HTTPException(400, {
        message: `Too many items: ${items.length}. Maximum: ${batchConfig.maxItems}`,
      });
    }

    const results = await db.transaction(async (tx) => {
      return batchCreate(tx as unknown as DatabaseClient, collection, items, user.id);
    });
    return c.json({ success: true as const, results }, 200);
  },
);

// POST /batch/update
app.openapi(
  createRoute({
    method: 'post',
    path: '/batch/update',
    tags: ['content'],
    summary: 'Batch update items in a collection',
    request: {
      body: {
        content: {
          'application/json': {
            schema: z.object({
              collection: z.string().openapi({ example: 'posts' }),
              items: z.array(z.object({ id: z.string() }).catchall(z.unknown())).min(1),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        content: { 'application/json': { schema: BatchResponseSchema } },
        description: 'Batch update results',
      },
      400: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Bad request' },
    },
  }),
  async (c) => {
    const db = c.get('db');
    const user = c.get('user');
    if (!user) throw new HTTPException(401, { message: 'Authentication required' });
    if (user.role !== 'admin') throw new HTTPException(403, { message: 'Admin access required' });

    const { collection, items } = c.req.valid('json');

    if (!isAllowedCollection(collection)) {
      throw new HTTPException(400, {
        message: `Invalid collection: ${collection}. Allowed: ${ALLOWED_COLLECTIONS.join(', ')}`,
      });
    }

    if (items.length > batchConfig.maxItems) {
      throw new HTTPException(400, {
        message: `Too many items: ${items.length}. Maximum: ${batchConfig.maxItems}`,
      });
    }

    const results = await db.transaction(async (tx) => {
      return batchUpdate(tx as unknown as DatabaseClient, collection, items);
    });
    return c.json({ success: true as const, results }, 200);
  },
);

// POST /batch/delete
app.openapi(
  createRoute({
    method: 'post',
    path: '/batch/delete',
    tags: ['content'],
    summary: 'Batch delete items in a collection',
    request: {
      body: {
        content: {
          'application/json': {
            schema: z.object({
              collection: z.string().openapi({ example: 'posts' }),
              items: z.array(z.object({ id: z.string() })).min(1),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        content: { 'application/json': { schema: BatchResponseSchema } },
        description: 'Batch delete results',
      },
      400: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Bad request' },
    },
  }),
  async (c) => {
    const db = c.get('db');
    const user = c.get('user');
    if (!user) throw new HTTPException(401, { message: 'Authentication required' });
    if (user.role !== 'admin') throw new HTTPException(403, { message: 'Admin access required' });

    const { collection, items } = c.req.valid('json');

    if (!isAllowedCollection(collection)) {
      throw new HTTPException(400, {
        message: `Invalid collection: ${collection}. Allowed: ${ALLOWED_COLLECTIONS.join(', ')}`,
      });
    }

    if (items.length > batchConfig.maxItems) {
      throw new HTTPException(400, {
        message: `Too many items: ${items.length}. Maximum: ${batchConfig.maxItems}`,
      });
    }

    const results = await db.transaction(async (tx) => {
      return batchDelete(tx as unknown as DatabaseClient, collection, items);
    });
    return c.json({ success: true as const, results }, 200);
  },
);

export default app;

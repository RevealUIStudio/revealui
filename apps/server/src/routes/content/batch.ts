/**
 * Batch operations for content collections.
 *
 * POST /api/content/batch/create  -  Create multiple items in one request
 * POST /api/content/batch/update  -  Update multiple items
 * POST /api/content/batch/delete  -  Delete multiple items
 *
 * All operations are admin-only and rate-limited.
 * Max 100 items per batch request.
 */

import { validateBlocks, validateContent } from '@revealui/contracts/content-validation';
import { getExplicitDeploymentMode } from '@revealui/core/deployment-mode';
import { logger } from '@revealui/core/observability/logger';
import { withTransaction } from '@revealui/db';
import * as mediaQueries from '@revealui/db/queries/media';
import * as pageQueries from '@revealui/db/queries/pages';
import * as postQueries from '@revealui/db/queries/posts';
import * as siteQueries from '@revealui/db/queries/sites';
import { createRoute, OpenAPIHono, z } from '@revealui/openapi';
import { HTTPException } from 'hono/http-exception';
import { canAdministerAllContent } from '../../lib/access.js';
import { hasApiRole } from '../../lib/api-roles.js';
import {
  MediaPatchSchema,
  PageCreateSchema,
  PagePatchSchema,
  PostCreateSchema,
  PostPatchSchema,
  SiteCreateSchema,
  SitePatchSchema,
} from '../_helpers/content-schemas.js';
import type { ContentVariables } from './index.js';
import { validateSiteCreation } from './sites.js';

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

async function getMutationActor(db: DatabaseClient, userId: string) {
  const actor = await siteQueries.getSiteContentActor(db, userId);
  return actor?.id && actor.role ? { ...actor, id: String(actor.id), role: actor.role } : null;
}

function safeMutationError(error: unknown): string {
  if (error instanceof z.ZodError) return 'Invalid mutation fields';
  if (
    error instanceof Error &&
    'code' in error &&
    ['SITE_MUTATION_PROTECTED', 'SITE_DOMAIN_CLEANUP_REQUIRED'].includes(String(error.code))
  )
    return error.message;
  return 'Operation failed';
}

function requireValidContent(value: unknown, blocks = false): void {
  if (value === undefined) return;
  const result = blocks ? validateBlocks(value) : validateContent(value);
  if (!result.valid) throw new siteQueries.SiteMutationProtectedError('Content validation failed');
}

async function requireContentMutationAuthority(
  db: DatabaseClient,
  userId: string,
  ownerId: string | null,
) {
  const actor = await getMutationActor(db, userId);
  if (!actor || (!hasApiRole(actor, 'admin') && ownerId !== userId))
    throw new siteQueries.SiteMutationProtectedError('Current content authority required.');
}

async function requireSiteMutationAuthority(
  db: DatabaseClient,
  userId: string,
  siteId: string,
  action: 'edit' | 'admin',
) {
  const actor = await getMutationActor(db, userId);
  if (
    !(await siteQueries.actorCanManageSite(db, actor, siteId, getExplicitDeploymentMode(), action))
  )
    throw new siteQueries.SiteMutationProtectedError('Current site authority required.');
}

async function batchCreate(
  db: DatabaseClient,
  collection: CollectionName,
  items: Array<Record<string, unknown>>,
  userId: string,
): Promise<BatchResult[]> {
  const results: BatchResult[] = [];

  for (const item of items) {
    const id = crypto.randomUUID();
    try {
      switch (collection) {
        case 'posts': {
          const data = PostCreateSchema.parse(item);
          requireValidContent(data.content);
          await postQueries.createPost(db, {
            id,
            ...data,
            authorId: userId,
          });
          break;
        }
        case 'sites': {
          const data = SiteCreateSchema.parse(item);
          await validateSiteCreation(db, userId, data);
          const created = await siteQueries.createSite(db, {
            id,
            ...data,
            ownerId: userId,
          });
          if (!created)
            throw new Error('This site address is already in use. Choose another address.');
          break;
        }
        case 'pages': {
          const { siteId, ...data } = PageCreateSchema.extend({ siteId: z.string().min(1) }).parse(
            item,
          );
          requireValidContent(data.blocks, true);
          await requireSiteMutationAuthority(db, userId, siteId, 'edit');
          await pageQueries.createPage(db, {
            id,
            siteId,
            ...data,
            createdBy: userId,
          });
          break;
        }
        case 'media':
          throw new siteQueries.SiteMutationProtectedError(
            'Batch media creation is unsupported. Use the media upload endpoint.',
          );
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
        error: safeMutationError(err),
      });
    }
  }

  return results;
}

async function batchUpdate(
  db: DatabaseClient,
  collection: CollectionName,
  items: Array<Record<string, unknown>>,
  userId: string,
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
        case 'posts': {
          const input = PostPatchSchema.parse(data);
          requireValidContent(input.content);
          const existing = await postQueries.getPostById(db, id);
          if (!existing) throw new Error('Post not found');
          await requireContentMutationAuthority(db, userId, existing.authorId);
          updated = await postQueries.updatePost(db, id, {
            ...input,
            publishedAt:
              input.publishedAt == null ? input.publishedAt : new Date(input.publishedAt),
          });
          break;
        }
        case 'sites':
          await requireSiteMutationAuthority(db, userId, id, 'admin');
          updated = await siteQueries.updateSite(db, id, SitePatchSchema.parse(data));
          break;
        case 'pages': {
          const input = PagePatchSchema.parse(data);
          requireValidContent(input.blocks, true);
          const existing = await pageQueries.getPageById(db, id);
          if (!existing) throw new Error('Page not found');
          await requireSiteMutationAuthority(db, userId, existing.siteId, 'edit');
          updated = await pageQueries.updatePage(db, id, {
            ...input,
            publishedAt:
              input.publishedAt == null ? input.publishedAt : new Date(input.publishedAt),
          });
          break;
        }
        case 'media': {
          const input = MediaPatchSchema.parse(data);
          const existing = await mediaQueries.getMediaById(db, id);
          if (!existing) throw new Error('Media not found');
          await requireContentMutationAuthority(db, userId, existing.uploadedBy);
          updated = await mediaQueries.updateMedia(db, id, input);
          break;
        }
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
        error: safeMutationError(err),
      });
    }
  }

  return results;
}

async function batchDelete(
  db: DatabaseClient,
  collection: CollectionName,
  items: Array<Record<string, unknown>>,
  userId: string,
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
        case 'posts': {
          const existing = await postQueries.getPostById(db, id);
          if (!existing) throw new Error('Post not found');
          await requireContentMutationAuthority(db, userId, existing.authorId);
          await postQueries.deletePost(db, id);
          break;
        }
        case 'sites':
          await requireSiteMutationAuthority(db, userId, id, 'admin');
          await siteQueries.deleteSite(db, id);
          break;
        case 'pages': {
          const existing = await pageQueries.getPageById(db, id);
          if (!existing) throw new Error('Page not found');
          await requireSiteMutationAuthority(db, userId, existing.siteId, 'edit');
          await pageQueries.deletePage(db, id);
          break;
        }
        case 'media':
          throw new siteQueries.SiteMutationProtectedError(
            'Batch media deletion is unsupported. Use the media delete endpoint.',
          );
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
        error: safeMutationError(err),
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
    description:
      'Supports posts, pages and sites using the direct mutation contracts. Media creation requires the media upload endpoint. Each item reports its own result.',
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
    const actor = await getMutationActor(db, user.id);
    if (!(canAdministerAllContent(user) && canAdministerAllContent(actor)))
      throw new HTTPException(403, { message: 'Admin access required' });

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

    const results = await withTransaction(db, async (tx) => {
      return batchCreate(tx, collection, items, user.id);
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
    description:
      'Supports posts, pages, sites and media metadata using the direct mutation contracts and current per-item authority.',
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
    const actor = await getMutationActor(db, user.id);
    if (!(canAdministerAllContent(user) && canAdministerAllContent(actor)))
      throw new HTTPException(403, { message: 'Admin access required' });

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

    const results = await withTransaction(db, async (tx) => {
      return batchUpdate(tx, collection, items, user.id);
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
    description:
      'Supports posts, pages and sites. Detach consultation hostnames before deleting sites. Media deletion requires the media delete endpoint so storage cleanup runs.',
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
    const actor = await getMutationActor(db, user.id);
    if (!(canAdministerAllContent(user) && canAdministerAllContent(actor)))
      throw new HTTPException(403, { message: 'Admin access required' });

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

    const results = await withTransaction(db, async (tx) => {
      return batchDelete(tx, collection, items, user.id);
    });
    return c.json({ success: true as const, results }, 200);
  },
);

export default app;

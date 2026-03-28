/**
 * Site CRUD routes
 *
 * GET|POST /sites
 * GET|PATCH|DELETE /sites/:id
 */

import { SITE_STATUSES } from '@revealui/contracts/entities';
import { cleanupVectorDataForSite } from '@revealui/db/cleanup';
import * as siteQueries from '@revealui/db/queries/sites';
import { createRoute, OpenAPIHono, z } from '@revealui/openapi';
import { HTTPException } from 'hono/http-exception';
import { asNonEmptyTuple } from '../../lib/type-guards.js';
import { ErrorSchema, IdParam, SlugField } from '../_helpers/content-schemas.js';
import { PaginationQuery } from '../_helpers/pagination.js';
import { dateToString, nullableDateToString } from '../_helpers/serialize.js';
import type { ContentVariables } from './index.js';

const app = new OpenAPIHono<{ Variables: ContentVariables }>();

// =============================================================================
// Site Schemas
// =============================================================================

const SiteSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
    description: z.string().nullable(),
    ownerId: z.string(),
    status: z.enum(asNonEmptyTuple(SITE_STATUSES)),
    theme: z.unknown().nullable(),
    settings: z.unknown().nullable(),
    pageCount: z.number().nullable(),
    favicon: z.string().nullable(),
    createdAt: z.string().openapi({ type: 'string', format: 'date-time' }),
    updatedAt: z.string().openapi({ type: 'string', format: 'date-time' }),
    publishedAt: z.string().nullable().openapi({ type: 'string', format: 'date-time' }),
  })
  .openapi('Site');

type SerializedSite = z.infer<typeof SiteSchema>;

function serializeSite(
  site: NonNullable<Awaited<ReturnType<typeof siteQueries.getSiteById>>>,
): SerializedSite {
  return {
    id: site.id,
    name: site.name,
    slug: site.slug,
    description: site.description ?? null,
    ownerId: site.ownerId,
    status: site.status as SerializedSite['status'],
    theme: site.theme ?? null,
    settings: site.settings ?? null,
    pageCount: site.pageCount ?? null,
    favicon: site.favicon ?? null,
    createdAt: dateToString(site.createdAt),
    updatedAt: dateToString(site.updatedAt),
    publishedAt: nullableDateToString(site.publishedAt),
  };
}

// =============================================================================
// Site Routes
// =============================================================================

// GET /sites
app.openapi(
  createRoute({
    method: 'get',
    path: '/sites',
    tags: ['content'],
    summary: 'List sites',
    request: {
      query: PaginationQuery.extend({
        status: z.enum(asNonEmptyTuple(SITE_STATUSES)).optional().openapi({ example: 'published' }),
      }),
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({ success: z.literal(true), data: z.array(SiteSchema) }),
          },
        },
        description: 'Site list',
      },
    },
  }),
  async (c) => {
    const db = c.get('db');
    const user = c.get('user');
    if (!user) throw new HTTPException(401, { message: 'Authentication required' });
    const { status, limit, offset } = c.req.valid('query');
    const data = await siteQueries.getAllSites(db, { ownerId: user.id, status, limit, offset });
    return c.json({ success: true as const, data: data.map(serializeSite) }, 200);
  },
);

// POST /sites
app.openapi(
  createRoute({
    method: 'post',
    path: '/sites',
    tags: ['content'],
    summary: 'Create a site',
    request: {
      body: {
        content: {
          'application/json': {
            schema: z.object({
              name: z.string().min(1).max(200),
              slug: SlugField,
              description: z.string().max(1000).optional(),
              status: z.enum(asNonEmptyTuple(SITE_STATUSES)).optional(),
            }),
          },
        },
      },
    },
    responses: {
      201: {
        content: {
          'application/json': {
            schema: z.object({ success: z.literal(true), data: SiteSchema }),
          },
        },
        description: 'Site created',
      },
    },
  }),
  async (c) => {
    const db = c.get('db');
    const user = c.get('user');
    if (!user) throw new HTTPException(401, { message: 'Authentication required' });
    const body = c.req.valid('json');
    const site = await siteQueries.createSite(db, {
      id: crypto.randomUUID(),
      ownerId: user.id,
      ...body,
    });
    // biome-ignore lint/style/noNonNullAssertion: createSite always returns the created row
    return c.json({ success: true as const, data: serializeSite(site!) }, 201);
  },
);

// GET /sites/:id
app.openapi(
  createRoute({
    method: 'get',
    path: '/sites/{id}',
    tags: ['content'],
    summary: 'Get a site by ID',
    request: { params: IdParam },
    responses: {
      200: {
        content: {
          'application/json': { schema: z.object({ success: z.literal(true), data: SiteSchema }) },
        },
        description: 'Site found',
      },
      404: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Not found' },
    },
  }),
  async (c) => {
    const db = c.get('db');
    const user = c.get('user');
    if (!user) throw new HTTPException(401, { message: 'Authentication required' });
    const { id } = c.req.valid('param');
    const site = await siteQueries.getSiteById(db, id);
    if (!site) throw new HTTPException(404, { message: 'Site not found' });
    if (user.role !== 'admin' && site.ownerId !== user.id) {
      throw new HTTPException(403, { message: 'Forbidden' });
    }
    return c.json({ success: true as const, data: serializeSite(site) }, 200);
  },
);

// PATCH /sites/:id
app.openapi(
  createRoute({
    method: 'patch',
    path: '/sites/{id}',
    tags: ['content'],
    summary: 'Update a site',
    request: {
      params: IdParam,
      body: {
        content: {
          'application/json': {
            schema: z.object({
              name: z.string().min(1).max(200).optional(),
              slug: SlugField.optional(),
              description: z.string().max(1000).nullable().optional(),
              status: z.enum(asNonEmptyTuple(SITE_STATUSES)).optional(),
              favicon: z.string().nullable().optional(),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        content: {
          'application/json': { schema: z.object({ success: z.literal(true), data: SiteSchema }) },
        },
        description: 'Site updated',
      },
      404: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Not found' },
    },
  }),
  async (c) => {
    const db = c.get('db');
    const user = c.get('user');
    if (!user) throw new HTTPException(401, { message: 'Authentication required' });
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');
    const existing = await siteQueries.getSiteById(db, id);
    if (!existing) throw new HTTPException(404, { message: 'Site not found' });
    if (user.role !== 'admin' && existing.ownerId !== user.id) {
      throw new HTTPException(403, { message: 'Forbidden' });
    }
    const site = await siteQueries.updateSite(db, id, body);
    if (!site) throw new HTTPException(404, { message: 'Site not found' });
    return c.json({ success: true as const, data: serializeSite(site) }, 200);
  },
);

// DELETE /sites/:id
app.openapi(
  createRoute({
    method: 'delete',
    path: '/sites/{id}',
    tags: ['content'],
    summary: 'Delete a site',
    request: { params: IdParam },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({ success: z.literal(true), message: z.string() }),
          },
        },
        description: 'Site deleted',
      },
      404: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Not found' },
    },
  }),
  async (c) => {
    const db = c.get('db');
    const user = c.get('user');
    if (!user) throw new HTTPException(401, { message: 'Authentication required' });
    const { id } = c.req.valid('param');
    const existing = await siteQueries.getSiteById(db, id);
    if (!existing) throw new HTTPException(404, { message: 'Site not found' });
    if (user.role !== 'admin' && existing.ownerId !== user.id) {
      throw new HTTPException(403, { message: 'Forbidden' });
    }
    await siteQueries.deleteSite(db, id);

    // Fire-and-forget: clean up orphaned vector data in Supabase.
    // Cross-DB FK cascades don't span separate database instances.
    try {
      const { getVectorClient } = await import('@revealui/db');
      const vectorDb = getVectorClient();
      cleanupVectorDataForSite(vectorDb, id).catch(() => {
        // Swallowed — vector cleanup is best-effort.
        // The batch cleanup cron handles missed deletions.
      });
    } catch {
      // Vector DB not configured — skip cleanup
    }

    return c.json({ success: true as const, message: 'Site deleted' }, 200);
  },
);

export default app;

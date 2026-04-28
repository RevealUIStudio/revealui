/**
 * Page CRUD routes
 *
 * GET|POST /sites/:siteId/pages
 * GET|PATCH|DELETE /pages/:id
 */

import { validateBlocks } from '@revealui/contracts/content-validation';
import { PAGE_STATUSES } from '@revealui/contracts/entities';
import * as pageQueries from '@revealui/db/queries/pages';
import * as siteQueries from '@revealui/db/queries/sites';
import { createRoute, OpenAPIHono, z } from '@revealui/openapi';
import { HTTPException } from 'hono/http-exception';
import { asNonEmptyTuple } from '../../lib/type-guards.js';
import {
  ErrorSchema,
  IdParam,
  SiteIdParam,
  SlugField,
  ValidationErrorSchema,
} from '../_helpers/content-schemas.js';
import { dateToString, nullableDateToString } from '../_helpers/serialize.js';
import type { ContentVariables } from './index.js';

const app = new OpenAPIHono<{ Variables: ContentVariables }>();

// =============================================================================
// Page Schemas
// =============================================================================

const PageSchema = z
  .object({
    id: z.string(),
    siteId: z.string(),
    parentId: z.string().nullable(),
    templateId: z.string().nullable(),
    title: z.string(),
    slug: z.string(),
    path: z.string(),
    status: z.enum(asNonEmptyTuple(PAGE_STATUSES)),
    blocks: z.unknown().nullable(),
    seo: z.unknown().nullable(),
    blockCount: z.number().nullable(),
    wordCount: z.number().nullable(),
    createdAt: z.string().openapi({ type: 'string', format: 'date-time' }),
    updatedAt: z.string().openapi({ type: 'string', format: 'date-time' }),
    publishedAt: z.string().nullable().openapi({ type: 'string', format: 'date-time' }),
  })
  .openapi('Page');

type SerializedPage = z.infer<typeof PageSchema>;

function serializePage(
  page: NonNullable<Awaited<ReturnType<typeof pageQueries.getPageById>>>,
): SerializedPage {
  return {
    id: page.id,
    siteId: page.siteId,
    parentId: page.parentId,
    templateId: page.templateId,
    title: page.title,
    slug: page.slug,
    path: page.path,
    status: page.status as SerializedPage['status'],
    blocks: page.blocks ?? null,
    seo: page.seo ?? null,
    blockCount: page.blockCount ?? null,
    wordCount: page.wordCount ?? null,
    createdAt: dateToString(page.createdAt),
    updatedAt: dateToString(page.updatedAt),
    publishedAt: nullableDateToString(page.publishedAt),
  };
}

// =============================================================================
// Page Routes
// =============================================================================

// GET /sites/:siteId/pages
app.openapi(
  createRoute({
    method: 'get',
    path: '/sites/{siteId}/pages',
    tags: ['content'],
    summary: 'List pages for a site',
    request: {
      params: SiteIdParam,
      query: z.object({
        status: z.enum(asNonEmptyTuple(PAGE_STATUSES)).optional().openapi({ example: 'published' }),
      }),
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({ success: z.literal(true), data: z.array(PageSchema) }),
          },
        },
        description: 'Page list',
      },
      404: {
        content: { 'application/json': { schema: ErrorSchema } },
        description: 'Site not found',
      },
    },
  }),
  async (c) => {
    const db = c.get('db');
    const user = c.get('user');
    const { siteId } = c.req.valid('param');
    const { status } = c.req.valid('query');
    const site = await siteQueries.getSiteById(db, siteId);
    if (!site) throw new HTTPException(404, { message: 'Site not found' });
    if (!user) {
      // Public access: only published pages from published sites
      if (site.status !== 'published') {
        throw new HTTPException(404, { message: 'Site not found' });
      }
      const data = await pageQueries.getPagesBySite(db, siteId, { status: 'published' });
      return c.json({ success: true as const, data: data.map(serializePage) }, 200);
    }
    if (user.role !== 'admin' && site.ownerId !== user.id) {
      throw new HTTPException(403, { message: 'Forbidden' });
    }
    const data = await pageQueries.getPagesBySite(db, siteId, { status });
    return c.json({ success: true as const, data: data.map(serializePage) }, 200);
  },
);

// POST /sites/:siteId/pages
app.openapi(
  createRoute({
    method: 'post',
    path: '/sites/{siteId}/pages',
    tags: ['content'],
    summary: 'Create a page',
    request: {
      params: SiteIdParam,
      body: {
        content: {
          'application/json': {
            schema: z.object({
              title: z.string().min(1).max(500),
              slug: SlugField,
              path: z.string().min(1).max(500),
              status: z.enum(asNonEmptyTuple(PAGE_STATUSES)).optional(),
              parentId: z.string().optional(),
              templateId: z.string().optional(),
              blocks: z.array(z.unknown()).optional(),
              seo: z.record(z.string(), z.unknown()).optional(),
            }),
          },
        },
      },
    },
    responses: {
      201: {
        content: {
          'application/json': { schema: z.object({ success: z.literal(true), data: PageSchema }) },
        },
        description: 'Page created',
      },
      400: {
        content: { 'application/json': { schema: ValidationErrorSchema } },
        description: 'Content validation failed',
      },
      404: {
        content: { 'application/json': { schema: ErrorSchema } },
        description: 'Site not found',
      },
    },
  }),
  async (c) => {
    const db = c.get('db');
    const user = c.get('user');
    if (!user) throw new HTTPException(401, { message: 'Authentication required' });
    const { siteId } = c.req.valid('param');
    const body = c.req.valid('json');
    // Validate blocks for dangerous URLs, excessive nesting, and payload size
    if (body.blocks !== undefined) {
      const validation = validateBlocks(body.blocks);
      if (!validation.valid) {
        return c.json({ success: false as const, errors: validation.errors }, 400);
      }
    }
    const existingSite = await siteQueries.getSiteById(db, siteId);
    if (!existingSite) throw new HTTPException(404, { message: 'Site not found' });
    if (user.role !== 'admin' && existingSite.ownerId !== user.id) {
      throw new HTTPException(403, { message: 'Forbidden' });
    }
    const page = await pageQueries.createPage(db, {
      id: crypto.randomUUID(),
      siteId,
      ...body,
    });
    // biome-ignore lint/style/noNonNullAssertion: createPage always returns the created row
    return c.json({ success: true as const, data: serializePage(page!) }, 201);
  },
);

// GET /pages/:id
app.openapi(
  createRoute({
    method: 'get',
    path: '/pages/{id}',
    tags: ['content'],
    summary: 'Get a page by ID',
    request: { params: IdParam },
    responses: {
      200: {
        content: {
          'application/json': { schema: z.object({ success: z.literal(true), data: PageSchema }) },
        },
        description: 'Page found',
      },
      404: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Not found' },
    },
  }),
  async (c) => {
    const db = c.get('db');
    const user = c.get('user');
    const { id } = c.req.valid('param');
    const page = await pageQueries.getPageById(db, id);
    if (!page) throw new HTTPException(404, { message: 'Page not found' });
    if (!user) {
      // Public access: only published pages
      if (page.status !== 'published') {
        throw new HTTPException(404, { message: 'Page not found' });
      }
      return c.json({ success: true as const, data: serializePage(page) }, 200);
    }
    if (user.role !== 'admin') {
      const site = await siteQueries.getSiteById(db, page.siteId);
      if (!site || site.ownerId !== user.id) {
        throw new HTTPException(403, { message: 'Forbidden' });
      }
    }
    return c.json({ success: true as const, data: serializePage(page) }, 200);
  },
);

// PATCH /pages/:id
app.openapi(
  createRoute({
    method: 'patch',
    path: '/pages/{id}',
    tags: ['content'],
    summary: 'Update a page',
    request: {
      params: IdParam,
      body: {
        content: {
          'application/json': {
            schema: z.object({
              title: z.string().min(1).max(500).optional(),
              slug: SlugField.optional(),
              path: z.string().min(1).max(500).optional(),
              status: z.enum(asNonEmptyTuple(PAGE_STATUSES)).optional(),
              parentId: z.string().nullable().optional(),
              templateId: z.string().nullable().optional(),
              blocks: z.array(z.unknown()).optional(),
              seo: z.record(z.string(), z.unknown()).nullable().optional(),
              publishedAt: z.string().datetime().nullable().optional(),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        content: {
          'application/json': { schema: z.object({ success: z.literal(true), data: PageSchema }) },
        },
        description: 'Page updated',
      },
      400: {
        content: { 'application/json': { schema: ValidationErrorSchema } },
        description: 'Content validation failed',
      },
      404: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Not found' },
    },
  }),
  async (c) => {
    const db = c.get('db');
    const user = c.get('user');
    if (!user) throw new HTTPException(401, { message: 'Authentication required' });
    const { id } = c.req.valid('param');
    const existing = await pageQueries.getPageById(db, id);
    if (!existing) throw new HTTPException(404, { message: 'Page not found' });
    if (user.role !== 'admin') {
      const site = await siteQueries.getSiteById(db, existing.siteId);
      if (!site || site.ownerId !== user.id) {
        throw new HTTPException(403, { message: 'Forbidden' });
      }
    }
    const body = c.req.valid('json');
    // Validate blocks for dangerous URLs, excessive nesting, and payload size
    if (body.blocks !== undefined) {
      const validation = validateBlocks(body.blocks);
      if (!validation.valid) {
        return c.json({ success: false as const, errors: validation.errors }, 400);
      }
    }
    const page = await pageQueries.updatePage(db, id, {
      ...body,
      publishedAt:
        body.publishedAt === null
          ? null
          : body.publishedAt
            ? new Date(body.publishedAt)
            : undefined,
    });
    if (!page) throw new HTTPException(404, { message: 'Page not found' });
    return c.json({ success: true as const, data: serializePage(page) }, 200);
  },
);

// DELETE /pages/:id
app.openapi(
  createRoute({
    method: 'delete',
    path: '/pages/{id}',
    tags: ['content'],
    summary: 'Delete a page',
    request: { params: IdParam },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({ success: z.literal(true), message: z.string() }),
          },
        },
        description: 'Page deleted',
      },
      404: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Not found' },
    },
  }),
  async (c) => {
    const db = c.get('db');
    const user = c.get('user');
    if (!user) throw new HTTPException(401, { message: 'Authentication required' });
    const { id } = c.req.valid('param');
    const existing = await pageQueries.getPageById(db, id);
    if (!existing) throw new HTTPException(404, { message: 'Page not found' });
    if (user.role !== 'admin') {
      const site = await siteQueries.getSiteById(db, existing.siteId);
      if (!site || site.ownerId !== user.id) {
        throw new HTTPException(403, { message: 'Forbidden' });
      }
    }
    await pageQueries.deletePage(db, id);
    return c.json({ success: true as const, message: 'Page deleted' }, 200);
  },
);

export default app;

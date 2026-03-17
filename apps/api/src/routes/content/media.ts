/**
 * Media CRUD routes
 *
 * GET /media
 * GET|PATCH|DELETE /media/:id
 */

import * as mediaQueries from '@revealui/db/queries/media';
import { createRoute, OpenAPIHono, z } from '@revealui/openapi';
import { HTTPException } from 'hono/http-exception';
import { ErrorSchema, IdParam } from '../_helpers/content-schemas.js';
import { PaginationQuery } from '../_helpers/pagination.js';
import type { ContentVariables } from './index.js';

// biome-ignore lint/style/useNamingConvention: Hono requires Variables key
const app = new OpenAPIHono<{ Variables: ContentVariables }>();

// =============================================================================
// Media Schemas
// =============================================================================

const MediaSchema = z
  .object({
    id: z.string(),
    filename: z.string(),
    mimeType: z.string(),
    filesize: z.number().nullable(),
    url: z.string(),
    alt: z.string().nullable(),
    width: z.number().nullable(),
    height: z.number().nullable(),
    focalPoint: z.unknown().nullable(),
    sizes: z.unknown().nullable(),
    uploadedBy: z.string().nullable(),
    createdAt: z.string().openapi({ type: 'string', format: 'date-time' }),
    updatedAt: z.string().openapi({ type: 'string', format: 'date-time' }),
  })
  .openapi('Media');

// =============================================================================
// Media Routes
// =============================================================================

// GET /media
app.openapi(
  createRoute({
    method: 'get',
    path: '/media',
    tags: ['content'],
    summary: 'List media',
    request: {
      query: PaginationQuery.extend({
        mimeType: z.string().optional().openapi({ example: 'image' }),
      }),
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({ success: z.literal(true), data: z.array(MediaSchema) }),
          },
        },
        description: 'Media list',
      },
    },
  }),
  async (c) => {
    const db = c.get('db');
    const user = c.get('user');
    if (!user) throw new HTTPException(401, { message: 'Authentication required' });
    const { mimeType, limit, offset } = c.req.valid('query');
    const data = await mediaQueries.getAllMedia(db, { mimeType, limit, offset });
    return c.json({ success: true as const, data }, 200);
  },
);

// GET /media/:id
app.openapi(
  createRoute({
    method: 'get',
    path: '/media/{id}',
    tags: ['content'],
    summary: 'Get a media item by ID',
    request: { params: IdParam },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({ success: z.literal(true), data: MediaSchema }),
          },
        },
        description: 'Media found',
      },
      404: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Not found' },
    },
  }),
  async (c) => {
    const db = c.get('db');
    const user = c.get('user');
    if (!user) throw new HTTPException(401, { message: 'Authentication required' });
    const { id } = c.req.valid('param');
    const item = await mediaQueries.getMediaById(db, id);
    if (!item) throw new HTTPException(404, { message: 'Media not found' });
    if (user.role !== 'admin' && item.uploadedBy !== user.id) {
      throw new HTTPException(403, { message: 'Forbidden' });
    }
    return c.json({ success: true as const, data: item }, 200);
  },
);

// PATCH /media/:id
app.openapi(
  createRoute({
    method: 'patch',
    path: '/media/{id}',
    tags: ['content'],
    summary: 'Update media metadata',
    request: {
      params: IdParam,
      body: {
        content: {
          'application/json': {
            schema: z.object({
              alt: z.string().max(500).nullable().optional(),
              focalPoint: z.object({ x: z.number(), y: z.number() }).nullable().optional(),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({ success: z.literal(true), data: MediaSchema }),
          },
        },
        description: 'Media updated',
      },
      404: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Not found' },
    },
  }),
  async (c) => {
    const db = c.get('db');
    const user = c.get('user');
    if (!user) throw new HTTPException(401, { message: 'Authentication required' });
    const { id } = c.req.valid('param');
    const existing = await mediaQueries.getMediaById(db, id);
    if (!existing) throw new HTTPException(404, { message: 'Media not found' });
    if (user.role !== 'admin' && existing.uploadedBy !== user.id) {
      throw new HTTPException(403, { message: 'Forbidden' });
    }
    const body = c.req.valid('json');
    const item = await mediaQueries.updateMedia(db, id, body);
    if (!item) throw new HTTPException(404, { message: 'Media not found' });
    return c.json({ success: true as const, data: item }, 200);
  },
);

// DELETE /media/:id
app.openapi(
  createRoute({
    method: 'delete',
    path: '/media/{id}',
    tags: ['content'],
    summary: 'Delete a media item',
    request: { params: IdParam },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({ success: z.literal(true), message: z.string() }),
          },
        },
        description: 'Media deleted',
      },
      404: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Not found' },
    },
  }),
  async (c) => {
    const db = c.get('db');
    const user = c.get('user');
    if (!user) throw new HTTPException(401, { message: 'Authentication required' });
    const { id } = c.req.valid('param');
    const existing = await mediaQueries.getMediaById(db, id);
    if (!existing) throw new HTTPException(404, { message: 'Media not found' });
    if (user.role !== 'admin' && existing.uploadedBy !== user.id) {
      throw new HTTPException(403, { message: 'Forbidden' });
    }
    await mediaQueries.deleteMedia(db, id);
    return c.json({ success: true as const, message: 'Media deleted' }, 200);
  },
);

export default app;

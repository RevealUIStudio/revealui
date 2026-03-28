/**
 * Media CRUD routes
 *
 * POST /media (upload)
 * GET /media
 * GET|PATCH|DELETE /media/:id
 */

import { ALL_MIME_TYPES, getSizeLimit } from '@revealui/contracts/entities';
import { logger } from '@revealui/core/observability/logger';
import * as mediaQueries from '@revealui/db/queries/media';
import { createRoute, OpenAPIHono, z } from '@revealui/openapi';
import { del, put } from '@vercel/blob';
import { HTTPException } from 'hono/http-exception';
import { ErrorSchema, IdParam } from '../_helpers/content-schemas.js';
import { PaginationQuery } from '../_helpers/pagination.js';
import type { ContentVariables } from './index.js';

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

// POST /media (upload)
app.openapi(
  createRoute({
    method: 'post',
    path: '/media',
    tags: ['content'],
    summary: 'Upload a media file',
    request: {
      body: {
        content: {
          'multipart/form-data': {
            schema: z.object({
              file: z.any().openapi({ type: 'string', format: 'binary' }),
              alt: z.string().max(500).optional(),
            }),
          },
        },
      },
    },
    responses: {
      201: {
        content: {
          'application/json': {
            schema: z.object({ success: z.literal(true), data: MediaSchema }),
          },
        },
        description: 'Media uploaded',
      },
      400: {
        content: { 'application/json': { schema: ErrorSchema } },
        description: 'Invalid file',
      },
      413: {
        content: { 'application/json': { schema: ErrorSchema } },
        description: 'File too large',
      },
    },
  }),
  async (c) => {
    const db = c.get('db');
    const user = c.get('user');
    if (!user) throw new HTTPException(401, { message: 'Authentication required' });

    const body = await c.req.parseBody();
    const file = body.file;
    if (!(file instanceof File)) {
      throw new HTTPException(400, { message: 'No file provided' });
    }

    // Validate MIME type against whitelist from @revealui/contracts
    const allowedMimes: readonly string[] = ALL_MIME_TYPES;
    if (!allowedMimes.includes(file.type)) {
      throw new HTTPException(400, {
        message: `Unsupported file type: ${file.type}. Allowed: ${allowedMimes.join(', ')}`,
      });
    }

    // Validate file size against per-type limits from contracts
    const sizeLimit = getSizeLimit(file.type);
    if (file.size > sizeLimit) {
      throw new HTTPException(413, {
        message: `File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum for ${file.type}: ${(sizeLimit / 1024 / 1024).toFixed(0)}MB`,
      });
    }

    // Generate a unique filename with original extension
    const ext = file.name.split('.').pop() ?? 'bin';
    const filename = `${crypto.randomUUID()}.${ext}`;

    // Upload to Vercel Blob storage — returns a public CDN URL
    let url: string;
    try {
      const blob = await put(`media/${filename}`, file, {
        access: 'public',
        contentType: file.type,
        addRandomSuffix: false,
      });
      url = blob.url;
    } catch (uploadError) {
      logger.error('Failed to upload media to Vercel Blob', undefined, {
        filename,
        mimeType: file.type,
        filesize: file.size,
        error: uploadError instanceof Error ? uploadError.message : 'unknown',
      });
      throw new HTTPException(502, {
        message: 'Failed to upload file to storage. Please try again.',
      });
    }

    const item = await mediaQueries.createMedia(db, {
      id: crypto.randomUUID(),
      filename: file.name,
      mimeType: file.type,
      filesize: file.size,
      url,
      alt: typeof body.alt === 'string' ? body.alt : null,
      uploadedBy: user.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    if (!item) throw new HTTPException(500, { message: 'Failed to create media record' });
    return c.json({ success: true as const, data: item }, 201);
  },
);

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
    // Non-admin users only see their own uploads (R5-C5 multi-tenancy fix)
    const uploadedBy = user.role === 'admin' ? undefined : user.id;
    const data = await mediaQueries.getAllMedia(db, { mimeType, uploadedBy, limit, offset });
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
    // Delete from Vercel Blob storage (best-effort — DB record takes priority)
    if (existing.url?.includes('.blob.vercel-storage.com')) {
      del(existing.url).catch((blobErr) => {
        logger.warn('Failed to delete media from Vercel Blob — orphaned blob', {
          mediaId: id,
          url: existing.url,
          error: blobErr instanceof Error ? blobErr.message : 'unknown',
        });
      });
    }
    await mediaQueries.deleteMedia(db, id);
    return c.json({ success: true as const, message: 'Media deleted' }, 200);
  },
);

export default app;

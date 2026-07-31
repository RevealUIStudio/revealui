/**
 * Media CRUD routes
 *
 * POST /media (upload)
 * GET /media
 * GET|PATCH|DELETE /media/:id
 */

import {
  ALL_MIME_TYPES,
  extensionForMimeType,
  getSizeLimit,
  sanitizeFilename,
  verifyMagicBytes,
} from '@revealui/contracts/entities';
import { logger } from '@revealui/core/observability/logger';
import * as mediaQueries from '@revealui/db/queries/media';
import { createRoute, OpenAPIHono, z } from '@revealui/openapi';
import { HTTPException } from 'hono/http-exception';
import { getMediaStorage } from '../../lib/storage.js';
import { ErrorSchema, IdParam } from '../_helpers/content-schemas.js';
import { PaginationQuery } from '../_helpers/pagination.js';
import type { ContentVariables } from './index.js';
import { hasApiRole } from '../../lib/api-roles.js';

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
              // z.any() is non-optional-when-absent in zod 4.4+; the handler owns the real "no file" 400
              file: z.any().optional().openapi({ type: 'string', format: 'binary' }),
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

    // Verify the file's leading bytes match its declared type. The multipart
    // Content-Type is client-controlled; trusting it lets an attacker store
    // active content (e.g. an HTML/JS or SVG payload) under an image type.
    const header = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    if (!verifyMagicBytes(file.type, header)) {
      throw new HTTPException(400, {
        message: `File content does not match its declared type (${file.type}).`,
      });
    }

    // Unique filename; extension derived from the VERIFIED type, never the
    // user-supplied filename.
    const ext = extensionForMimeType(file.type);
    const filename = `${crypto.randomUUID()}.${ext}`;

    // Upload to the configured object-storage backend — Cloudflare R2
    // (canonical) or the legacy Vercel Blob fallback — returns a public CDN URL.
    let url: string;
    try {
      const result = await getMediaStorage().put(`media/${filename}`, file, {
        access: 'public',
        contentType: file.type,
      });
      url = result.url;
    } catch (uploadError) {
      logger.error('Failed to upload media to object storage', undefined, {
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
      filename: sanitizeFilename(file.name),
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
            schema: z.object({
              success: z.literal(true),
              data: z.array(MediaSchema),
              totalDocs: z.number(),
              totalPages: z.number(),
              limit: z.number(),
              offset: z.number(),
            }),
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
    const uploadedBy = hasApiRole(user, 'admin') ? undefined : user.id;
    const filterOpts = { mimeType, uploadedBy };
    const [data, totalDocs] = await Promise.all([
      mediaQueries.getAllMedia(db, { ...filterOpts, limit, offset }),
      mediaQueries.countMedia(db, filterOpts),
    ]);
    return c.json(
      {
        success: true as const,
        data,
        totalDocs,
        totalPages: Math.ceil(totalDocs / limit),
        limit,
        offset,
      },
      200,
    );
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
    if (!hasApiRole(user, 'admin') && item.uploadedBy !== user.id) {
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
    if (!hasApiRole(user, 'admin') && existing.uploadedBy !== user.id) {
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
    if (!hasApiRole(user, 'admin') && existing.uploadedBy !== user.id) {
      throw new HTTPException(403, { message: 'Forbidden' });
    }
    // Delete the stored object (best-effort  -  the DB record takes priority).
    // The configured provider extracts the storage key from the URL. Objects
    // written to the legacy Vercel Blob store during the R2 migration are
    // reclaimed when that store is decommissioned (GAP-208), so a same-provider
    // best-effort delete is sufficient.
    if (existing.url) {
      try {
        await getMediaStorage().del(existing.url);
      } catch (storageErr) {
        logger.warn('Failed to delete media object from storage  -  orphaned object', {
          mediaId: id,
          url: existing.url,
          error: storageErr instanceof Error ? storageErr.message : 'unknown',
        });
      }
    }
    await mediaQueries.deleteMedia(db, id);
    return c.json({ success: true as const, message: 'Media deleted' }, 200);
  },
);

export default app;

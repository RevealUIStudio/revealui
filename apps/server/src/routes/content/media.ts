/**
 * Media CRUD routes
 *
 * POST /media (legacy multipart upload — still supported for small/dev files)
 * POST /media/presign (GAP-215: issue direct-to-R2 PUT URL)
 * POST /media/confirm (GAP-215: HEAD + magic-byte check, create media row)
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
import { hasApiRole } from '../../lib/api-roles.js';
import { getMediaStorage } from '../../lib/storage.js';
import { ErrorSchema, IdParam } from '../_helpers/content-schemas.js';
import { PaginationQuery } from '../_helpers/pagination.js';
import type { ContentVariables } from './index.js';

const app = new OpenAPIHono<{ Variables: ContentVariables }>();

/** Default lifetime of a presigned media PUT URL (15 minutes). */
const PRESIGN_EXPIRES_SECONDS = 900;

/** Bytes of object prefix fetched on confirm for magic-byte verification. */
const MAGIC_BYTE_PREFIX_LENGTH = 16;

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

const PresignRequestSchema = z.object({
  filename: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(127),
  size: z.number().int().positive(),
});

const ConfirmRequestSchema = z.object({
  key: z.string().min(1).max(512),
  filename: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(127),
  size: z.number().int().positive(),
  alt: z.string().max(500).optional(),
});

// =============================================================================
// Helpers
// =============================================================================

function assertAllowedMime(mimeType: string): void {
  const allowedMimes: readonly string[] = ALL_MIME_TYPES;
  if (!allowedMimes.includes(mimeType)) {
    throw new HTTPException(400, {
      message: `Unsupported file type: ${mimeType}. Allowed: ${allowedMimes.join(', ')}`,
    });
  }
}

function assertWithinSizeLimit(mimeType: string, size: number): void {
  const sizeLimit = getSizeLimit(mimeType);
  if (size > sizeLimit) {
    throw new HTTPException(413, {
      message: `File too large (${(size / 1024 / 1024).toFixed(1)}MB). Maximum for ${mimeType}: ${(sizeLimit / 1024 / 1024).toFixed(0)}MB`,
    });
  }
}

/**
 * Storage keys issued by presign are always `media/<uuid>.<ext>` where `ext`
 * is derived from the verified MIME type. Confirm rejects any other shape so
 * a client cannot register an arbitrary object under a media row.
 */
export function isIssuedMediaKey(key: string, mimeType: string): boolean {
  const expectedExt = extensionForMimeType(mimeType);
  const prefix = 'media/';
  if (!key.startsWith(prefix)) return false;
  const rest = key.slice(prefix.length);
  const dot = rest.lastIndexOf('.');
  if (dot <= 0) return false;
  const name = rest.slice(0, dot);
  const ext = rest.slice(dot + 1);
  if (ext !== expectedExt) return false;
  // UUID form: 8-4-4-4-12 hex with dashes at fixed positions.
  if (name.length !== 36) return false;
  if (name[8] !== '-' || name[13] !== '-' || name[18] !== '-' || name[23] !== '-') {
    return false;
  }
  for (let i = 0; i < name.length; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) continue;
    const code = name.charCodeAt(i);
    const isDigit = code >= 48 && code <= 57;
    const isLowerHex = code >= 97 && code <= 102;
    const isUpperHex = code >= 65 && code <= 70;
    if (!(isDigit || isLowerHex || isUpperHex)) return false;
  }
  return true;
}

function contentTypesCompatible(declared: string, stored: string): boolean {
  // R2 may append charset or return a default; compare the media type token only.
  const declaredBase = declared.split(';')[0]?.trim().toLowerCase() ?? '';
  const storedBase = stored.split(';')[0]?.trim().toLowerCase() ?? '';
  if (declaredBase === storedBase) return true;
  // Some backends default missing Content-Type to application/octet-stream.
  if (storedBase === 'application/octet-stream') return true;
  return false;
}

// =============================================================================
// Media Routes
// =============================================================================

// POST /media/presign — issue a direct-to-R2 PUT URL (GAP-215). Static path
// registered before /media/:id so it is not captured as an id.
app.openapi(
  createRoute({
    method: 'post',
    path: '/media/presign',
    tags: ['content'],
    summary: 'Presign a direct-to-storage media upload',
    description:
      'Returns a short-lived presigned PUT URL. The client uploads bytes directly ' +
      'to object storage, then calls POST /media/confirm. File bytes never buffer ' +
      'in the API function (GAP-215).',
    request: {
      body: {
        content: {
          'application/json': {
            schema: PresignRequestSchema,
          },
        },
      },
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({
              success: z.literal(true),
              data: z.object({
                key: z.string(),
                uploadUrl: z.string(),
                headers: z.record(z.string(), z.string()),
                expiresAt: z.string().openapi({ type: 'string', format: 'date-time' }),
              }),
            }),
          },
        },
        description: 'Presigned upload issued',
      },
      400: {
        content: { 'application/json': { schema: ErrorSchema } },
        description: 'Invalid request',
      },
      413: {
        content: { 'application/json': { schema: ErrorSchema } },
        description: 'File too large',
      },
    },
  }),
  async (c) => {
    const user = c.get('user');
    if (!user) throw new HTTPException(401, { message: 'Authentication required' });

    const body = c.req.valid('json');
    assertAllowedMime(body.mimeType);
    assertWithinSizeLimit(body.mimeType, body.size);

    const ext = extensionForMimeType(body.mimeType);
    const key = `media/${crypto.randomUUID()}.${ext}`;

    try {
      const storage = getMediaStorage();
      const presigned = await storage.createPresignedPutUrl({
        key,
        contentType: body.mimeType,
        expiresInSeconds: PRESIGN_EXPIRES_SECONDS,
      });
      return c.json(
        {
          success: true as const,
          data: {
            key: presigned.key,
            uploadUrl: presigned.url,
            headers: presigned.headers,
            expiresAt: presigned.expiresAt.toISOString(),
          },
        },
        200,
      );
    } catch (presignError) {
      logger.error('Failed to create presigned media upload URL', undefined, {
        mimeType: body.mimeType,
        size: body.size,
        error: presignError instanceof Error ? presignError.message : 'unknown',
      });
      throw new HTTPException(502, {
        message: 'Failed to prepare media upload. Please try again.',
      });
    }
  },
);

// POST /media/confirm — re-validate object in storage and create the media row.
app.openapi(
  createRoute({
    method: 'post',
    path: '/media/confirm',
    tags: ['content'],
    summary: 'Confirm a direct-to-storage media upload',
    description:
      'After the client PUTs to the presigned URL, confirm HEADs the object, ' +
      're-checks size and magic bytes, then creates the media DB row (GAP-215).',
    request: {
      body: {
        content: {
          'application/json': {
            schema: ConfirmRequestSchema,
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
        description: 'Media registered',
      },
      400: {
        content: { 'application/json': { schema: ErrorSchema } },
        description: 'Validation failed',
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

    const body = c.req.valid('json');
    assertAllowedMime(body.mimeType);
    assertWithinSizeLimit(body.mimeType, body.size);

    if (!isIssuedMediaKey(body.key, body.mimeType)) {
      throw new HTTPException(400, {
        message: 'Invalid storage key for the declared media type.',
      });
    }

    const storage = getMediaStorage();

    let head: { size: number; contentType: string; url: string };
    try {
      head = await storage.headObject(body.key);
    } catch (headError) {
      const message = headError instanceof Error ? headError.message : 'unknown';
      if (message.includes('NoSuchKey') || message.includes('not found')) {
        throw new HTTPException(400, {
          message: 'Uploaded object not found. Complete the storage PUT before confirming.',
        });
      }
      logger.error('Failed to HEAD media object on confirm', undefined, {
        key: body.key,
        error: message,
      });
      throw new HTTPException(502, {
        message: 'Failed to verify uploaded media. Please try again.',
      });
    }

    if (head.size !== body.size) {
      throw new HTTPException(400, {
        message: `Uploaded object size (${head.size}) does not match declared size (${body.size}).`,
      });
    }
    if (head.size > getSizeLimit(body.mimeType)) {
      throw new HTTPException(413, {
        message: `Uploaded object exceeds the size limit for ${body.mimeType}.`,
      });
    }
    if (!contentTypesCompatible(body.mimeType, head.contentType)) {
      throw new HTTPException(400, {
        message: `Uploaded object content-type (${head.contentType}) does not match declared type (${body.mimeType}).`,
      });
    }

    let prefix: Uint8Array;
    try {
      prefix = await storage.getObjectRange(body.key, 0, MAGIC_BYTE_PREFIX_LENGTH - 1);
    } catch (rangeError) {
      logger.error('Failed to read media object prefix on confirm', undefined, {
        key: body.key,
        error: rangeError instanceof Error ? rangeError.message : 'unknown',
      });
      throw new HTTPException(502, {
        message: 'Failed to verify uploaded media content. Please try again.',
      });
    }

    if (!verifyMagicBytes(body.mimeType, prefix)) {
      // Best-effort cleanup of a rejected object so it cannot linger.
      try {
        await storage.del(body.key);
      } catch (delError) {
        logger.warn('Failed to delete media object that failed magic-byte check', {
          key: body.key,
          error: delError instanceof Error ? delError.message : 'unknown',
        });
      }
      throw new HTTPException(400, {
        message: `File content does not match its declared type (${body.mimeType}).`,
      });
    }

    const item = await mediaQueries.createMedia(db, {
      id: crypto.randomUUID(),
      filename: sanitizeFilename(body.filename),
      mimeType: body.mimeType,
      filesize: head.size,
      url: head.url,
      alt: body.alt ?? null,
      uploadedBy: user.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    if (!item) throw new HTTPException(500, { message: 'Failed to create media record' });
    return c.json({ success: true as const, data: item }, 201);
  },
);

// POST /media (legacy multipart upload)
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

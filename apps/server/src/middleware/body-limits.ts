/**
 * Request body-size limits.
 *
 * A single path-aware gate: media uploads (POST to the media collection) get the
 * image per-type ceiling; every other route gets 1MB.
 *
 * Why one middleware instead of separate `app.use('/media/*', big)` +
 * `app.use('*', small)`: Hono runs every matching middleware in registration
 * order. A global `app.use('*', 1MB)` registered after a media-specific limit
 * runs SECOND and rejects all media uploads >1MB — which silently made the prior
 * 100MB media limit dead code (every media upload was capped at 1MB). Choosing
 * the size inside one middleware avoids that interaction.
 *
 * Larger/video uploads will move to a presigned direct-to-R2 upload path, where
 * the bytes never buffer in the function. The per-type check in the media route
 * remains the authoritative content-size enforcement after parse.
 */
import { FILE_SIZE_LIMITS } from '@revealui/contracts/entities';
import type { MiddlewareHandler } from 'hono';
import { bodyLimit } from 'hono/body-limit';

/** Default body limit for all routes (1MB). */
export const GLOBAL_BODY_LIMIT = 1024 * 1024;

/** Body limit for media uploads — the image/document per-type ceiling (10MB). */
export const MEDIA_UPLOAD_BODY_LIMIT = FILE_SIZE_LIMITS.IMAGE;

/** POST paths that accept a media upload and therefore get the larger body limit. */
const MEDIA_UPLOAD_PATHS = new Set(['/api/content/media', '/api/v1/content/media']);

function normalizePath(path: string): string {
  return path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
}

/** True only for a POST to a media-upload path (the requests that get the larger limit). */
export function isMediaUploadRequest(method: string, path: string): boolean {
  return method === 'POST' && MEDIA_UPLOAD_PATHS.has(normalizePath(path));
}

function humanSize(bytes: number): string {
  return `${Math.round(bytes / 1024 / 1024)}MB`;
}

/**
 * Single body-size gate for the whole app. Apply once via `app.use('*', bodyLimitGate())`.
 */
export function bodyLimitGate(): MiddlewareHandler {
  return (c, next) => {
    const maxSize = isMediaUploadRequest(c.req.method, c.req.path)
      ? MEDIA_UPLOAD_BODY_LIMIT
      : GLOBAL_BODY_LIMIT;
    return bodyLimit({
      maxSize,
      onError: (ctx) =>
        ctx.json(
          {
            success: false,
            error: `Request body too large. Maximum size is ${humanSize(maxSize)}.`,
          },
          413,
        ),
    })(c, next);
  };
}

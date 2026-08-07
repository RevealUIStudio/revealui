/**
 * Request body-size limits.
 *
 * A single path-aware gate: legacy multipart media uploads (POST exact path
 * `/api/content/media`) get the image per-type ceiling (10MB); every other
 * route — including POST /media/presign and POST /media/confirm — gets 1MB.
 *
 * Why one middleware instead of separate `app.use('/media/*', big)` +
 * `app.use('*', small)`: Hono runs every matching middleware in registration
 * order. A global `app.use('*', 1MB)` registered after a media-specific limit
 * runs SECOND and rejects all media uploads >1MB — which silently made the prior
 * 100MB media limit dead code (every media upload was capped at 1MB). Choosing
 * the size inside one middleware avoids that interaction.
 *
 * Large/video uploads use the GAP-215 presigned direct-to-R2 path: the client
 * PUTs bytes to R2, so the API never buffers the file body. Presign/confirm
 * bodies are tiny JSON and stay under GLOBAL_BODY_LIMIT. The per-type check on
 * those routes is the authoritative content-size enforcement.
 */
import { FILE_SIZE_LIMITS } from '@revealui/contracts/entities';
import type { MiddlewareHandler } from 'hono';
import { bodyLimit } from 'hono/body-limit';

/** Default body limit for all routes (1MB). */
export const GLOBAL_BODY_LIMIT = 1024 * 1024;

/**
 * Body limit for legacy multipart media uploads — image/document per-type
 * ceiling (10MB). Video and larger files must use POST /media/presign.
 */
export const MEDIA_UPLOAD_BODY_LIMIT = FILE_SIZE_LIMITS.IMAGE;

/**
 * POST paths that accept a legacy multipart media upload and therefore get the
 * larger body limit. Exact path only — /media/presign and /media/confirm stay
 * on GLOBAL_BODY_LIMIT (JSON).
 */
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

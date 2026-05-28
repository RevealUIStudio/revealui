/**
 * Media storage provider resolution (GAP-208 Phase 2b).
 *
 * Resolves the StorageProvider the media routes use, from @revealui/config's
 * validated storage config — the single source of truth for the env contract:
 *   - Cloudflare R2 (canonical) when all five R2_* env vars are set.
 *   - Vercel Blob (legacy fallback) when only BLOB_READ_WRITE_TOKEN is set.
 *   - Otherwise throws a clear, actionable error naming the vars to set
 *     (fail-fast — never silently no-op an upload; see docs/SECRETS.md).
 *
 * The provider is memoized: the underlying S3 / Blob client is constructed once
 * per process, not per request.
 */

import config from '@revealui/config';
import { createStorage, type StorageProvider } from '@revealui/core/storage';

let cached: StorageProvider | undefined;

export function getMediaStorage(): StorageProvider {
  if (cached) {
    return cached;
  }

  const { r2, blobToken } = config.storage;

  if (r2) {
    cached = createStorage({ provider: 'r2', r2 });
  } else if (blobToken) {
    cached = createStorage({ provider: 'vercel-blob', vercelBlob: { token: blobToken } });
  } else {
    throw new Error(
      'No object-storage backend is configured for media uploads. Set Cloudflare ' +
        'R2 — the canonical backend — via R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, ' +
        'R2_SECRET_ACCESS_KEY, R2_BUCKET, and R2_PUBLIC_BASE_URL; or set the legacy ' +
        'BLOB_READ_WRITE_TOKEN. See docs/guides/deployment.md.',
    );
  }

  return cached;
}

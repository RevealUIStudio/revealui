/**
 * GAP-448 P2-B: upload Agency kit tarball to object storage (R2).
 *
 * Uses the same media storage provider as uploads. Objects live under an
 * unguessable key prefix; buyer download still goes through signed tokens.
 */

import type { StorageProvider } from '@revealui/core/storage';

export interface UploadAgencyKitTarballInput {
  fulfillmentId: string;
  slug: string;
  livemode: boolean;
  body: Buffer;
  /** Inject storage in tests. */
  storage?: StorageProvider;
}

export interface UploadAgencyKitTarballResult {
  key: string;
  url: string;
  size: number;
}

/**
 * Upload kit tarball. Throws when R2 is not configured (full mode requires it).
 */
export async function uploadAgencyKitTarball(
  input: UploadAgencyKitTarballInput,
): Promise<UploadAgencyKitTarballResult> {
  // Lazy media storage so unit tests can inject a mock without loading config.
  const storage = input.storage ?? (await import('./storage.js')).getMediaStorage();
  const envPrefix = input.livemode ? 'live' : 'test';
  const safeSlug = input.slug.replace(/[^a-z0-9-]+/gi, '-').slice(0, 48) || 'package';
  const key = `kits/${envPrefix}/${input.fulfillmentId}/${safeSlug}-agency-founding-kit.tar.gz`;

  const result = await storage.put(key, input.body, {
    contentType: 'application/gzip',
    access: 'public',
    cacheControl: 'private, max-age=0, no-store',
    metadata: {
      product: 'agency-founding-kit',
      fulfillment: input.fulfillmentId,
    },
  });

  return { key: result.key, url: result.url, size: result.size };
}

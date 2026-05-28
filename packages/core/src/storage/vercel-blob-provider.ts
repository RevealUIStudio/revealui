/**
 * Vercel Blob implementation of StorageProvider.
 *
 * Legacy backend retained during the GAP-208 Cloudflare R2 cutover so the
 * media-upload path can fall back to Vercel Blob when R2 is not configured.
 * Wraps @vercel/blob's put/del/list behind the provider-agnostic
 * StorageProvider interface. Cloudflare R2 (r2.ts) is the canonical backend;
 * this provider is removed once the Blob store is decommissioned.
 *
 * NOTE: distinct from vercel-blob.ts in this directory, which is the legacy
 * Payload-style upload *plugin* still wired into apps/admin's
 * revealui.config.ts. This file is the StorageProvider the createStorage
 * factory returns for the 'vercel-blob' tag.
 *
 * Server-only. Do NOT import from client-side code or edge runtime.
 */

import { del, list, put } from '@vercel/blob';
import { toUint8Array } from './_helpers.js';
import type {
  ListItem,
  ListOptions,
  ListResult,
  PutOptions,
  PutResult,
  StorageProvider,
  VercelBlobConfig,
} from './types.js';

const PROVIDER_TAG = 'vercel-blob';
const DEFAULT_LIST_LIMIT = 1000;

class VercelBlobProvider implements StorageProvider {
  readonly provider = PROVIDER_TAG;
  private readonly token: string;

  constructor(config: VercelBlobConfig) {
    if (!config.token) {
      throw new Error(
        'Vercel Blob provider requires VercelBlobConfig.token (the ' +
          'BLOB_READ_WRITE_TOKEN value). For new deployments prefer Cloudflare ' +
          'R2 (provider: "r2").',
      );
    }
    this.token = config.token;
  }

  async put(
    key: string,
    data: Blob | ArrayBuffer | Uint8Array | ReadableStream<Uint8Array>,
    opts?: PutOptions,
  ): Promise<PutResult> {
    if (opts?.access === 'private') {
      throw new Error(
        "Vercel Blob provider does not support access: 'private' — every blob " +
          'is publicly readable. Use Cloudflare R2 for private-access patterns.',
      );
    }

    // Normalize to bytes so the result carries an accurate size regardless of
    // input shape (ReadableStream has no length until consumed). Re-wrap in a
    // fresh Uint8Array so the Blob part is backed by a non-shared ArrayBuffer,
    // satisfying the DOM BlobPart type under TS strict typed-array generics.
    const body = await toUint8Array(data);

    const result = await put(key, new Blob([new Uint8Array(body)]), {
      access: 'public',
      token: this.token,
      contentType: opts?.contentType,
      // Keys are caller-controlled (callers pre-randomize, e.g. media/<uuid>.ext);
      // never append a second random suffix or the returned URL won't match `key`.
      addRandomSuffix: false,
    });

    // Vercel Blob has no per-object user-metadata or Cache-Control-header API
    // (only cacheControlMaxAge); opts.metadata / opts.cacheControl are ignored
    // by this legacy provider. R2 honors both.

    return {
      key,
      url: result.url,
      size: body.byteLength,
      provider: PROVIDER_TAG,
    };
  }

  async del(keyOrUrl: string): Promise<void> {
    // Vercel's del is idempotent (deleting an absent blob is a no-op), so this
    // satisfies the best-effort contract. It requires the full blob URL, which
    // is what media records persist.
    await del(keyOrUrl, { token: this.token });
  }

  async list(opts?: ListOptions): Promise<ListResult> {
    const response = await list({
      token: this.token,
      prefix: opts?.prefix,
      limit: opts?.limit ?? DEFAULT_LIST_LIMIT,
      cursor: opts?.cursor,
    });

    const items: ListItem[] = response.blobs.map((blob) => ({
      key: blob.pathname,
      url: blob.url,
      size: blob.size,
      uploadedAt: blob.uploadedAt,
    }));

    return {
      items,
      cursor: response.cursor,
      hasMore: response.hasMore,
    };
  }
}

export function createVercelBlobProvider(config: VercelBlobConfig): StorageProvider {
  return new VercelBlobProvider(config);
}

export type { VercelBlobProvider };

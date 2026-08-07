/**
 * In-memory mock implementation of StorageProvider for tests.
 *
 * Per `feedback_pluggable_provider_pattern`: every provider abstraction ships
 * a mock so consumer tests don't need network access or real cloud creds.
 *
 * Stores objects in a Map keyed by storage key. URLs use a synthetic
 * `mock://` scheme so callers can distinguish mock results from real ones
 * without parsing host names.
 *
 * GAP-208 Phase 2a (2026-05-18). Phase 2b (GAP-215): presigned PUT + head + range.
 */

import { toUint8Array } from './_helpers.js';
import type {
  HeadObjectResult,
  ListItem,
  ListOptions,
  ListResult,
  PresignPutOptions,
  PresignPutResult,
  PutOptions,
  PutResult,
  StorageProvider,
} from './types.js';

const PROVIDER_TAG = 'mock';
const MOCK_URL_SCHEME = 'mock://storage';
const DEFAULT_LIST_LIMIT = 1000;
const DEFAULT_PRESIGN_EXPIRES_SECONDS = 900;

interface MockEntry {
  body: Uint8Array;
  contentType: string;
  cacheControl?: string;
  metadata?: Record<string, string>;
  uploadedAt: Date;
}

class MockProvider implements StorageProvider {
  readonly provider = PROVIDER_TAG;
  private readonly store = new Map<string, MockEntry>();

  async put(
    key: string,
    data: Blob | ArrayBuffer | Uint8Array | ReadableStream<Uint8Array>,
    opts?: PutOptions,
  ): Promise<PutResult> {
    const body = await toUint8Array(data);
    this.store.set(key, {
      body,
      contentType: opts?.contentType ?? 'application/octet-stream',
      cacheControl: opts?.cacheControl,
      metadata: opts?.metadata,
      uploadedAt: new Date(),
    });
    return {
      key,
      url: `${MOCK_URL_SCHEME}/${key}`,
      size: body.byteLength,
      provider: PROVIDER_TAG,
    };
  }

  async createPresignedPutUrl(opts: PresignPutOptions): Promise<PresignPutResult> {
    const expiresInSeconds = opts.expiresInSeconds ?? DEFAULT_PRESIGN_EXPIRES_SECONDS;
    if (expiresInSeconds <= 0) {
      throw new Error('createPresignedPutUrl: expiresInSeconds must be positive');
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + expiresInSeconds * 1000);
    const headers: Record<string, string> = {
      'content-type': opts.contentType,
    };
    if (opts.contentLength !== undefined) {
      headers['content-length'] = String(opts.contentLength);
    }

    // Synthetic presigned URL. Tests that exercise the full client flow call
    // put() with the same key after "uploading"; route tests mock this method.
    const params = new URLSearchParams({
      expires: String(Math.floor(expiresAt.getTime() / 1000)),
      'content-type': opts.contentType,
    });
    return {
      url: `${MOCK_URL_SCHEME}/presign/${opts.key}?${params.toString()}`,
      headers,
      key: opts.key,
      expiresAt,
    };
  }

  async headObject(key: string): Promise<HeadObjectResult> {
    const entry = this.store.get(key);
    if (!entry) {
      throw new Error(`mock HEAD failed for "${key}": NoSuchKey object not found`);
    }
    return {
      size: entry.body.byteLength,
      contentType: entry.contentType,
      url: `${MOCK_URL_SCHEME}/${key}`,
    };
  }

  async getObjectRange(key: string, start: number, endInclusive: number): Promise<Uint8Array> {
    if (start < 0 || endInclusive < start) {
      throw new Error(
        `getObjectRange: invalid range ${start}-${endInclusive} (start must be >= 0 and endInclusive >= start)`,
      );
    }
    const entry = this.store.get(key);
    if (!entry) {
      throw new Error(`mock GET range failed for "${key}": NoSuchKey object not found`);
    }
    // Inclusive end, clamped to body length (mirrors S3 range semantics).
    const end = Math.min(endInclusive, entry.body.byteLength - 1);
    if (start >= entry.body.byteLength) {
      return new Uint8Array(0);
    }
    return entry.body.slice(start, end + 1);
  }

  async del(keyOrUrl: string): Promise<void> {
    const key = this.extractKey(keyOrUrl);
    this.store.delete(key);
  }

  async list(opts?: ListOptions): Promise<ListResult> {
    const prefix = opts?.prefix ?? '';
    const limit = opts?.limit ?? DEFAULT_LIST_LIMIT;
    const startAfter = opts?.cursor;

    const allKeys = Array.from(this.store.keys())
      .filter((key) => key.startsWith(prefix))
      .sort();

    const startIndex = startAfter ? allKeys.findIndex((k) => k > startAfter) : 0;
    const effectiveStart = startIndex < 0 ? allKeys.length : startIndex;
    const page = allKeys.slice(effectiveStart, effectiveStart + limit);

    const items: ListItem[] = page.map((key) => {
      const entry = this.store.get(key);
      if (!entry) {
        throw new Error(`mock: store mutated during list iteration (${key})`);
      }
      return {
        key,
        url: `${MOCK_URL_SCHEME}/${key}`,
        size: entry.body.byteLength,
        uploadedAt: entry.uploadedAt,
      };
    });

    const hasMore = effectiveStart + limit < allKeys.length;
    const nextCursor = hasMore ? page[page.length - 1] : undefined;

    return { items, cursor: nextCursor, hasMore };
  }

  /** Test helper — read the raw bytes back. Not part of StorageProvider. */
  read(key: string): Uint8Array | undefined {
    return this.store.get(key)?.body;
  }

  /** Test helper — full entry inspection. Not part of StorageProvider. */
  inspect(key: string): MockEntry | undefined {
    return this.store.get(key);
  }

  /** Test helper — count of stored objects. Not part of StorageProvider. */
  size(): number {
    return this.store.size;
  }

  /** Test helper — wipe all stored objects. Not part of StorageProvider. */
  clear(): void {
    this.store.clear();
  }

  private extractKey(keyOrUrl: string): string {
    if (keyOrUrl.startsWith(`${MOCK_URL_SCHEME}/`)) {
      return keyOrUrl.slice(MOCK_URL_SCHEME.length + 1);
    }
    return keyOrUrl;
  }
}

export function createMockProvider(): MockProvider {
  return new MockProvider();
}

export type { MockProvider };

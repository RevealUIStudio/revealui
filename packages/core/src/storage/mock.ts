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
 * GAP-208 Phase 2a (2026-05-18).
 */

import { toUint8Array } from './_helpers.js';
import type {
  ListItem,
  ListOptions,
  ListResult,
  PutOptions,
  PutResult,
  StorageProvider,
} from './types.js';

const PROVIDER_TAG = 'mock';
const MOCK_URL_SCHEME = 'mock://storage';
const DEFAULT_LIST_LIMIT = 1000;

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

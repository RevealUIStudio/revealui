import { describe, expect, it, vi } from 'vitest';

// Stub @aws-sdk/client-s3 so createR2Provider can construct the S3Client
// without touching network / requiring real creds.
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: class {
    constructor(_args: unknown) {}
  },
  PutObjectCommand: class {
    constructor(public input: unknown) {}
  },
  DeleteObjectCommand: class {
    constructor(public input: unknown) {}
  },
  ListObjectsV2Command: class {
    constructor(public input: unknown) {}
  },
}));

import { createStorage } from '../index.js';
import type { StorageConfig } from '../types.js';

describe('createStorage', () => {
  describe('provider routing', () => {
    it('returns an r2 provider for { provider: "r2", r2: {...} }', () => {
      const provider = createStorage({
        provider: 'r2',
        r2: {
          accountId: 'a',
          accessKeyId: 'k',
          secretAccessKey: 's',
          bucket: 'b',
          publicBaseUrl: 'https://cdn.example',
        },
      });
      expect(provider.provider).toBe('r2');
    });

    it('returns a mock provider for { provider: "mock" }', () => {
      const provider = createStorage({ provider: 'mock' });
      expect(provider.provider).toBe('mock');
    });
  });

  describe('vercel-blob deferral', () => {
    it('throws with a Phase 2b reference for { provider: "vercel-blob" }', () => {
      expect(() =>
        createStorage({
          provider: 'vercel-blob',
          vercelBlob: { token: 'vercel_blob_rw_test' },
        }),
      ).toThrow(/Phase 2b/);
    });

    it('mentions the legacy vercelBlobStorage plugin in the error', () => {
      expect(() =>
        createStorage({
          provider: 'vercel-blob',
          vercelBlob: { token: 'tok' },
        }),
      ).toThrow(/vercelBlobStorage/);
    });
  });

  describe('exhaustiveness', () => {
    it('throws with a clear message for unknown provider tags', () => {
      // Bypass the discriminated union to simulate a runtime config that
      // doesn't match any case (e.g. config loaded from a stale config file).
      const bogus = { provider: 'tigris', tigris: {} } as unknown as StorageConfig;
      expect(() => createStorage(bogus)).toThrow(/unknown provider tag/);
    });
  });

  describe('r2 propagation', () => {
    it('propagates the r2 config validation error (missing publicBaseUrl)', () => {
      expect(() =>
        createStorage({
          provider: 'r2',
          r2: {
            accountId: 'a',
            accessKeyId: 'k',
            secretAccessKey: 's',
            bucket: 'b',
            // publicBaseUrl intentionally omitted
          },
        }),
      ).toThrow(/requires R2Config.publicBaseUrl/);
    });
  });
});

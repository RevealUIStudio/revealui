// Storage abstraction (StorageProvider interface + per-provider configs + factory).
// GAP-208 — introduced 2026-05-18 alongside Vercel Blob → Cloudflare R2 swap.
//
// Phase 1 (#959): types.ts + index.ts type re-exports.
// Phase 2a (#959 follow-up): r2 + mock providers + createStorage factory.
// Phase 2b media-route cutover onto R2 (server) + #1644 Vercel Blob removal.
// Phase 2b presign (GAP-215): createPresignedPutUrl + headObject + getObjectRange.

import { createMockProvider } from './mock.js';
import { createR2Provider } from './r2.js';
import type { StorageConfig, StorageProvider } from './types.js';

export { createMockProvider } from './mock.js';
export type { ObjectStorageConfig } from './object-storage.js';
// Provider-agnostic Payload-style upload plugin — adapts any StorageProvider
// (R2 canonical, mock) to the engine's collection upload adapter. Used by
// apps/admin/revealui.config.ts. GAP-208 Phase 4 replaced the provider-specific
// `vercelBlobStorage` plugin with this.
export { objectStorage } from './object-storage.js';
// Provider factories — exported so callers can construct a provider directly
// when they already know which one they want (skipping the discriminated-union
// factory below).
export { createR2Provider } from './r2.js';
export type {
  HeadObjectResult,
  ListItem,
  ListOptions,
  ListResult,
  PresignPutOptions,
  PresignPutResult,
  PutOptions,
  PutResult,
  R2Config,
  StorageConfig,
  StorageProvider,
} from './types.js';

/**
 * Construct a StorageProvider from a tagged config.
 *
 * Per `feedback_pluggable_provider_pattern`: explicit "no-X" opt-in — unknown
 * tags throw with a clear message; no silent fallback.
 *
 * Supported tags: 'r2' (canonical) and 'mock' (tests). The provider-agnostic
 * `objectStorage` Payload plugin (object-storage.ts) adapts either to apps/admin's
 * upload path.
 */
export function createStorage(config: StorageConfig): StorageProvider {
  switch (config.provider) {
    case 'r2':
      return createR2Provider(config.r2);
    case 'mock':
      return createMockProvider();
    default: {
      const _exhaustive: never = config;
      throw new Error(
        `createStorage: unknown provider tag. Got ${JSON.stringify(_exhaustive)}. ` +
          "Valid tags: 'r2', 'mock'.",
      );
    }
  }
}

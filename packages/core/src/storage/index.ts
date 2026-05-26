// Storage abstraction (StorageProvider interface + per-provider configs + factory).
// GAP-208 — introduced 2026-05-18 alongside Vercel Blob → Cloudflare R2 swap.
//
// Phase 1 (#959): types.ts + index.ts type re-exports.
// Phase 2a (#959 follow-up): r2 + mock providers + createStorage factory.
// Phase 2b (this PR): vercel-blob StorageProvider + apps/server media-route
//   cutover. R2 is canonical; Vercel Blob is the migration-window fallback.

import { createMockProvider } from './mock.js';
import { createR2Provider } from './r2.js';
import type { StorageConfig, StorageProvider } from './types.js';
import { createVercelBlobProvider } from './vercel-blob-provider.js';

export { createMockProvider } from './mock.js';

// Provider factories — exported so callers can construct a provider directly
// when they already know which one they want (skipping the discriminated-union
// factory below).
export { createR2Provider } from './r2.js';
export type {
  ListItem,
  ListOptions,
  ListResult,
  PutOptions,
  PutResult,
  R2Config,
  StorageConfig,
  StorageProvider,
  VercelBlobConfig,
} from './types.js';
// Legacy Payload-style plugin — kept during GAP-208 migration so existing
// `apps/admin/revealui.config.ts` keeps working. Dropped in Phase 4 cleanup.
export { vercelBlobStorage } from './vercel-blob.js';
export { createVercelBlobProvider } from './vercel-blob-provider.js';

/**
 * Construct a StorageProvider from a tagged config.
 *
 * Per `feedback_pluggable_provider_pattern`: explicit "no-X" opt-in — unknown
 * tags throw with a clear message; no silent fallback.
 *
 * Supported tags: 'r2' (canonical), 'vercel-blob' (legacy migration-window
 * fallback), and 'mock' (tests). The legacy `vercelBlobStorage` Payload plugin
 * (vercel-blob.ts) remains separately for apps/admin's revealui.config.ts.
 */
export function createStorage(config: StorageConfig): StorageProvider {
  switch (config.provider) {
    case 'r2':
      return createR2Provider(config.r2);
    case 'vercel-blob':
      return createVercelBlobProvider(config.vercelBlob);
    case 'mock':
      return createMockProvider();
    default: {
      const _exhaustive: never = config;
      throw new Error(
        `createStorage: unknown provider tag. Got ${JSON.stringify(_exhaustive)}. ` +
          "Valid tags: 'r2', 'vercel-blob', 'mock'.",
      );
    }
  }
}

// Storage abstraction (StorageProvider interface + per-provider configs + factory).
// GAP-208 — introduced 2026-05-18 alongside Vercel Blob → Cloudflare R2 swap.
//
// Phase 1 (#959): types.ts + index.ts type re-exports.
// Phase 2a (this PR): r2 + mock providers + createStorage factory.

import { createMockProvider } from './mock.js';
import { createR2Provider } from './r2.js';
import type { StorageConfig, StorageProvider } from './types.js';

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

/**
 * Construct a StorageProvider from a tagged config.
 *
 * Per `feedback_pluggable_provider_pattern`: explicit "no-X" opt-in — unknown
 * or unsupported tags throw with a clear message; no silent fallback.
 *
 * Supported tags in Phase 2a: 'r2', 'mock'. The 'vercel-blob' tag is reserved
 * for Phase 2b (StorageProvider impl over @vercel/blob); during the migration
 * window, consumers needing Vercel Blob should use the legacy `vercelBlobStorage`
 * Payload plugin via `revealui.config.ts`.
 */
export function createStorage(config: StorageConfig): StorageProvider {
  switch (config.provider) {
    case 'r2':
      return createR2Provider(config.r2);
    case 'mock':
      return createMockProvider();
    case 'vercel-blob':
      throw new Error(
        "createStorage: provider 'vercel-blob' is not yet implemented as a " +
          'StorageProvider (lands in GAP-208 Phase 2b). For the migration ' +
          'window, use the legacy `vercelBlobStorage` Payload plugin in ' +
          "revealui.config.ts, or switch to provider: 'r2'.",
      );
    default: {
      const _exhaustive: never = config;
      throw new Error(
        `createStorage: unknown provider tag. Got ${JSON.stringify(_exhaustive)}. ` +
          "Valid tags: 'r2', 'mock', 'vercel-blob' (Phase 2b).",
      );
    }
  }
}

// Re-export storage abstraction (StorageProvider interface + per-provider configs).
// GAP-208 — introduced 2026-05-18 alongside Vercel Blob → Cloudflare R2 swap.
//
// The factory `createStorage(config)` will land in Phase 2a; this file currently
// only re-exports the types so consumers can start depending on the contract.
export type {
  StorageProvider,
  StorageConfig,
  PutOptions,
  PutResult,
  ListOptions,
  ListResult,
  ListItem,
  R2Config,
  VercelBlobConfig,
} from './types.js';

// Legacy Payload-style plugin — kept during GAP-208 migration so existing
// `apps/admin/revealui.config.ts` keeps working. Dropped in Phase 4 cleanup.
export { vercelBlobStorage } from './vercel-blob.js';

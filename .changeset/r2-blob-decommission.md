---
'@revealui/core': minor
'admin': minor
'server': patch
---

Complete the Vercel Blob → Cloudflare R2 object-storage cutover so the legacy Vercel Blob store can be decommissioned.

- **`@revealui/core`:** replace the provider-specific `vercelBlobStorage` Payload plugin with the provider-agnostic `objectStorage` plugin. `objectStorage({ collections, resolveProvider, prefix? })` adapts any `StorageProvider` (Cloudflare R2 — canonical — Vercel Blob, mock) to the engine's collection upload-adapter interface, resolving the backend lazily on first upload via `resolveProvider` (so reading validated config never forces env validation at config-build time). **BREAKING:** `vercelBlobStorage` is removed from `@revealui/core` and `@revealui/core/server`; migrate to `objectStorage`. The `createVercelBlobProvider` StorageProvider and the `'vercel-blob'` `createStorage` tag remain for the migration-window Blob fallback.
- **admin:** `apps/admin/revealui.config.ts` now uploads through `objectStorage`, resolving the provider from `@revealui/config`'s `config.storage` — Cloudflare R2 when fully configured, else the legacy Vercel Blob token. Media uploads no longer hard-depend on `BLOB_READ_WRITE_TOKEN`.
- **server:** drop the now-unused `@vercel/blob` dependency (`apps/server` migrated its media route to `getMediaStorage()` in the prior phase). `@revealui/core` keeps `@vercel/blob` for the Vercel Blob StorageProvider.

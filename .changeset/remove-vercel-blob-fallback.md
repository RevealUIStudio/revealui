---
"@revealui/core": minor
"@revealui/config": minor
"@revealui/setup": minor
"@revealui/cli": minor
---

Remove the legacy Vercel Blob object-storage fallback (#1644). Cloudflare R2 is now the sole non-mock storage backend in every production environment.

Breaking changes:

- `@revealui/core`: the `createVercelBlobProvider` export and the `'vercel-blob'` provider tag are removed from `@revealui/core/storage`. `createStorage` now accepts only `{ provider: 'r2' }` or `{ provider: 'mock' }`; `VercelBlobConfig` is gone. `@vercel/blob` is no longer a dependency.
- `@revealui/config`: `config.storage.blobToken` and the `BLOB_READ_WRITE_TOKEN` env var are removed from the schema and the storage module. Consumers must configure Cloudflare R2 (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_BASE_URL`); the media-storage resolvers now select R2 or throw.
- `@revealui/setup`: `BLOB_READ_WRITE_TOKEN` is dropped from the environment validators.
- `@revealui/cli`: `create-revealui` no longer offers Vercel Blob as a storage provider; generated `.env` files and templates are R2-only.

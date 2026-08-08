# @revealui/setup

## 0.7.4

### Patch Changes

- Updated dependencies [9cf46d6]
  - @revealui/security@0.7.0

## 0.7.3

### Patch Changes

- Updated dependencies [514e068]
  - @revealui/security@0.6.1

## 0.7.2

### Patch Changes

- Updated dependencies [641ff50]
- Updated dependencies [94d1714]
  - @revealui/security@0.6.0

## 0.7.1

### Patch Changes

- @revealui/security@0.5.1

## 0.7.0

### Minor Changes

- 16b235f: Promote the audit-row signer composition into `@revealui/security` and add key provisioning + a public-key endpoint (GAP-355 Stage 3).

  - `@revealui/security` gains `createAuditRowSignerFromEnv`, `resolveAuditPublicKey`, and `deriveAuditKid` (server entry) — the single env→signer→kid derivation shared by every audit writer, re-exported through `@revealui/core/security`.
  - `@revealui/setup` generates a per-deployment Ed25519 audit-signing keypair (`generateAuditSigningKeypair`), writes the private key to the env output, and prints the kid + public key for offline receipt verification. Adds a `@revealui/security` dependency.
  - A new unauthenticated `GET /api/audit/public-key` publishes the SPKI public key + kid so a customer can verify an audit-log record offline, without our secret. Unsigned deployments answer an honest 404.

### Patch Changes

- Updated dependencies [16b235f]
- Updated dependencies [578214d]
- Updated dependencies [b550aa2]
  - @revealui/security@0.5.0
  - @revealui/config@0.6.0

## 0.6.0

### Minor Changes

- 2855f39: Add a shared `revvault` CLI client at `@revealui/setup/revvault`, consolidating
  the six hand-rolled `revvault` spawn implementations across the MCP OAuth
  provider and the setup/admin/probe scripts into one module. Adds a fail-fast
  `requireRevvaultSecret` helper that throws naming the exact vault path when a
  secret is missing, alongside tolerant (`readRevvaultSecret`) and write
  (`writeRevvaultSecret`, `revvaultSecretExists`) variants for scripts that
  previously reimplemented their own spawn + error handling. `@revealui/mcp`'s
  OAuth provider now consumes the shared client with no change to its public
  API or behavior.

### Patch Changes

- Updated dependencies
  - @revealui/config@0.5.1

## 0.5.0

### Minor Changes

- 639dfa5: Remove the legacy Vercel Blob object-storage fallback (#1644). Cloudflare R2 is now the sole non-mock storage backend in every production environment.

  Breaking changes:

  - `@revealui/core`: the `createVercelBlobProvider` export and the `'vercel-blob'` provider tag are removed from `@revealui/core/storage`. `createStorage` now accepts only `{ provider: 'r2' }` or `{ provider: 'mock' }`; `VercelBlobConfig` is gone. `@vercel/blob` is no longer a dependency.
  - `@revealui/config`: `config.storage.blobToken` and the `BLOB_READ_WRITE_TOKEN` env var are removed from the schema and the storage module. Consumers must configure Cloudflare R2 (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_BASE_URL`); the media-storage resolvers now select R2 or throw.
  - `@revealui/setup`: `BLOB_READ_WRITE_TOKEN` is dropped from the environment validators.
  - `@revealui/cli`: `create-revealui` no longer offers Vercel Blob as a storage provider; generated `.env` files and templates are R2-only.

### Patch Changes

- Updated dependencies [639dfa5]
  - @revealui/config@0.5.0

## 0.4.2

### Patch Changes

- Updated dependencies [95ddc7b]
  - @revealui/config@0.4.3

## 0.4.1

### Patch Changes

- Updated dependencies [145975d]
  - @revealui/config@0.4.2

## 0.4.0

### Minor Changes

- 12ef757: Bootstrap first user as `owner` role; rename admin roles to `super-admin` and `admin`.

  The first user created via the setup bootstrap now receives the `owner` role (hard-capped at 3 via app-layer soft cap). Existing `admin`-role checks should be reviewed — the former flat `admin` tier has been split into `super-admin` (full access) and `admin` (scoped).

### Patch Changes

- Updated dependencies [37952d2]
  - @revealui/config@0.4.1

## 0.3.6

### Patch Changes

- Updated dependencies [59c670b]
  - @revealui/config@0.4.0

## 0.3.5

### Patch Changes

- OpenAPI Phase B with native Zod-to-OpenAPI scaffold. Pipeline gap fixes, pre-push tests, code-pattern scanner. Dependency updates and SDLC hardening.
- Updated dependencies
  - @revealui/config@0.3.4

## 0.3.4

### Patch Changes

- 0f195e4: SDLC hardening, content overhaul, and cms→admin rename.

  - Promote all CI quality checks from warn-only to hard-fail
  - Kill banned phrases across 58 files (headless CMS → agentic business runtime)
  - Rename apps/cms to apps/admin throughout the codebase
  - Remove proprietary AI providers (Anthropic, OpenAI direct) — keep OpenAI-compatible base
  - Add Gmail-first email provider to MCP server (Resend deprecated)
  - Fix CodeQL security alerts (XSS validation, path traversal guard, prototype-safe objects)
  - Align all coverage thresholds with actual coverage
  - Add 4 ADRs (dual-database, Fair Source licensing, session-only auth, two-repo model)

- Updated dependencies [0f195e4]
  - @revealui/config@0.3.3

## 0.3.3

### Patch Changes

- add offline-first cache layer and sync status indicator, fix infinite type instantiation in cn utility, replace core dep with utils in router, remove Cursor IDE support from editors
- Updated dependencies
  - @revealui/config@0.3.2

## 0.3.2

### Patch Changes

- fix: security hardening, CodeQL fixes, docs, and dependency cleanup

  - Replace regex with string methods across source code (CodeQL)
  - Harden CLI content pull and remove trivial conditionals
  - Fix router dependency (core → utils) to resolve DTS build OOM
  - Add migration 0006 indexes for agent_actions, crdt_operations, boards, ticket_labels
  - Remove legacy Supabase-era billing handlers from services
  - Re-export agentMemories from db schema for published @revealui/ai compat
  - Add publishConfig.registry consistency to editors, mcp, services
  - Add READMEs and JSDoc across all packages

- Updated dependencies
  - @revealui/config@0.3.1

## 0.3.1

### Patch Changes

- f89b9ff: Upgrade production dependencies: lexical 0.40→0.42, @vercel/blob 2.2→2.3, drizzle-orm 0.45.1→0.45.2, ora 8→9, commander 13→14, inquirer 12→13

## 0.3.0

### Minor Changes

- Initial public release. Business OS Software (BOSS) — users, content, products, payments, and AI, pre-wired, open source, and ready to deploy.

### Patch Changes

- Updated dependencies
  - @revealui/config@0.3.0

## 0.2.0

### Minor Changes

- 4d76d68: Initial stable release of RevealUI environment setup utilities.

### Patch Changes

- Updated dependencies [4d76d68]
  - @revealui/config@0.2.0

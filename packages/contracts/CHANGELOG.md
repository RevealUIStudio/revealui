# @revealui/contracts

## 1.4.0

### Patch Changes

- f6ba434: Add prices to service offerings (Architecture Review $3,500, Launch Package $7,500, Migration Assist $300/hr, Consulting Hour $300/hr). CTAs now link to Cal.com booking instead of mailto. Update service offering order: launch package before migration assist.
- Updated dependencies [77a9a68]
- Updated dependencies [f6ba434]
- Updated dependencies [59c670b]
  - @revealui/db@0.4.0

## 1.3.7

### Patch Changes

- Security hardening across packages: expanded dangerous URL scheme check, CodeQL alert resolution, Dependabot vulnerability fixes, security rule schemas with AST-typed ReDoS detection, and RBAC/ABAC enforcement tests.
- Updated dependencies
  - @revealui/db@0.3.7

## 1.3.6

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
  - @revealui/db@0.3.6

## 1.3.5

### Patch Changes

- add NeonSaga transaction-safe operations layer, idempotency keys migration, CRDT optimistic locking fix, observability routes, and database health check error surfacing
- Updated dependencies
  - @revealui/db@0.3.5

## 1.3.4

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
  - @revealui/db@0.3.4

## 1.3.3

### Patch Changes

- Updated dependencies
  - @revealui/db@0.3.3

## 1.3.2

### Patch Changes

- fix(contracts): regenerated Zod schemas and contract types to include new `deletedAt` columns on orders and licenses tables
- Updated dependencies
  - @revealui/db@0.3.2

## 1.3.1

### Patch Changes

- Updated dependencies [f89b9ff]
  - @revealui/db@0.3.1

## 1.2.0

### Minor Changes

- Initial public release. Business OS Software (BOSS) — users, content, products, payments, and AI, pre-wired, open source, and ready to deploy.

### Patch Changes

- Updated dependencies
  - @revealui/db@0.3.0

## 1.1.0

### Minor Changes

- Add vision/multipart message support to ChatRequestContract.

  Introduces `TextPart`, `ImagePart`, and `ContentPart` schemas so message content can be either a plain string or an array of content parts (text + image_url). This aligns with the OpenAI vision API format and enables inference-snaps multimodal models (Gemma 3, Qwen 2.5 VL) to be used through the chat endpoint.

## 1.0.0

### Minor Changes

- 4d76d68: Initial stable release of RevealUI type contracts and Zod schemas.

  - CMS type contracts: `CollectionConfig`, `GlobalConfig`, `Field`, `Block`, access and hook types
  - Agent type contracts and definitions
  - Block types for rich text CMS content
  - Validation utilities: `defineCollection`, `defineGlobal`, `defineField`, `validateWithErrors`
  - Extensibility: `registerCustomFieldType`, `registerPluginExtension`
  - Generated entity types for all database tables (Users, Sessions, Pages, Posts, Media, etc.)
  - Zod schemas for runtime validation with TypeScript type inference

### Patch Changes

- Updated dependencies [4d76d68]
  - @revealui/db@0.2.0

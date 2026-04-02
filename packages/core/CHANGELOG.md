# @revealui/core

## 0.5.3

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
  - @revealui/cache@0.1.1
  - @revealui/contracts@1.3.4
  - @revealui/resilience@0.2.1
  - @revealui/security@0.2.4
  - @revealui/utils@0.3.1

## 0.5.2

### Patch Changes

- @revealui/contracts@1.3.3
- @revealui/security@0.2.3

## 0.5.1

### Patch Changes

- Updated dependencies
- Updated dependencies
  - @revealui/contracts@1.3.2
  - @revealui/security@0.2.2

## 0.5.0

### Minor Changes

- Add AI sampling for free-tier users (50 tasks/month)

## 0.4.0

### Minor Changes

- f89b9ff: Upgrade production dependencies: lexical 0.40→0.42, @vercel/blob 2.2→2.3, drizzle-orm 0.45.1→0.45.2, ora 8→9, commander 13→14, inquirer 12→13

### Patch Changes

- @revealui/contracts@1.3.1
- @revealui/security@0.2.1

## 0.3.0

### Minor Changes

- Initial public release. Business OS Software (BOSS) — users, content, products, payments, and AI, pre-wired, open source, and ready to deploy.

### Patch Changes

- Updated dependencies
  - @revealui/contracts@1.2.0
  - @revealui/utils@0.3.0
  - @revealui/cache@0.2.0
  - @revealui/resilience@0.2.0
  - @revealui/security@0.2.0

## 0.2.1

### Patch Changes

- Updated dependencies
  - @revealui/contracts@1.1.0

## 0.2.0

### Minor Changes

- 4d76d68: Initial stable release of the RevealUI core framework.

  - CMS engine with collection CRUD, field traversal, and hook system (afterChange, afterRead, beforeChange, beforeValidate)
  - REST API layer with framework-agnostic handlers
  - Auth utilities (access control helpers)
  - Config system with `buildConfig` and deep merge
  - Rich text editor integration (Lexical with Bold, Italic, Underline, Link, Heading)
  - Client components for admin dashboard, collection list, and document forms
  - Universal Postgres adapter (PGlite/PostgreSQL)
  - Plugins: form builder, nested docs, redirects
  - Vercel Blob storage adapter
  - Next.js integration with `withRevealUI` config wrapper
  - Logger, LRU cache, error handling, and type guard utilities
  - License validation and feature flag system
  - Security: CSP headers, input validation, rate limiting

### Patch Changes

- Updated dependencies [4d76d68]
- Updated dependencies [4d76d68]
  - @revealui/contracts@1.0.0
  - @revealui/utils@0.2.0

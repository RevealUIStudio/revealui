# @revealui/db

## 0.3.6

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
  - @revealui/utils@0.3.3
  - @revealui/config@0.3.3

## 0.3.5

### Patch Changes

- add NeonSaga transaction-safe operations layer, idempotency keys migration, CRDT optimistic locking fix, observability routes, and database health check error surfacing
- Updated dependencies
- Updated dependencies
  - @revealui/utils@0.3.2
  - @revealui/config@0.3.2

## 0.3.4

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
  - @revealui/utils@0.3.1

## 0.3.3

### Patch Changes

- fix(db): add missing indexes on boards, ticketLabels, agentActions, crdtOperations; Drizzle migration 0005 for deletedAt columns, mfa counter, new indexes, and db:push-only tables

## 0.3.2

### Patch Changes

- fix(db): add soft-delete (`deletedAt`) columns to orders and licenses tables for financial audit compliance, fix dual-DB boundary so `agentMemories` exports from rest schema instead of vector, remove orphaned migration file

## 0.3.1

### Patch Changes

- f89b9ff: Upgrade production dependencies: lexical 0.40→0.42, @vercel/blob 2.2→2.3, drizzle-orm 0.45.1→0.45.2, ora 8→9, commander 13→14, inquirer 12→13

## 0.3.0

### Minor Changes

- Initial public release. Business OS Software (BOSS) — users, content, products, payments, and AI, pre-wired, open source, and ready to deploy.

### Patch Changes

- Updated dependencies
  - @revealui/config@0.3.0
  - @revealui/utils@0.3.0

## 0.2.0

### Minor Changes

- 4d76d68: Initial stable release of RevealUI database layer.

  - Drizzle ORM schema definitions for 25+ tables
  - Dual-database architecture support (NeonDB PostgreSQL, Supabase)
  - Client factory for database connections
  - Migration system
  - Schema modules: users, sessions, sites, pages, posts, media, agents, conversations, CRDT operations, rate limits, waitlist, and more
  - Type generation utilities for contracts integration

### Patch Changes

- Updated dependencies [4d76d68]
- Updated dependencies [4d76d68]
  - @revealui/config@0.2.0
  - @revealui/utils@0.2.0

# @revealui/db

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

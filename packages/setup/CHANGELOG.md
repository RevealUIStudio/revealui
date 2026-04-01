# @revealui/setup

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

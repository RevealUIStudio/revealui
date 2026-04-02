# @revealui/mcp

## 0.1.7

### Patch Changes

- f6a81c7: Add engines field and update doc comments to reference PGlite/ElectricSQL instead of Redis

## 0.1.6

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
  - @revealui/contracts@1.3.4
  - @revealui/core@0.5.3

## 0.1.5

### Patch Changes

- @revealui/contracts@1.3.3
- @revealui/core@0.5.2

## 0.1.4

### Patch Changes

- Updated dependencies
  - @revealui/contracts@1.3.2
  - @revealui/core@0.5.1

## 0.1.3

### Patch Changes

- Migrate to MIT license (open-core model)
- Updated dependencies
  - @revealui/core@0.5.0

## 0.1.2

### Patch Changes

- Updated dependencies [f89b9ff]
  - @revealui/core@0.4.0
  - @revealui/contracts@1.3.1

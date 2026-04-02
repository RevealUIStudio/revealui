# @revealui/sync

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
  - @revealui/contracts@1.3.4
  - @revealui/db@0.3.4

## 0.3.3

### Patch Changes

- Updated dependencies
  - @revealui/db@0.3.3
  - @revealui/contracts@1.3.3

## 0.3.2

### Patch Changes

- Updated dependencies
- Updated dependencies
  - @revealui/contracts@1.3.2
  - @revealui/db@0.3.2

## 0.3.1

### Patch Changes

- Updated dependencies [f89b9ff]
  - @revealui/db@0.3.1
  - @revealui/contracts@1.3.1

## 0.3.0

### Minor Changes

- Initial public release. Business OS Software (BOSS) — users, content, products, payments, and AI, pre-wired, open source, and ready to deploy.

### Patch Changes

- Updated dependencies
  - @revealui/contracts@1.2.0
  - @revealui/db@0.3.0

## 0.2.1

### Patch Changes

- Updated dependencies
  - @revealui/contracts@1.1.0

## 0.2.0

### Minor Changes

- 4d76d68: Initial stable release of RevealUI real-time sync.

  - ElectricSQL integration for real-time data sync
  - Basic CRDT operations for conflict-free updates
  - React hooks for sync state management

### Patch Changes

- Updated dependencies [4d76d68]
- Updated dependencies [4d76d68]
  - @revealui/contracts@1.0.0
  - @revealui/db@0.2.0

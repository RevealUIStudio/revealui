# @revealui/router

## 0.3.6

### Patch Changes

- add offline-first cache layer and sync status indicator, fix infinite type instantiation in cn utility, replace core dep with utils in router, remove Cursor IDE support from editors
- Updated dependencies
  - @revealui/utils@0.3.2

## 0.3.5

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
  - @revealui/utils@0.3.1

## 0.3.4

### Patch Changes

- @revealui/core@0.5.2

## 0.3.3

### Patch Changes

- @revealui/core@0.5.1

## 0.3.2

### Patch Changes

- Extract Link component props to named interface
- Updated dependencies
  - @revealui/core@0.5.0

## 0.3.1

### Patch Changes

- Updated dependencies [f89b9ff]
  - @revealui/core@0.4.0

## 0.3.0

### Minor Changes

- Initial public release. Business OS Software (BOSS) — users, content, products, payments, and AI, pre-wired, open source, and ready to deploy.

### Patch Changes

- Updated dependencies
  - @revealui/core@0.3.0

## 0.2.1

### Patch Changes

- @revealui/core@0.2.1

## 0.2.0

### Minor Changes

- 4d76d68: Initial stable release of RevealUI lightweight file-based router.

### Patch Changes

- Updated dependencies [4d76d68]
  - @revealui/core@0.2.0

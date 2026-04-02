# @revealui/services

## 0.3.2

### Patch Changes

- f6a81c7: Add engines field and update doc comments to reference PGlite/ElectricSQL instead of Redis

## 0.3.1

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
  - @revealui/db@0.3.4

## 0.3.0

### Minor Changes

- c0e2daf: refactor(services): remove legacy Supabase-era billing handlers

  Removed 15 dead API handler files and 10 legacy test files (~5,900 lines) that were
  fully replaced by production handlers in apps/api during the NeonDB migration.
  Relocated createPaymentIntent from api/handlers/ to stripe/ subpath.

  Breaking: `@revealui/services/api/handlers/payment-intent` is now `@revealui/services/stripe/payment-intent`

## 0.2.6

### Patch Changes

- Updated dependencies
  - @revealui/db@0.3.3
  - @revealui/contracts@1.3.3
  - @revealui/core@0.5.2

## 0.2.5

### Patch Changes

- Updated dependencies
- Updated dependencies
  - @revealui/contracts@1.3.2
  - @revealui/db@0.3.2
  - @revealui/core@0.5.1

## 0.2.4

### Patch Changes

- Migrate to MIT license (open-core model)
- Updated dependencies
  - @revealui/core@0.5.0

## 0.2.3

### Patch Changes

- Updated dependencies [f89b9ff]
  - @revealui/core@0.4.0
  - @revealui/db@0.3.1
  - @revealui/contracts@1.3.1

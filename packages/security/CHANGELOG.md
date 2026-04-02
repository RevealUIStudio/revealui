# @revealui/security

## 0.2.4

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
  - @revealui/utils@0.3.1

## 0.2.3

### Patch Changes

- @revealui/contracts@1.3.3

## 0.2.2

### Patch Changes

- fix(security): RFC 6238 TOTP compliance — base32 decode key and 8-byte big-endian counter encoding so generated codes match standard authenticator apps
- Updated dependencies
  - @revealui/contracts@1.3.2

## 0.2.1

### Patch Changes

- @revealui/contracts@1.3.1

## 0.2.0

### Minor Changes

- Initial public release. Business OS Software (BOSS) — users, content, products, payments, and AI, pre-wired, open source, and ready to deploy.

### Patch Changes

- Updated dependencies
  - @revealui/contracts@1.2.0
  - @revealui/utils@0.3.0

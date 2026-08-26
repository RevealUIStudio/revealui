# @revealui/sync

## 0.4.2

### Patch Changes

- Updated dependencies [a5b8022]
- Updated dependencies [700413b]
- Updated dependencies [5a0fbe7]
  - @revealui/core@0.14.0
  - @revealui/contracts@0.8.3

## 0.4.1

### Patch Changes

- @revealui/core@0.13.1

## 0.4.0

### Minor Changes

- 320b98b: Export OfflineMutationQueue (and OfflineQueueMutation) for demos/apps; use core readCsrfToken SSOT in sync csrfHeaders; add @revealui/core workspace dependency and ./offline-queue package export (fleet-redundancy C12 residual).

### Patch Changes

- Updated dependencies [fcd7273]
  - @revealui/core@0.13.0

## 0.3.20

### Patch Changes

- Updated dependencies [c02e613]
- Updated dependencies [f727852]
  - @revealui/contracts@0.8.2
  - @revealui/cache@0.4.0

## 0.3.19

### Patch Changes

- Updated dependencies [fb3315c]
- Updated dependencies [94d1714]
  - @revealui/db@0.10.0
  - @revealui/contracts@0.8.1

## 0.3.18

### Patch Changes

- Updated dependencies [86780ad]
  - @revealui/contracts@0.8.1

## 0.3.17

### Patch Changes

- Updated dependencies [c3c1e8f]
- Updated dependencies [1385cd6]
- Updated dependencies [077d3c4]
- Updated dependencies [578214d]
- Updated dependencies [1a49590]
  - @revealui/db@0.9.0
  - @revealui/contracts@0.8.0
  - @revealui/cache@0.2.5

## 0.3.16

### Patch Changes

- Updated dependencies [eac1a1b]
- Updated dependencies [0cc7f62]
- Updated dependencies [76efd75]
  - @revealui/db@0.8.0
  - @revealui/contracts@0.7.0
  - @revealui/cache@0.2.4

## 0.3.15

### Patch Changes

- Updated dependencies [9801744]
  - @revealui/contracts@0.6.2
  - @revealui/db@0.7.3
  - @revealui/cache@0.2.3

## 0.3.14

### Patch Changes

- @revealui/db@0.7.2
- @revealui/contracts@0.6.1

## 0.3.13

### Patch Changes

- 07b1c8b: The sync mutations' `getCsrfToken()` helper now decodes the `revealui-csrf` cookie value before returning it. Next.js encodes cookie values with `encodeURIComponent` (via the `cookie` package), storing and returning the nonce:hmac string as `nonce%3Ahmac`; the admin proxy's `validateCsrfToken` calls `indexOf(':')` which finds nothing in the encoded form and returns false — sync write mutations were rejected with a 403 "CSRF token invalid" even when a valid session and correct token were present. The fix applies `decodeURIComponent` with a `try/catch` fallback to the raw value on `URIError`, matching the fix applied to all other CSRF readers in the same release cycle (#1405). No API change: callers without the cookie continue to send requests byte-identical to before.

## 0.3.12

### Patch Changes

- 954667f: Attach the `revealui-csrf` double-submit token as an `X-CSRF-Token` header on unsafe-method sync requests — `useSyncMutations` create/update/remove and the `useSharedMemories` reconciliation trigger. The admin proxy rejects cookie-authenticated POST/PATCH/DELETE to `/api/sync/*` without this header, so browser mutations (deleting a conversation or an agent memory in the admin dashboard) failed with 403 "CSRF token missing" once the admin CSRF gate landed. The token is read from the JS-readable cookie in browser contexts only and attached only to same-origin targets, mirroring the admin `apiFetch` / core `APIClient` pattern.
- Updated dependencies [c77ac4f]
  - @revealui/contracts@0.6.1
  - @revealui/db@0.7.1
  - @revealui/cache@0.2.2

## 0.3.11

### Patch Changes

- Updated dependencies [96b1049]
- Updated dependencies [e08adbe]
  - @revealui/db@0.7.0
  - @revealui/contracts@0.6.0

## 0.3.10

### Patch Changes

- 9e5f3ae: Make `useConversations(_userId?)` param optional — it was kept for API compat but unused (filtering enforced server-side in the proxy). Backwards-compatible.
- Updated dependencies [9ec7c07]
- Updated dependencies [363d4b5]
- Updated dependencies [e4a3779]
- Updated dependencies [6643d0b]
  - @revealui/contracts@0.6.0
  - @revealui/db@0.6.0
  - @revealui/cache@0.2.1

## 0.3.9

### Patch Changes

- Updated dependencies [54557b7]
- Updated dependencies [6afae69]
- Updated dependencies [f7ea9b4]
- Updated dependencies [ad6aa4c]
- Updated dependencies [0eb3131]
- Updated dependencies [25dba49]
- Updated dependencies [9a6ebb3]
- Updated dependencies [47c75fe]
- Updated dependencies [a8ca087]
- Updated dependencies [1f7ae24]
- Updated dependencies [f56d3d3]
- Updated dependencies [f8199c8]
- Updated dependencies [972b052]
- Updated dependencies [dbf405a]
- Updated dependencies [3d09425]
- Updated dependencies [6ce0d60]
- Updated dependencies [2eb63dc]
- Updated dependencies [5479d59]
  - @revealui/contracts@0.5.0
  - @revealui/db@0.5.0
  - @revealui/cache@0.1.5

## 0.3.8

### Patch Changes

- Updated dependencies [77a9a68]
- Updated dependencies [f6ba434]
- Updated dependencies [59c670b]
- Updated dependencies [f6ba434]
  - @revealui/db@0.4.0
  - @revealui/contracts@1.4.0

## 0.3.7

### Patch Changes

- Browser PGlite cache with offline mutation queue (Cache Phase E), SOC2 6.2 controls, and preflight fixes.
- Updated dependencies
- Updated dependencies
- Updated dependencies
  - @revealui/cache@0.1.4
  - @revealui/db@0.3.7
  - @revealui/contracts@1.3.7

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
  - @revealui/db@0.3.6
  - @revealui/contracts@1.3.6

## 0.3.5

### Patch Changes

- add offline-first cache layer and sync status indicator, fix infinite type instantiation in cn utility, replace core dep with utils in router, remove Cursor IDE support from editors
- Updated dependencies
  - @revealui/db@0.3.5
  - @revealui/contracts@1.3.5

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

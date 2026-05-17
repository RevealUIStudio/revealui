# @revealui/services

## 0.6.0

### Minor Changes

- 7ad9ddb: Remove unused `checkServicesLicense` export. Per the 2026-05-08 charge-readiness
  audit Phase 2 Path A: the function was declared but never called in any feature
  code path; Stripe, RevealCoin, and Vercel integrations ran unconditionally.

  License normalized from MIT to FSL-1.1-MIT: a runtime tier check was incoherent
  with MIT's "use without restriction" grant. LICENSE file added to the package.

- 1841ccd: `verifyRvuiPayment` now runs the safeguards pipeline (replay protection,
  $500 single-payment cap, wallet rate limit, monthly discount cap, TWAP
  circuit breaker) and records verified payments to `revealcoinPayments`
  so future replays of the same `txSignature` are caught by
  `isDuplicateTransaction`. Closes the GAP-159 replay-attack hole that
  gated `RVUI_PAYMENTS_ENABLED=true` in any real-money environment.

  Signature change: `verifyRvuiPayment(txSignature, expectedAmountRaw,
expectedRecipient, safeguards: { userId, amountUsd })` — the new 4th
  parameter is required because the safeguards pipeline keys on user +
  USD value. Pre-existing callers in `apps/server/src/middleware/x402.ts`
  (`verifySolanaPayment`) and four other route surfaces are updated to
  thread the context.

  USDC verification (Coinbase facilitator) is unaffected — it handles
  its own replay protection and ignores the new `PaymentContext`.

### Patch Changes

- f31115e: Bump Stripe SDK to ^22.1.0 (latest as of 2026-04-28; default API version `2026-04-22.dahlia`). Replace hardcoded `apiVersion` strings across the codebase with `Stripe.API_VERSION` so future SDK upgrades auto-track the API version in lockstep instead of leaving stale date stamps. Also fixes the CJS import in `scripts/setup/seed-stripe.ts` for SDK 22+ (closes GAP-155).
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
- Updated dependencies [b0bab95]
- Updated dependencies [3ff25bb]
- Updated dependencies [af12683]
- Updated dependencies [37952d2]
- Updated dependencies [972b052]
- Updated dependencies [dbf405a]
- Updated dependencies [3d09425]
- Updated dependencies [6ce0d60]
- Updated dependencies [2eb63dc]
- Updated dependencies [5479d59]
  - @revealui/contracts@0.5.0
  - @revealui/core@0.7.0
  - @revealui/config@0.4.1
  - @revealui/utils@0.3.5
  - @revealui/db@0.5.0

## 0.4.0

### Minor Changes

- f6ba434: Add `invoices.list`, `invoices.retrieve`, and `refunds.create` to `protectedStripe` — all routed through the DB-backed circuit breaker with retry logic. Enables billing routes to use a single shared Stripe client instead of maintaining a separate in-memory circuit breaker.

### Patch Changes

- Updated dependencies [80cc561]
- Updated dependencies [77a9a68]
- Updated dependencies [f6ba434]
- Updated dependencies [284fd1f]
- Updated dependencies [f6ba434]
- Updated dependencies [0e459ca]
- Updated dependencies [59c670b]
- Updated dependencies [2204021]
- Updated dependencies [f6ba434]
  - @revealui/core@0.6.0
  - @revealui/db@0.4.0
  - @revealui/config@0.4.0
  - @revealui/contracts@1.4.0

## 0.3.5

### Patch Changes

- Charge-readiness phases A-D: billing integration, media library, bulk operations, pagination, sidebar nav, and deploy hardening.
- Updated dependencies
- Updated dependencies
- Updated dependencies
  - @revealui/db@0.3.7
  - @revealui/config@0.3.4
  - @revealui/core@0.5.6
  - @revealui/contracts@1.3.7

## 0.3.4

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
  - @revealui/core@0.5.5
  - @revealui/db@0.3.6
  - @revealui/contracts@1.3.6
  - @revealui/config@0.3.3

## 0.3.3

### Patch Changes

- Updated dependencies
- Updated dependencies
  - @revealui/db@0.3.5
  - @revealui/core@0.5.4
  - @revealui/contracts@1.3.5
  - @revealui/config@0.3.2

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
  fully replaced by production handlers in apps/server during the NeonDB migration.
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

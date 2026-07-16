# @revealui/paywall

## 0.2.0

### Minor Changes

- 5927219: Implement the `@revealui/paywall/x402` subpath. Previously the package advertised this export in its docs but shipped only a stub (`export {}`); it now ships the real HTTP 402 agent payment negotiation helpers: `getX402Config`, `getAdvertisedCurrencyLabel`, `encodePaymentRequired`, `buildPaymentRequired`, `buildPaymentMethods`, and `verifyPayment` (which verifies USDC-on-Base payments via a facilitator and accepts optional `X402VerifyHooks` for logging/metrics). These were extracted from RevealUI's own server middleware, which now imports them from this package instead of maintaining its own copy.

## 0.1.2

### Patch Changes

- Charge-readiness phases A-D: billing integration, media library, bulk operations, pagination, sidebar nav, and deploy hardening.

## 0.1.1

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

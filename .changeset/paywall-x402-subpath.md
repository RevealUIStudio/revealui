---
"@revealui/paywall": minor
---

Implement the `@revealui/paywall/x402` subpath. Previously the package advertised this export in its docs but shipped only a stub (`export {}`); it now ships the real HTTP 402 agent payment negotiation helpers: `getX402Config`, `getAdvertisedCurrencyLabel`, `encodePaymentRequired`, `buildPaymentRequired`, `buildPaymentMethods`, and `verifyPayment` (which verifies USDC-on-Base payments via a facilitator and accepts optional `X402VerifyHooks` for logging/metrics). These were extracted from RevealUI's own server middleware, which now imports them from this package instead of maintaining its own copy.

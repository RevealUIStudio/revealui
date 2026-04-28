---
'@revealui/services': minor
---

`verifyRvuiPayment` now runs the safeguards pipeline (replay protection,
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

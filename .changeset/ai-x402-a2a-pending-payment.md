---
'@revealui/ai': minor
---

A2A handler now emits `pending-payment` task state when the resolved
agent definition has a `pricing` field AND no payment proof was verified
upstream by the route. The HTTP layer (`apps/server/src/routes/a2a.ts`)
verifies `X-PAYMENT-PAYLOAD` headers before calling the handler, sets
`{ paymentVerified: true }` on success, and converts `pending-payment`
states into HTTP 402 responses with `X-PAYMENT-REQUIRED` headers (using
the existing `buildPaymentRequired` + `encodePaymentRequired` middleware
primitives).

Pricing rides on `task.metadata.pricing` so the route can build the 402
body without re-querying the agent registry. Tasks in the
`pending-payment` state are cancelable so a requester who decides not to
pay can release the task slot.

`handleA2AJsonRpc` and `handleTasksSend` gain an optional
`options?: { paymentVerified?: boolean }` 4th parameter (backward
compatible — falsy by default). USDC remains the primary settlement
currency; RVUI is gated behind `RVUI_PAYMENTS_ENABLED=false` in prod
pending the safeguards-pipeline fix tracked separately.

Part of the GAP-149 (x402 / A2A wiring) sequence — PR 2 of N.

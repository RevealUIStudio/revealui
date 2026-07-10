---
"@revealui/contracts": patch
---

Pricing copy corrections. Repairs a botched em-dash replacement in the perpetual tier feature copy, where `License key  -  never expires` rendered with a doubled space-hyphen-space in three pricing cards; the replacement is a plain space. Labels the Enterprise `x402 agent payments (USDC)` bullet as coming soon, since `X402_ENABLED` defaults to false and the payment-methods route returns 404 when it is off. Drops a stale comment that cited a closed gap as an open blocker on the signup gate. No type, export, or price changes.

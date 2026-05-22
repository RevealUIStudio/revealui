---
"@revealui/contracts": minor
"@revealui/db": minor
"@revealui/services": minor
"@revealui/core": minor
"@revealui/mcp": minor
---

Remove the RevealCoin (RVUI) on-chain payment integration. RevealCoin is a separate pre-launch product; this drops its wiring from the framework while leaving x402 micropayments (USDC on Base) fully intact.

- **@revealui/contracts**: removed the RevealCoin module exports (token config, mint addresses, allocations, amount helpers) and the `rvuiDiscount` pricing field; the agent `pricing` schema is now USDC-only.
- **@revealui/db**: dropped the `revealcoin_payments` and `revealcoin_price_snapshots` tables (migration `0016`) and their generated types.
- **@revealui/services**: removed the `./revealcoin` entry point (on-chain client, price oracle, payment safeguards).
- **@revealui/core**: x402 observability is USDC-only — removed the safeguard-rejection counter and narrowed the payment-metric currency/scheme labels.
- **@revealui/mcp**: removed the `revealcoin` contracts-introspection category.

Breaking for any consumer importing the removed symbols (minor bumps under pre-1.0 SemVer).

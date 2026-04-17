---
"@revealui/services": minor
---

Add `invoices.list`, `invoices.retrieve`, and `refunds.create` to `protectedStripe` — all routed through the DB-backed circuit breaker with retry logic. Enables billing routes to use a single shared Stripe client instead of maintaining a separate in-memory circuit breaker.

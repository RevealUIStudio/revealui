---
"@revealui/db": minor
---

Add a claim/complete idempotency state to `processed_webhook_events` (`status` +
`claimed_at`) and a per-event `agent_credit_events` ledger, with migration 0017.

Enables crash-safe Stripe webhook processing: an event is claimed as
`processing` and only marked `completed` after its side effects run, so an
uncaught crash/timeout leaves the event reclaimable (a later retry re-runs it)
rather than a permanent dedup marker that silently drops a paid event. The
credit ledger makes credit-bundle application idempotent on replay. Existing
rows migrate as `completed` (default), preserving dedup of already-processed
events.

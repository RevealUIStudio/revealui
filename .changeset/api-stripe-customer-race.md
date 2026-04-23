---
'api': patch
---

Fix Stripe customer dual-write race in `ensureStripeCustomer()` (closes #394).

The prior implementation protected against concurrent-request races via Stripe's idempotency-key mechanism (`create-customer-${userId}`) plus a conditional `UPDATE WHERE stripe_customer_id IS NULL`. That worked for simultaneous requests.

What it didn't defend against: **delayed-retry races**. Stripe idempotency keys have a ~24-hour TTL. If a request succeeded in creating a Stripe customer but the subsequent DB write failed, and then >24h later another call retried, the Stripe customer creation would produce a *new* customer (idempotency expired) rather than returning the original — resulting in two Stripe customers for one user and split billing state.

This change adds a Postgres advisory lock scoped per-user (`pg_advisory_xact_lock(hashtext('stripe:ensure:' || userId))`) around the read→create→write critical section. Within the lock, the function re-reads the DB to catch any customer that was written by another path during the wait, and only invokes Stripe when no customer exists. The lock requires a real pg connection, which #390's shared `getRestPool()` primitive makes available from this billing path (NeonDB HTTP driver doesn't support transactions).

When the pool is unavailable (build-time contexts with no `DATABASE_URL`), the function falls back to the previous conditional-UPDATE best-effort pattern and logs a warning so any production fallback is visible.

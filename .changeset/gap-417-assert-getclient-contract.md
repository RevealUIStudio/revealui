---
'@revealui/db': minor
'@revealui/auth': minor
---

Close the audit env-parity fail-open (GAP-417 item 5): `@revealui/db` now exports `hasDatabaseConnectionEnv()`, a boot-time predicate that matches `getClient()`'s connection resolution exactly (config url, then POSTGRES_URL / DATABASE_URL), and `assertAuditStorageEnv` consumes it instead of a local triple that also accepted `DATABASE_HOST` — an env shape `getClient()` never consults, which let the assert pass, the install throw, and production silently keep the in-memory audit sink.

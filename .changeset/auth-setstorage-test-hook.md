---
"@revealui/auth": patch
---

Add `setStorage()` to the rate-limit/brute-force storage factory — a test hook to pin a specific backend (e.g. `InMemoryStorage`). Lets the DB-backed integration suite run the rate-limit/lockout logic against in-process state instead of the shared `DatabaseStorage` singleton, removing Postgres-pool contention that intermittently dropped writes under `isolate:false`.

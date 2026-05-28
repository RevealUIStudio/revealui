---
"@revealui/db": patch
---

Attach an `'error'` event handler to the pg pools created by the database client (localhost / self-hosted Postgres path). A pg `Pool` is an EventEmitter, and an unhandled `'error'` event — emitted when an idle connection is dropped by the server (admin termination, autosuspend, network blip) — throws and crashes the process. The handler logs the error and keeps the pool alive, matching the existing behavior in `pool.ts` (Neon-backed deployments use the HTTP driver and are unaffected).

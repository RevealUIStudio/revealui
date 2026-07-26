---
'@revealui/security': patch
---

Anchor the process-wide `audit` singleton on `globalThis` (keyed via `Symbol.for`) so bundlers that duplicate the package's module graph across chunks (observed with Turbopack in the admin production build) still resolve one shared `AuditSystem` instance. Fixes the boot-time persistent-storage swap landing on a different module copy than the one routes resolve, which left production admin audit emits in-memory and `/api/health` reporting `audit-storage: unhealthy`.

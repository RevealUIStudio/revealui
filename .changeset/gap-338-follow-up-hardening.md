---
'@revealui/security': minor
---

Add `AuditSystem.isInMemoryStorage()`, a read-only probe that reports whether the audit system is still on the in-memory default. Lets a route-bundle context (e.g. the admin health endpoint) prove the boot-time persistent-storage swap reached the same singleton it resolves (GAP-338 follow-up to the revealui#2156 review).

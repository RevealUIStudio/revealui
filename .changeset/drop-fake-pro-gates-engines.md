---
'@revealui/engines': minor
---

Remove `checkServicesLicense` re-export from the payments primitive. The function
is removed from `@revealui/services` per the 2026-05-08 charge-readiness audit
Phase 2 Path A; this removes the dangling re-export from the engines barrel.

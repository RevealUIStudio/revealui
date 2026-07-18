---
'@revealui/db': minor
---

audit_log ONE DOOR (GAP-355 Stage 2): `DrizzleAuditStore.append`/`appendBatch` now accept optional `signature`/`previousSignature` pass-through, so every `audit_log` writer routes through the single store (a new CI enforcer fails the build on any `insert(auditLog)` outside it). Absent values persist NULL, unchanged from Stage 1. Signing itself moves into the store in Stage 3.

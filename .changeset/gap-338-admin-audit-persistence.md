---
'@revealui/auth': minor
---

Add the shared audit storage boundary (`DrizzleBackedAuditStorage`, `installAuditStorage`, `assertAuditStorageEnv`, `auditStorageSelfTest`, `createAuditStore`, `getAuditRowSigner`, `mapSeverityToDb`) to `@revealui/auth/server`, moved from apps/server so the admin process can install persistent, signed audit storage at boot. Fixes the defect where every admin-process audit emit (including login receipts) landed in the default in-memory store and evaporated on restart (GAP-338).

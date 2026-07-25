---
'@revealui/auth': minor
---

Add the shared audit storage boundary (`DrizzleBackedAuditStorage`, `installAuditStorage`, `assertAuditStorageEnv`, `auditStorageSelfTest`, `createAuditStore`, `getAuditRowSigner`, `mapSeverityToDb`) at the dedicated subpath `@revealui/auth/audit-storage`, moved from apps/server so the admin process can install persistent, signed audit storage at boot. The boundary is deliberately not re-exported from the `@revealui/auth/server` barrel: route tests bare-mock that barrel for `getSession`, and a bare mock must never swallow the audit write path. Fixes the defect where every admin-process audit emit (including login receipts) landed in the default in-memory store and evaporated on restart (GAP-338).

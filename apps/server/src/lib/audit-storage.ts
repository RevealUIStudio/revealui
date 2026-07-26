/**
 * Thin re-export — the audit storage boundary moved to `@revealui/auth/server`
 * (GAP-338) so the admin process can install persistent audit storage too.
 * This shim keeps every existing apps/server import path working; the ONE
 * implementation (severity boundary mapping, `DrizzleBackedAuditStorage`,
 * env parity assert, install helper, boot self-test) lives in
 * `packages/auth/src/server/audit-storage.ts`.
 */

export {
  assertAuditStorageEnv,
  auditStorageSelfTest,
  DrizzleBackedAuditStorage,
  installAuditStorage,
  mapSeverityToDb,
} from '@revealui/auth/audit-storage';

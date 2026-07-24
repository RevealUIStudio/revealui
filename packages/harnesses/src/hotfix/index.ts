/**
 * Hotfix → durable registry (RevealUI control layer).
 *
 * Prefer durable root-cause fixes. Use this registry only when a temporary
 * patch is unavoidable and must be converted.
 */

export { runHotfixCli } from './cli.js';
export {
  controlHotfixDir,
  controlManifestPath,
  legacyClaudeManifestPath,
  revealuiDataDir,
} from './paths.js';
export {
  ageDays,
  auditHotfixes,
  ENTRY_RETENTION_DAYS,
  findEntry,
  formatAuditReport,
  formatCheckLines,
  OVERDUE_DAYS,
  pendingEntries,
  promoteHotfix,
  registerHotfix,
  resolveHotfix,
  slugify,
  sweepResolved,
} from './registry.js';
export { loadManifest, saveManifest } from './store.js';
export type {
  AuditHit,
  AuditReport,
  HotfixEntry,
  HotfixManifest,
  HotfixStatus,
  RegisterHotfixInput,
  ResolveHotfixInput,
} from './types.js';

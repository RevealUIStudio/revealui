export type { ImplementedHookSource } from './normalizers/index.js';
export {
  isImplementedHookSource,
  normalizeClaudeCodeHookEvent,
  normalizeCursorHookEvent,
  normalizeHookEvent,
  normalizeVSCodeHookEvent,
} from './normalizers/index.js';
export type {
  MasterSpecCouplingOptions,
  MasterSpecCouplingWarning,
  ProductContext,
} from './master-spec-coupling.js';
export {
  emitMasterSpecCouplingWarnings,
  evaluateMasterSpecCoupling,
  isCanonDirty,
  isMasterSpecTriggerPath,
  resolveProductContext,
} from './master-spec-coupling.js';
export type {
  PolicyDecision,
  PolicySnapshot,
  PolicySnapshotInvalidReason,
  PolicySnapshotLoadResult,
  PolicySnapshotRule,
} from './policy.js';
export { evaluatePolicy, loadPolicySnapshot } from './policy.js';
export type {
  HookRunOptions,
  HookRunResult,
} from './run-hook.js';
export {
  defaultHookRunOptions,
  getDefaultPolicySnapshotPath,
  getDefaultSpoolPath,
  getHarnessDataDir,
  runHookCommand,
} from './run-hook.js';
export type { FlushConfig, FlushResult, SpoolAppendResult, SpoolRecord } from './spool.js';
export { appendToSpool, DEFAULT_SPOOL_MAX_BYTES, flushSpool } from './spool.js';

/**
 * @revealui/harnesses  -  AI Harness Integration System (Server-side)
 *
 * Adapters, registry, workboard coordination, and JSON-RPC server for
 * integrating native AI agents into the RevealUI development workflow.
 *
 * @packageDocumentation
 */

// Config
export {
  diffAllConfigs,
  diffConfig,
  syncAllConfigs,
  syncConfig,
  validateConfigJson,
} from './config/config-sync.js';
export {
  getConfigurableHarnesses,
  getLocalConfigPath,
  getRootConfigPath,
} from './config/harness-config-paths.js';
export type {
  Agent,
  Command,
  ContentGenerator,
  ContentSummary,
  DiffEntry,
  GeneratedFile,
  Manifest,
  PreambleTier,
  ResolverContext,
  Rule,
  Skill,
  ValidationResult,
} from './content/index.js';
// Content layer (canonical content definitions and generators)
export {
  buildManifest,
  ClaudeCodeGenerator,
  CursorGenerator,
  diffContent,
  generateContent,
  listContent,
  OpenCodeGenerator,
  VSCodeGenerator,
  validateManifest,
} from './content/index.js';
export type { CoordinatorOptions } from './coordinator.js';
// Coordinator
export { HarnessCoordinator } from './coordinator.js';
// Detection
export { autoDetectHarnesses } from './detection/auto-detector.js';
export {
  findAllHarnessProcesses,
  findClaudeCodeSockets,
  findHarnessProcesses,
  findProcesses,
} from './detection/process-detector.js';
// Goals (goal-driven coordination; propose-only)
export type {
  CreateGoalInput,
  CriterionRecordResult,
  CriterionStatus,
  GoalAction,
  GoalActionItem,
  GoalHarnessOptions,
  GoalOwner,
  GoalPriority,
  GoalProgress,
  GoalStatus,
  GoalTransitionResult,
  GoalWithCriteria,
  ProposeTaskResult,
} from './goals/index.js';
export {
  CRITERION_STATUSES,
  createGoalInputSchema,
  GOAL_ACTIONS,
  GOAL_OWNERS,
  GOAL_PRIORITIES,
  GOAL_STATUSES,
  GoalHarness,
} from './goals/index.js';
// Hooks  -  normalizers, local policy evaluation, receipt spool (see also `./hooks` subpath export)
export type {
  FlushConfig,
  FlushResult,
  HookRunOptions,
  HookRunResult,
  ImplementedHookSource,
  PolicyDecision,
  PolicySnapshot,
  PolicySnapshotInvalidReason,
  PolicySnapshotLoadResult,
  PolicySnapshotRule,
  SpoolAppendResult,
  SpoolRecord,
} from './hooks/index.js';
export {
  appendToSpool,
  DEFAULT_SPOOL_MAX_BYTES,
  defaultHookRunOptions,
  evaluatePolicy,
  flushSpool,
  getDefaultPolicySnapshotPath,
  getDefaultSpoolPath,
  getHarnessDataDir,
  isImplementedHookSource,
  loadPolicySnapshot,
  normalizeClaudeCodeHookEvent,
  normalizeCursorHookEvent,
  normalizeHookEvent,
  normalizeVSCodeHookEvent,
  runHookCommand,
} from './hooks/index.js';
// Project manager (.revealui) — equal vendor adapters reference this tree
export type { ManagerCheckResult, ManagerConfig, MaterializeResult } from './manager/index.js';
export {
  checkManager,
  loadManager,
  ManagerSchema,
  materializeManager,
  writeManager,
} from './manager/index.js';
// Harness Protocol (was VAUGHN until 2026-05-18; see docs/HARNESS_PROTOCOL.md)
export type {
  ClaudeCodeSettings,
  ConfigGenerationResult,
  CursorMcpConfig,
  CursorMcpOptions,
  CursorMcpServerConfig,
  DegradationStrategy,
  GeneratedFiles,
  HookGranularity,
  McpServerConfig,
  MemoryBackend,
  NormalizedEvent,
  OpenCodeConfig,
  OpenCodeMcpOptions,
  OpenCodeMcpServerConfig,
  ProtocolAdapter,
  ProtocolAdapterInfo,
  ProtocolCapabilities,
  ProtocolCommand,
  ProtocolCommandResult,
  ProtocolConfig,
  ProtocolError,
  ProtocolErrorCode,
  ProtocolEvent,
  ProtocolEventEnvelope,
  ProtocolRule,
  ProtocolSkill,
  SandboxMode,
  VSCodeMcpConfig,
  VSCodeMcpInput,
  VSCodeMcpOptions,
  VSCodeMcpServerConfig,
} from './protocol/index.js';
export {
  claudeSettingsToProtocolConfig,
  createDefaultCapabilities,
  createEventEnvelope,
  EventNormalizer,
  generateAllConfigs,
  getDegradationStrategy,
  PROTOCOL_EVENTS,
  PROTOCOL_VERSION,
  protocolConfigToAgentsMd,
  protocolConfigToClaudeSettings,
  protocolConfigToCursorMcpConfig,
  protocolConfigToCursorrules,
  protocolConfigToOpencodeConfig,
  protocolConfigToVSCodeMcpConfig,
  protocolEventEnvelopeSchema,
  protocolEventSchema,
  TOOL_PROFILES,
} from './protocol/index.js';
// Registry
export { HarnessRegistry } from './registry/harness-registry.js';
// Server
export { RpcServer } from './server/rpc-server.js';
export type {
  ReconcileResult,
  SharedFact,
  SharedMemory,
  SharedMemoryClientConfig,
  YjsPatch,
} from './server/shared-memory-client.js';
export { SharedMemoryClient } from './server/shared-memory-client.js';
export type { DaemonStoreConfig } from './storage/daemon-store.js';
// Storage (PGlite-backed daemon state)
export { DaemonStore } from './storage/daemon-store.js';
export type {
  AgentMessage,
  AgentSession,
  AgentTask,
  DaemonEvent,
  FileReservation,
  GoalCriterionRow,
  GoalRow,
} from './storage/schema.js';
export { SCHEMA_SQL } from './storage/schema.js';
export type { HarnessAdapter } from './types/adapter.js';
// Types  -  harness core
export type {
  ConfigDiffEntry,
  ConfigSyncDirection,
  ConfigSyncResult,
  HarnessCapabilities,
  HarnessCommand,
  HarnessCommandResult,
  HarnessEvent,
  HarnessInfo,
  HarnessProcessInfo,
  HealthCheckResult,
} from './types/core.js';
// Types  -  normalized hook events
export type {
  HarnessEnforcementTier,
  HarnessHookEvent,
  HarnessHookEventKind,
  HarnessHookIdentity,
  HarnessHookSource,
} from './types/hook-event.js';
export { HARNESS_HOOK_EVENT_KINDS, HARNESS_HOOK_SOURCES } from './types/hook-event.js';
// Workboard
export {
  acquireLock,
  atomicWriteSync,
  deriveSessionId,
  detectSessionType,
  lockPathFor,
  releaseLock,
  WorkboardManager,
  withLock,
  withLockAsync,
} from './workboard/index.js';
// Types  -  session identity
export type { SessionType } from './workboard/session-identity.js';
// Types  -  workboard protocol
export type {
  ConflictResult,
  WorkboardState,
} from './workboard/workboard-protocol.js';

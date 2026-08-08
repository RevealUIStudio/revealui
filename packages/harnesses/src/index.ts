/**
 * @revealui/harnesses  -  AI Harness Integration System (Server-side)
 *
 * Adapters, registry, content definitions, and workboard primitives for
 * integrating native AI agents into the RevealUI development workflow. The
 * coordination runtime (RPC server, storage, spawner) lives in the RevDev
 * daemon; see the daemon-ownership ADR (2026-07-25).
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
  buildContentSnapshot,
  buildManifest,
  ClaudeCodeGenerator,
  CursorGenerator,
  checkAllContentSnapshots,
  checkContentSnapshot,
  diffContent,
  generateContent,
  listContent,
  OpenCodeGenerator,
  VSCodeGenerator,
  validateManifest,
  writeAllContentSnapshots,
} from './content/index.js';
// ACP agent plane (GAP-381 Phase D)
export {
  createDefaultAcpPromptExecutor,
  createRevealUiAcpAgent,
  extractPromptText,
  runRevealUiAcpAgentStdio,
  type AcpPromptExecutor,
  type AcpPromptInput,
  type AcpPromptResult,
  type RevealUiAcpAgentOptions,
} from './acp/index.js';
// Detection
export { autoDetectHarnesses } from './detection/auto-detector.js';
export {
  findAllHarnessProcesses,
  findClaudeCodeSockets,
  findHarnessProcesses,
  findProcesses,
} from './detection/process-detector.js';
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
  flushSpoolAsync,
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
export type {
  LocalAiProfileView,
  ModelPullResult,
  OllamaModel,
  OllamaStatus,
  SnapModel,
  SnapStatus,
} from './server/inference-service.js';
export { InferenceService, PRODUCT_INFERENCE_SNAPS } from './server/inference-service.js';
// HTTP gateway + PGlite DaemonStore were deleted after the RevDev port
// (revdev#328/#329). Remote pairing lives in @revdev/daemon only.
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

/**
 * @revealui/harnesses  -  AI Harness Integration System (Server-side)
 *
 * Adapters, registry, workboard coordination, and JSON-RPC server for
 * integrating native AI agents into the RevealUI development workflow.
 *
 * Pro tier feature: gated behind isFeatureEnabled("ai").
 *
 * @packageDocumentation
 */

import { isFeatureEnabled } from '@revealui/core/features';
import { initializeLicense } from '@revealui/core/license';
import { logger } from '@revealui/core/observability/logger';

/** Check whether the harnesses feature is licensed for this installation. */
export async function checkHarnessesLicense(): Promise<boolean> {
  await initializeLicense();
  if (!isFeatureEnabled('ai')) {
    logger.warn(
      '[@revealui/harnesses] AI harness integration requires a Pro or Enterprise license. ' +
        'Visit https://revealui.com/pricing for details.',
      { feature: 'ai' },
    );
    return false;
  }
  return true;
}

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
  diffContent,
  generateContent,
  listContent,
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
// Registry
export { HarnessRegistry } from './registry/harness-registry.js';
// Server
export { RpcServer } from './server/rpc-server.js';
export type { DaemonStoreConfig } from './storage/daemon-store.js';
// Storage (PGlite-backed daemon state)
export { DaemonStore } from './storage/daemon-store.js';
export type {
  AgentMessage,
  AgentSession,
  AgentTask,
  DaemonEvent,
  FileReservation,
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
  WorkboardEntry,
  WorkboardSession,
  WorkboardState,
} from './workboard/workboard-protocol.js';

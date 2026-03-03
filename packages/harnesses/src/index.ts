/**
 * @revealui/harnesses — AI Harness Integration System (Server-side)
 *
 * Adapters, registry, workboard coordination, and JSON-RPC server for
 * integrating AI coding tools (Claude Code, Cursor, Copilot) into the
 * RevealUI development workflow.
 *
 * Pro tier feature: gated behind isFeatureEnabled("harnesses").
 *
 * @packageDocumentation
 */

import { isFeatureEnabled } from '@revealui/core/features'
import { initializeLicense } from '@revealui/core/license'
import { logger } from '@revealui/core/observability/logger'

/** Check whether the harnesses feature is licensed for this installation. */
export async function checkHarnessesLicense(): Promise<boolean> {
  await initializeLicense()
  if (!isFeatureEnabled('harnesses')) {
    logger.warn(
      '[@revealui/harnesses] AI harness integration requires a Pro or Enterprise license. ' +
        'Visit https://revealui.com/pricing for details.',
      { feature: 'harnesses' },
    )
    return false
  }
  return true
}

// Adapters
export { ClaudeCodeAdapter } from './adapters/claude-code-adapter.js'
export { CopilotAdapter } from './adapters/copilot-adapter.js'

// Config
export { diffConfig, syncConfig } from './config/config-sync.js'
export {
  getConfigurableHarnesses,
  getLocalConfigPath,
  getSsdConfigPath,
} from './config/harness-config-paths.js'
export type { CoordinatorOptions } from './coordinator.js'
// Coordinator
export { HarnessCoordinator } from './coordinator.js'

// Detection
export { autoDetectHarnesses } from './detection/auto-detector.js'
export {
  findAllHarnessProcesses,
  findClaudeCodeSockets,
  findHarnessProcesses,
  findProcesses,
} from './detection/process-detector.js'

// Registry
export { HarnessRegistry } from './registry/harness-registry.js'

// Server
export { RpcServer } from './server/rpc-server.js'
export type { HarnessAdapter } from './types/adapter.js'

// Types — harness core
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
} from './types/core.js'
// Workboard
export {
  deriveSessionId,
  detectSessionType,
  WorkboardManager,
} from './workboard/index.js'
// Types — session identity
export type { SessionType } from './workboard/session-identity.js'
// Types — workboard protocol
export type {
  ConflictResult,
  WorkboardEntry,
  WorkboardSession,
  WorkboardState,
} from './workboard/workboard-protocol.js'

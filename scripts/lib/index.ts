/**
 * @revealui/scripts-lib
 *
 * Shared utilities for RevealUI scripts.
 *
 * @example
 * ```typescript
 * import { createLogger, execCommand, getProjectRoot } from '@revealui/scripts-lib'
 *
 * const logger = createLogger({ prefix: 'MyScript' })
 * const root = await getProjectRoot(import.meta.url)
 *
 * logger.info('Starting...')
 * await execCommand('pnpm', ['build'])
 * logger.success('Done!')
 * ```
 */

// Logger
export {
  createLogger,
  handleASTParseError,
  logger,
  type Logger,
  type LoggerOptions,
  type LogLevel,
} from './logger.js'

// Paths
export {
  clearProjectRootCache,
  getDirname,
  getFilename,
  getProjectRoot,
  getProjectRootSync,
  paths,
  resolvePath,
} from './paths.js'

// Execution
export {
  commandExists,
  execCommand,
  execParallel,
  execSequence,
  runPnpmScript,
  type ExecOptions,
  type ScriptResult,
} from './exec.js'

// State Management
export {
  MemoryStateAdapter,
  PGliteStateAdapter,
  WorkflowStateMachine,
  type ApprovalRequest,
  type ApprovalStatus,
  type PGliteAdapterOptions,
  type StateAdapter,
  type StepStatus,
  type WorkflowEvent,
  type WorkflowState,
  type WorkflowStateMachineOptions,
  type WorkflowStatus,
  type WorkflowStep,
  type WorkflowStepState,
} from './state/index.js'

// Validation
export {
  ALL_TABLES,
  AGENT_TABLES,
  CORE_TABLES,
  CRDT_TABLES,
  detectDatabaseProvider,
  detectEnvironment,
  devEnvFileExists,
  envFileExists,
  isCI,
  listTables,
  OPTIONAL_ENV_VARS,
  parseConnectionString,
  parseEnvFile,
  REQUIRED_ENV_VARS,
  validateDatabaseConnection,
  validateEnv,
  validateEnvWithLogging,
  validateTables,
  type DatabaseConnectionResult,
  type EnvValidationResult,
  type EnvVariable,
} from './validation/index.js'

// Utility functions migrated from base.ts
export { fileExists, prompt, confirm } from './utils.js'

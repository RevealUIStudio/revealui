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

// Argument Parsing
export {
  type ArgDefinition,
  type ArgParser,
  type ArgType,
  type CommandDefinition,
  defineArgs,
  generateHelp,
  getFlag,
  type ParsedArgs,
  type ParserConfig,
  parseArgs,
  validateRequiredArgs,
} from './args.js'
// Build Caching
export {
  BuildCache,
  type BuildCacheOptions,
  type CacheEntry,
  type CacheStats,
  createCache,
} from './cache.js'
// Typed Errors
export {
  configError,
  conflictError,
  ErrorCode,
  ErrorCodeDescriptions,
  executionError,
  getExitCode,
  invalidState,
  isScriptError,
  notFound,
  permissionDenied,
  ScriptError,
  timeoutError,
  validationError,
  withErrorHandling,
  wrapError,
} from './errors.js'
// Enhanced Error Handling
export {
  attemptRecovery,
  enhanceError,
  type EnhancedError,
  type ErrorContext,
  formatError,
  handleCommandError,
  handleDatabaseError,
  handleFileSystemError,
  handleNetworkError,
  handleValidationError,
  printError,
  retryWithEnhancedErrors,
  withErrorHandler,
} from './error-handler.js'
// Execution
export {
  commandExists,
  type ExecOptions,
  execCommand,
  execParallel,
  execSequence,
  runPnpmScript,
  type ScriptResult,
} from './exec.js'
// Logger
export {
  createLogger,
  handleASTParseError,
  type Logger,
  type LoggerOptions,
  type LogLevel,
  logger,
} from './logger.js'
// Dual-Mode Output
export {
  createOutput,
  fail,
  type OutputErrorInfo,
  OutputHandler,
  type OutputHandlerOptions,
  type OutputMetadata,
  type OutputMode,
  ok,
  type ScriptOutput,
} from './output.js'
// Parallel Execution
export {
  batch,
  ParallelExecutor,
  type ParallelOptions,
  type ProgressEvent,
  parallel,
  parallelFilter,
  parallelMap,
  sequential,
  type Task,
  type TaskResult,
} from './parallel.js'
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
// State Management
export {
  type ApprovalRequest,
  type ApprovalStatus,
  MemoryStateAdapter,
  type PGliteAdapterOptions,
  PGliteStateAdapter,
  type StateAdapter,
  type StepStatus,
  type WorkflowEvent,
  type WorkflowState,
  WorkflowStateMachine,
  type WorkflowStateMachineOptions,
  type WorkflowStatus,
  type WorkflowStep,
  type WorkflowStepState,
} from './state/index.js'
// Telemetry & Monitoring
export {
  type AggregatedMetrics,
  createTelemetry,
  getTelemetry,
  type MetricEvent,
  Telemetry,
  type TelemetryOptions,
  type TimerHandle,
  telemetry,
} from './telemetry.js'
// Utility functions migrated from base.ts
export {
  confirm,
  debounce,
  ensureArray,
  fileExists,
  formatBytes,
  formatDuration,
  generateId,
  prompt,
  readFileContent,
  readFileIfExists,
  requireEnv,
  sleep,
  truncate,
  type ValidateDependenciesOptions,
  validateDependencies,
  waitFor,
  writeFileContent,
} from './utils.js'
// Validation
export {
  AGENT_TABLES,
  ALL_TABLES,
  CORE_TABLES,
  CRDT_TABLES,
  type DatabaseConnectionResult,
  detectDatabaseProvider,
  detectEnvironment,
  devEnvFileExists,
  type EnvValidationResult,
  type EnvVariable,
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
} from './validation/index.js'

/**
 * @revealui/scripts
 *
 * Shared utilities for RevealUI scripts.
 *
 * @example
 * ```typescript
 * import { createLogger, execCommand, getProjectRoot } from '@revealui/scripts'
 *
 * const logger = createLogger({ prefix: 'MyScript' })
 * const root = await getProjectRoot(import.meta.url)
 *
 * logger.info('Starting...')
 * await execCommand('pnpm', ['build'])
 * logger.success('Done!')
 * ```
 *
 * @dependencies
 * - scripts/lib/analyzers/ - Code analysis utilities
 * - scripts/lib/args.ts - CLI argument parsing
 * - scripts/lib/audit/ - Execution logging and auditing
 * - scripts/lib/cache.ts - Build caching
 * - scripts/lib/cli/ - CLI dispatch utilities
 * - scripts/lib/errors.ts - Error handling
 * - scripts/lib/exec.ts - Command execution
 * - scripts/lib/logger.ts - Logging utilities
 * - scripts/lib/output.ts - Output formatting
 * - scripts/lib/paths.ts - Path resolution
 * - scripts/lib/registry/ - Script registry
 * - scripts/lib/state/ - State management
 * - scripts/lib/telemetry.ts - Metrics collection
 * - scripts/lib/utils.ts - General utilities
 * - scripts/lib/versioning/ - Version management
 */

// Code Analyzers (Phase 1 - Consolidated)
export {
  type AnalysisMode,
  analyzeFile,
  analyzeFileAST,
  analyzeFileRegex,
  analyzeFiles,
  type ConsoleAnalysisResult,
  ConsoleAnalyzer,
  type ConsoleUsage,
  categorizeFile,
} from './analyzers/index.js'
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
// CLI Utilities (Unified Command Dispatcher)
export {
  type DispatchMode,
  type DispatchOptions,
  type DispatchResult,
  dispatchCommand,
  dispatchOrThrow,
} from './cli/index.js'
// Unified Error System (merged from error-handler.ts and errors.ts)
export {
  configError,
  conflictError,
  type EnhancedErrorOptions,
  ErrorCode,
  ErrorCodeDescriptions,
  executionError,
  getExitCode,
  invalidState,
  isScriptError,
  notFound,
  permissionDenied,
  retryWithEnhancedErrors,
  ScriptError,
  timeoutError,
  validationError,
  withEnhancedErrors,
  withErrorHandling,
  wrapError,
} from './errors.js'
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
  type ScanDirectoryOptions,
  scanDirectory,
  scanDirectoryAll,
  scanDirectorySync,
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
// Documentation Validators (Phase 1 - Consolidated)
export {
  calculateJSDocCoverage,
  calculateQualityMetrics,
  DocumentationValidator,
  type DocValidationOptions,
  findDocumentationFiles,
  type JSDocCoverage,
  type QualityMetrics,
  type ValidationCategory,
  type ValidationIssue,
  type ValidationResult,
  validateDeprecated,
  validateFalseClaims,
  validateJSDoc,
  validateLinks,
  validateScriptRefs,
} from './validators/index.js'

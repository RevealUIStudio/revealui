/**
 * Script Metadata Types
 *
 * Type definitions for script registry metadata extracted from TypeScript files.
 * Used for script discovery, documentation, and validation.
 *
 * @example
 * ```typescript
 * const metadata: ScriptMetadata = {
 *   name: 'backup-database',
 *   filePath: '/scripts/cli/db.ts',
 *   category: 'database',
 *   description: 'Manage database backups',
 *   commands: [
 *     { name: 'backup', description: 'Create database backup', args: [] }
 *   ],
 *   supportsDryRun: true,
 *   requiresConfirmation: true,
 *   dependencies: ['pg', 'zod'],
 *   tags: ['backup', 'database', 'production'],
 *   version: '1.0.0'
 * }
 * ```
 */

// =============================================================================
// Core Types
// =============================================================================

/**
 * Argument definition metadata extracted from script
 */
export interface ArgumentMetadata {
  /** Argument name */
  name: string
  /** Short flag (single character) */
  short?: string
  /** Argument type */
  type: 'string' | 'number' | 'boolean' | 'array'
  /** Argument description */
  description: string
  /** Whether argument is required */
  required?: boolean
  /** Default value */
  default?: unknown
  /** Allowed values (for enums) */
  choices?: string[]
}

/**
 * Command definition metadata extracted from script
 */
export interface CommandMetadata {
  /** Command name */
  name: string
  /** Command description */
  description: string
  /** Command-specific arguments */
  args?: ArgumentMetadata[]
  /** Confirmation prompt for dangerous operations */
  confirmPrompt?: string
  /** Examples of command usage */
  examples?: string[]
}

/**
 * Script dependency metadata
 */
export interface DependencyMetadata {
  /** npm package name */
  name: string
  /** Required version or range */
  version?: string
  /** Whether dependency is required for all commands */
  required: boolean
}

/**
 * Performance characteristics metadata
 */
export interface PerformanceMetadata {
  /** Estimated duration in milliseconds */
  estimatedDuration?: number
  /** Memory usage category */
  memoryUsage?: 'low' | 'medium' | 'high'
  /** CPU usage category */
  cpuUsage?: 'low' | 'medium' | 'high'
  /** Whether script performs I/O operations */
  ioIntensive?: boolean
}

/**
 * Risk assessment metadata
 */
export interface RiskMetadata {
  /** Risk level */
  level: 'low' | 'medium' | 'high' | 'critical'
  /** Operations that contribute to risk */
  operations: ('file-write' | 'file-delete' | 'db-write' | 'db-delete' | 'external-command')[]
  /** Whether operation is reversible */
  reversible: boolean
  /** Rollback complexity */
  rollbackComplexity?: 'simple' | 'moderate' | 'complex'
}

/**
 * Complete script metadata
 */
export interface ScriptMetadata {
  /** Script name (from CLI class name property) */
  name: string

  /** Absolute file path */
  filePath: string

  /** Relative path from project root */
  relativePath: string

  /** Script category (derived from directory structure) */
  category: 'cli' | 'automation' | 'database' | 'deployment' | 'maintenance' | 'validation' | 'other'

  /** Script description */
  description: string

  /** Available commands */
  commands: CommandMetadata[]

  /** Global arguments (available to all commands) */
  globalArgs?: ArgumentMetadata[]

  /** Whether script extends BaseCLI */
  extendsBaseCLI: boolean

  /** Whether script extends EnhancedCLI */
  extendsEnhancedCLI?: boolean

  /** Whether script supports dry-run mode */
  supportsDryRun: boolean

  /** Whether script requires user confirmation */
  requiresConfirmation: boolean

  /** Script dependencies (npm packages) */
  dependencies: DependencyMetadata[]

  /** Import dependencies (other scripts/libs) */
  imports: string[]

  /** Tags for categorization and search */
  tags: string[]

  /** Script version (if versioned) */
  version?: string

  /** Performance characteristics */
  performance?: PerformanceMetadata

  /** Risk assessment */
  risk?: RiskMetadata

  /** Last modified timestamp */
  lastModified: Date

  /** Whether script has associated tests */
  hasTests?: boolean

  /** Documentation URL or path */
  docsUrl?: string

  /** Usage examples */
  examples?: string[]

  /** Deprecation information */
  deprecated?: {
    /** Whether script is deprecated */
    isDeprecated: boolean
    /** Deprecation reason */
    reason?: string
    /** Replacement script */
    replacement?: string
    /** Removal version */
    removeInVersion?: string
  }

  /** Contract information (if uses Zod contracts) */
  contract?: {
    /** Input schema name */
    inputSchema?: string
    /** Output schema name */
    outputSchema?: string
  }
}

/**
 * Script registry entry (simplified for registry JSON)
 */
export interface ScriptRegistryEntry {
  name: string
  filePath: string
  relativePath: string
  category: string
  description: string
  commands: string[]
  supportsDryRun: boolean
  requiresConfirmation: boolean
  tags: string[]
  version?: string
  deprecated?: boolean
  lastModified: string
}

/**
 * Complete script registry
 */
export interface ScriptRegistry {
  /** Registry version */
  version: string

  /** Generation timestamp */
  generatedAt: string

  /** Total number of scripts */
  totalScripts: number

  /** Scripts by category */
  byCategory: Record<string, ScriptRegistryEntry[]>

  /** All scripts */
  scripts: ScriptRegistryEntry[]

  /** Registry statistics */
  stats: {
    totalCommands: number
    scriptsWithDryRun: number
    scriptsWithConfirmation: number
    scriptsDeprecated: number
    extendsBaseCLI: number
    extendsEnhancedCLI: number
  }
}

// =============================================================================
// Search and Filter Types
// =============================================================================

/**
 * Script search criteria
 */
export interface ScriptSearchCriteria {
  /** Search query (matches name, description, tags) */
  query?: string

  /** Filter by category */
  category?: string

  /** Filter by tags (any match) */
  tags?: string[]

  /** Filter by dry-run support */
  supportsDryRun?: boolean

  /** Filter by confirmation requirement */
  requiresConfirmation?: boolean

  /** Filter by deprecated status */
  includeDeprecated?: boolean

  /** Filter by CLI base class */
  extendsEnhancedCLI?: boolean

  /** Filter by command name */
  command?: string
}

/**
 * Script search result
 */
export interface ScriptSearchResult {
  /** Matched script metadata */
  script: ScriptRegistryEntry

  /** Match score (0-1, higher is better) */
  score: number

  /** Matching fields */
  matches: {
    field: string
    value: string
  }[]
}

// =============================================================================
// AST Analysis Types
// =============================================================================

/**
 * AST analysis result for a script file
 */
export interface ASTAnalysisResult {
  /** Detected class name */
  className?: string

  /** Base class name */
  baseClass?: string

  /** Class properties */
  properties: {
    name: string
    value?: unknown
  }[]

  /** Methods defined in class */
  methods: string[]

  /** Import statements */
  imports: {
    source: string
    specifiers: string[]
  }[]

  /** Exported identifiers */
  exports: string[]
}

// =============================================================================
// Utility Types
// =============================================================================

/**
 * Script metadata extraction options
 */
export interface ExtractionOptions {
  /** Project root directory */
  projectRoot: string

  /** Whether to include full AST analysis */
  fullAnalysis?: boolean

  /** Whether to extract performance metadata */
  extractPerformance?: boolean

  /** Whether to assess risk */
  assessRisk?: boolean
}

/**
 * Metadata validation result
 */
export interface MetadataValidationResult {
  /** Whether metadata is valid */
  valid: boolean

  /** Validation errors */
  errors: string[]

  /** Validation warnings */
  warnings: string[]
}

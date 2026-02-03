/**
 * Enhanced Base CLI
 *
 * Extends BaseCLI with integrated support for:
 * - Pre-execution validation
 * - Automatic execution logging
 * - Snapshot creation and rollback
 * - Dry-run mode
 * - Impact analysis
 * - Post-execution verification
 *
 * 100% backward compatible - scripts opt-in by extending EnhancedCLI instead of BaseCLI.
 *
 * @example
 * ```typescript
 * class MyScript extends EnhancedCLI {
 *   name = 'my-script'
 *   description = 'My enhanced script'
 *
 *   // Enable features
 *   enableValidation = true
 *   enableSnapshots = true
 *   enableDryRun = true
 *
 *   defineCommands() {
 *     return [
 *       {
 *         name: 'run',
 *         description: 'Run the script',
 *         handler: async () => this.runOperation(),
 *       }
 *     ]
 *   }
 *
 *   async runOperation() {
 *     // Pre-validation happens automatically
 *     // Snapshot created automatically
 *     // Execution logged automatically
 *
 *     await this.dryRun.fs.writeFile('output.txt', 'content')
 *
 *     return this.output.success({ message: 'Done' })
 *   }
 * }
 * ```
 */

import { getExecutionLogger } from '../lib/audit/execution-logger.js'
import { createChangePreview } from '../lib/dry-run/change-preview.js'
import { createDryRunEngine, type DryRunEngine } from '../lib/dry-run/dry-run-engine.js'
import { createImpactAnalyzer } from '../lib/dry-run/impact-analyzer.js'
import { ErrorCode, ScriptError } from '../lib/errors.js'
import { getSnapshotManager } from '../lib/rollback/snapshot-manager.js'
import { getUndoEngine } from '../lib/rollback/undo-engine.js'
import type { PostValidationOptions } from '../lib/validation/post-execution.js'
import {
  createPreExecutionValidator,
  type ValidationOptions,
} from '../lib/validation/pre-execution.js'
import { BaseCLI, type CLIOptions } from './_base.js'

// =============================================================================
// Types
// =============================================================================

/**
 * Enhanced CLI configuration
 */
export interface EnhancedCLIConfig {
  /** Enable pre-execution validation */
  enableValidation?: boolean

  /** Validation options */
  validationOptions?: ValidationOptions

  /** Enable automatic snapshots */
  enableSnapshots?: boolean

  /** Enable execution logging */
  enableLogging?: boolean

  /** Enable dry-run mode */
  enableDryRun?: boolean

  /** Enable impact analysis */
  enableImpactAnalysis?: boolean

  /** Enable post-execution verification */
  enablePostValidation?: boolean

  /** Post-validation options */
  postValidationOptions?: PostValidationOptions

  /** Auto-rollback on failure */
  autoRollbackOnFailure?: boolean
}

/**
 * Execution context
 */
export interface ExecutionContext {
  /** Execution ID from logger */
  executionId?: string

  /** Snapshot ID (if created) */
  snapshotId?: string

  /** Dry-run engine instance */
  dryRun: DryRunEngine

  /** Whether this is a dry-run execution */
  isDryRun: boolean

  /** Start time */
  startTime: number
}

// =============================================================================
// Enhanced Base CLI
// =============================================================================

/**
 * Enhanced CLI base class with integrated features
 */
export abstract class EnhancedCLI extends BaseCLI {
  // Feature flags (override in subclass)
  protected enableValidation = false
  protected enableSnapshots = false
  protected enableLogging = true
  protected enableDryRun = false
  protected enableImpactAnalysis = false
  protected enablePostValidation = false
  protected autoRollbackOnFailure = false

  // Validation options (override in subclass)
  protected validationOptions: ValidationOptions = {
    checks: ['env', 'git', 'disk'],
  }

  // Execution context
  private context: ExecutionContext | null = null

  // Component instances
  private validator = createPreExecutionValidator()
  private impactAnalyzer = createImpactAnalyzer()
  private changePreview = createChangePreview()

  /**
   * Get dry-run engine (accessible to subclasses)
   */
  protected get dryRun(): DryRunEngine {
    if (!this.context) {
      throw new Error('Execution context not initialized - call from command handler')
    }
    return this.context.dryRun
  }

  /**
   * Check if running in dry-run mode
   */
  protected isDryRun(): boolean {
    return this.context?.isDryRun ?? false
  }

  /**
   * Get current execution ID
   */
  protected getExecutionId(): string | undefined {
    return this.context?.executionId
  }

  /**
   * Get current snapshot ID
   */
  protected getSnapshotId(): string | undefined {
    return this.context?.snapshotId
  }

  /**
   * Add dry-run flag to global args
   */
  override defineGlobalArgs() {
    const baseArgs = super.defineGlobalArgs()

    if (this.enableDryRun) {
      baseArgs.push({
        name: 'dry-run',
        short: 'n',
        type: 'boolean',
        description: 'Preview changes without executing',
      })
    }

    if (this.enableSnapshots) {
      baseArgs.push({
        name: 'no-snapshot',
        type: 'boolean',
        description: 'Skip snapshot creation',
      })
    }

    return baseArgs
  }

  /**
   * Enhanced beforeRun hook
   */
  override async beforeRun(): Promise<void> {
    await super.beforeRun()

    const startTime = Date.now()
    const isDryRun = this.args.flags['dry-run'] ?? false

    // Initialize execution context
    this.context = {
      dryRun: createDryRunEngine({
        enabled: isDryRun,
        captureBeforeState: true,
        verbose: this.isVerbose(),
      }),
      isDryRun,
      startTime,
    }

    // Step 1: Pre-execution validation
    if (this.enableValidation) {
      await this.runPreValidation()
    }

    // Step 2: Start execution logging
    if (this.enableLogging) {
      await this.startLogging()
    }

    // Step 3: Create snapshot (unless dry-run or disabled)
    if (this.enableSnapshots && !isDryRun && !this.args.flags['no-snapshot']) {
      await this.createSnapshot()
    }
  }

  /**
   * Enhanced afterRun hook
   */
  override async afterRun(): Promise<void> {
    try {
      // Step 1: Show impact analysis (if dry-run)
      if (this.context?.isDryRun && this.enableImpactAnalysis) {
        await this.showImpactAnalysis()
      }

      // Step 2: Post-execution validation
      if (this.enablePostValidation && !this.context?.isDryRun) {
        await this.runPostValidation()
      }

      // Step 3: End execution logging
      if (this.enableLogging && this.context?.executionId) {
        await this.endLogging(true)
      }
    } finally {
      await super.afterRun()
    }
  }

  /**
   * Enhanced error handling
   */
  protected override handleError(error: unknown): ErrorCode {
    const errorCode = super.handleError(error)

    // Auto-rollback on failure
    if (this.autoRollbackOnFailure && this.context?.snapshotId) {
      this.performAutoRollback().catch((rollbackError) => {
        console.error('Auto-rollback failed:', rollbackError)
      })
    }

    // End logging with failure
    if (this.enableLogging && this.context?.executionId) {
      this.endLogging(false, error).catch((logError) => {
        console.error('Failed to log execution end:', logError)
      })
    }

    return errorCode
  }

  // ===========================================================================
  // Pre-Execution
  // ===========================================================================

  /**
   * Run pre-execution validation
   */
  private async runPreValidation(): Promise<void> {
    if (this.isVerbose()) {
      this.output.progress('Running pre-execution validation...')
    }

    const result = await this.validator.validate(this.validationOptions)

    if (!result.passed) {
      const errorMessage = [
        'Pre-execution validation failed:',
        ...result.errors.map((e) => `  - ${e.message}`),
      ].join('\n')

      if (result.fixes.length > 0) {
        const fixes = ['\nSuggested fixes:', ...result.fixes.map((f) => `  - ${f}`)].join('\n')

        throw new ScriptError(errorMessage + fixes, ErrorCode.VALIDATION_ERROR, {
          errors: result.errors,
          fixes: result.fixes,
        })
      }

      throw new ScriptError(errorMessage, ErrorCode.VALIDATION_ERROR, { errors: result.errors })
    }

    if (this.isVerbose() && result.warnings.length > 0) {
      for (const warning of result.warnings) {
        this.output.warn(warning.message)
      }
    }
  }

  /**
   * Run post-execution validation
   */
  private async runPostValidation(): Promise<void> {
    // Implement custom post-validation logic if needed
    // This is a hook for subclasses to override
  }

  // ===========================================================================
  // Execution Logging
  // ===========================================================================

  /**
   * Start execution logging
   */
  private async startLogging(): Promise<void> {
    try {
      const logger = await getExecutionLogger(this.projectRoot)

      const executionId = await logger.startExecution({
        scriptName: this.name,
        command: this.args.command || 'default',
        args: this.args.positional,
        metadata: {
          flags: this.args.flags,
          dryRun: this.context?.isDryRun,
        },
      })

      if (this.context) {
        this.context.executionId = executionId
      }

      if (this.isVerbose()) {
        this.verbose(`Execution ID: ${executionId}`)
      }
    } catch (error) {
      // Log error but don't fail execution
      console.warn('Failed to start execution logging:', error)
    }
  }

  /**
   * End execution logging
   */
  private async endLogging(success: boolean, error?: unknown): Promise<void> {
    if (!this.context?.executionId) return

    try {
      const logger = await getExecutionLogger(this.projectRoot)

      await logger.endExecution(this.context.executionId, {
        success,
        exitCode: success ? 0 : 1,
        error: error instanceof Error ? error.message : error ? String(error) : undefined,
      })
    } catch (logError) {
      console.warn('Failed to end execution logging:', logError)
    }
  }

  // ===========================================================================
  // Snapshots
  // ===========================================================================

  /**
   * Create snapshot before execution
   */
  private async createSnapshot(): Promise<void> {
    try {
      const manager = await getSnapshotManager(this.projectRoot)

      const snapshotName = `${this.name}-${this.args.command || 'default'}-auto`

      if (this.isVerbose()) {
        this.output.progress('Creating snapshot...')
      }

      const snapshotId = await manager.createSnapshot(snapshotName, {
        includeFiles: true,
        includeConfig: true,
        metadata: {
          autoCreated: true,
          scriptName: this.name,
          command: this.args.command,
        },
      })

      if (this.context) {
        this.context.snapshotId = snapshotId
      }

      if (this.isVerbose()) {
        this.verbose(`Snapshot created: ${snapshotId}`)
      }
    } catch (error) {
      // Log warning but don't fail
      this.output.warn(
        `Failed to create snapshot: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  /**
   * Perform auto-rollback
   */
  private async performAutoRollback(): Promise<void> {
    if (!this.context?.snapshotId) return

    try {
      this.output.progress('Performing auto-rollback...')

      const engine = await getUndoEngine(this.projectRoot)

      const result = await engine.restore(this.context.snapshotId, {
        restoreFiles: true,
        restoreConfig: true,
        createBackup: false,
      })

      if (result.success) {
        this.output.progress(`✓ Rollback complete (${result.filesRestored} files restored)`)
      } else {
        this.output.warn(`Rollback failed: ${result.errors.join(', ')}`)
      }
    } catch (error) {
      console.error('Auto-rollback error:', error)
    }
  }

  // ===========================================================================
  // Impact Analysis
  // ===========================================================================

  /**
   * Show impact analysis after dry-run
   */
  private async showImpactAnalysis(): Promise<void> {
    if (!this.context?.dryRun) return

    const changes = this.context.dryRun.getChanges()

    if (changes.length === 0) {
      this.output.progress('No changes detected')
      return
    }

    // Analyze impact
    const analysis = this.impactAnalyzer.analyze(changes)

    // Preview changes
    this.changePreview.render(changes, analysis, {
      format: this.args.flags.json ? 'json' : 'human',
      colors: !this.args.flags.json,
      showDiff: this.isVerbose(),
    })

    // Ask for confirmation if not in JSON mode
    if (!(this.args.flags.json || this.args.flags.force)) {
      const confirmed = await this.changePreview.confirm('Proceed with these changes?', {
        defaultYes: false,
      })

      if (!confirmed) {
        throw new ScriptError('Operation cancelled by user', ErrorCode.CANCELLED)
      }
    }
  }

  // ===========================================================================
  // Helper Methods for Subclasses
  // ===========================================================================

  /**
   * Execute with dry-run support (helper for subclasses)
   */
  protected async executeWithDryRun<T>(operation: () => Promise<T>): Promise<T> {
    if (this.context?.isDryRun) {
      // In dry-run mode, operations are recorded but not executed
      // The actual implementation should use this.dryRun.fs.*, this.dryRun.db.*, etc.
      throw new Error(
        'Use this.dryRun.fs.*, this.dryRun.db.*, etc. directly instead of executeWithDryRun',
      )
    }

    return operation()
  }

  /**
   * Create manual snapshot (accessible to subclasses)
   */
  protected async createManualSnapshot(name: string): Promise<string | null> {
    try {
      const manager = await getSnapshotManager(this.projectRoot)
      return await manager.createSnapshot(name, {
        includeFiles: true,
        includeConfig: true,
        metadata: {
          manuallyCreated: true,
          scriptName: this.name,
        },
      })
    } catch (error) {
      this.output.warn(
        `Failed to create snapshot: ${error instanceof Error ? error.message : String(error)}`,
      )
      return null
    }
  }

  /**
   * Restore from snapshot (accessible to subclasses)
   */
  protected async restoreFromSnapshot(snapshotId: string): Promise<boolean> {
    try {
      const engine = await getUndoEngine(this.projectRoot)

      const result = await engine.restore(snapshotId, {
        restoreFiles: true,
        restoreConfig: true,
      })

      return result.success
    } catch (error) {
      this.output.warn(
        `Failed to restore: ${error instanceof Error ? error.message : String(error)}`,
      )
      return false
    }
  }
}

// =============================================================================
// Helper Function
// =============================================================================

/**
 * Create and run an enhanced CLI instance
 */
export async function runEnhancedCLI<T extends EnhancedCLI>(
  CLIClass: new (options?: CLIOptions) => T,
  options?: CLIOptions,
): Promise<void> {
  const cli = new CLIClass(options)
  await cli.run()
}

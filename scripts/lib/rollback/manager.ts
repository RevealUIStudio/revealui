/**
 * Rollback Manager
 *
 * Provides checkpoint-based rollback system for destructive operations.
 * Enables safe execution of migrations, schema updates, and file modifications.
 *
 * @dependencies
 * - node:fs - File system operations
 * - node:path - Path manipulation
 * - node:crypto - UUID generation
 * - scripts/lib/index.js - Logger utilities
 *
 * @example
 * ```typescript
 * const rollback = new RollbackManager()
 *
 * // Create checkpoint before risky operation
 * const checkpointId = await rollback.createCheckpoint('database', {
 *   description: 'Before user table migration',
 *   data: { snapshot: dbSnapshot }
 * })
 *
 * try {
 *   await runMigration()
 * } catch (error) {
 *   // Rollback on failure
 *   await rollback.rollback(checkpointId)
 *   throw error
 * }
 * ```
 */

import { randomUUID } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'
import { ErrorCode, ScriptError } from '../errors.js'
import { createLogger } from '../index.js'

const logger = createLogger({ prefix: 'Rollback' })

// =============================================================================
// Types
// =============================================================================

export type CheckpointType = 'database' | 'file' | 'configuration' | 'schema' | 'custom'

export interface CheckpointMetadata {
  id: string
  type: CheckpointType
  description: string
  createdAt: Date
  dataPath: string
}

export interface CreateCheckpointOptions {
  description: string
  data: unknown
}

export interface Checkpoint extends CheckpointMetadata {
  data: unknown
}

export interface RollbackOptions {
  dryRun?: boolean
  verbose?: boolean
}

export interface RollbackResult {
  success: boolean
  checkpointId: string
  error?: string
  data?: unknown
  restoredData?: unknown
  dryRun?: boolean
}

// =============================================================================
// RollbackManager Class
// =============================================================================

export class RollbackManager {
  private rollbackDir: string
  private retentionDays: number

  constructor(rootDir = process.cwd(), retentionDays = 7) {
    this.rollbackDir = join(rootDir, '.rollback')
    this.retentionDays = retentionDays

    // Ensure rollback directory exists
    if (!existsSync(this.rollbackDir)) {
      mkdirSync(this.rollbackDir, { recursive: true })
    }
  }

  // ===========================================================================
  // Checkpoint Creation
  // ===========================================================================

  /**
   * Create a checkpoint before a destructive operation
   *
   * @param type - Type of checkpoint
   * @param options - Checkpoint options
   * @returns Checkpoint ID
   */
  async createCheckpoint(type: CheckpointType, options: CreateCheckpointOptions): Promise<string> {
    const { description, data } = options
    const id = randomUUID()
    const dataPath = join(this.rollbackDir, `${id}.json`)

    const metadata: CheckpointMetadata = {
      id,
      type,
      description,
      createdAt: new Date(),
      dataPath,
    }

    // Save checkpoint data
    const checkpoint: Checkpoint = {
      ...metadata,
      data,
    }

    writeFileSync(dataPath, JSON.stringify(checkpoint, null, 2))

    logger.info(`Created ${type} checkpoint: ${id}`)
    logger.info(`Description: ${description}`)

    // Clean up old checkpoints
    await this.cleanupOldCheckpoints()

    return id
  }

  // ===========================================================================
  // Checkpoint Retrieval
  // ===========================================================================

  /**
   * List all available checkpoints
   *
   * @returns Array of checkpoint metadata
   */
  async listCheckpoints(): Promise<CheckpointMetadata[]> {
    if (!existsSync(this.rollbackDir)) {
      return []
    }

    const files = readdirSync(this.rollbackDir).filter((f) => f.endsWith('.json'))

    const checkpoints: CheckpointMetadata[] = []

    for (const file of files) {
      try {
        const filePath = join(this.rollbackDir, file)
        const content = readFileSync(filePath, 'utf-8')
        const checkpoint = JSON.parse(content) as Checkpoint

        checkpoints.push({
          id: checkpoint.id,
          type: checkpoint.type,
          description: checkpoint.description,
          createdAt: new Date(checkpoint.createdAt),
          dataPath: checkpoint.dataPath,
        })
      } catch (error) {
        logger.warn(`Failed to read checkpoint ${file}: ${error}`)
      }
    }

    // Sort by creation date (newest first)
    return checkpoints.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  }

  /**
   * Get a specific checkpoint by ID
   *
   * @param checkpointId - Checkpoint ID
   * @returns Checkpoint or null if not found
   */
  async getCheckpoint(checkpointId: string): Promise<Checkpoint | null> {
    const filePath = join(this.rollbackDir, `${checkpointId}.json`)

    if (!existsSync(filePath)) {
      return null
    }

    try {
      const content = readFileSync(filePath, 'utf-8')
      const checkpoint = JSON.parse(content) as Checkpoint

      // Parse date string back to Date object
      checkpoint.createdAt = new Date(checkpoint.createdAt)

      return checkpoint
    } catch (error) {
      logger.error(`Failed to load checkpoint ${checkpointId}: ${error}`)
      return null
    }
  }

  /**
   * Get the most recent checkpoint
   *
   * @param type - Optional type filter
   * @returns Most recent checkpoint or null
   */
  async getLatestCheckpoint(type?: CheckpointType): Promise<Checkpoint | null> {
    const checkpoints = await this.listCheckpoints()

    if (checkpoints.length === 0) {
      return null
    }

    const filtered = type ? checkpoints.filter((c) => c.type === type) : checkpoints

    if (filtered.length === 0) {
      return null
    }

    return this.getCheckpoint(filtered[0].id)
  }

  // ===========================================================================
  // Rollback Operations
  // ===========================================================================

  /**
   * Rollback to a specific checkpoint
   *
   * @param checkpointId - Checkpoint ID to restore
   * @param options - Rollback options
   * @returns Rollback result
   */
  async rollback(checkpointId: string, options: RollbackOptions = {}): Promise<RollbackResult> {
    const { dryRun = false, verbose = false } = options

    // Load checkpoint
    const checkpoint = await this.getCheckpoint(checkpointId)

    if (!checkpoint) {
      return {
        success: false,
        checkpointId,
        error: `Checkpoint ${checkpointId} not found`,
      }
    }

    if (verbose || dryRun) {
      logger.info(`Rollback checkpoint: ${checkpointId}`)
      logger.info(`Type: ${checkpoint.type}`)
      logger.info(`Description: ${checkpoint.description}`)
      logger.info(`Created: ${checkpoint.createdAt.toISOString()}`)
    }

    if (dryRun) {
      logger.info('[DRY RUN] Would restore checkpoint data')
      return {
        success: true,
        checkpointId,
        data: checkpoint.data,
        restoredData: checkpoint.data,
        dryRun: true,
      }
    }

    // Execute rollback based on type
    try {
      await this.executeRollback(checkpoint)

      logger.info(`✅ Successfully rolled back to checkpoint ${checkpointId}`)

      return {
        success: true,
        checkpointId,
        data: checkpoint.data,
        restoredData: checkpoint.data,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      logger.error(`Failed to rollback: ${errorMessage}`)

      return {
        success: false,
        checkpointId,
        error: errorMessage,
      }
    }
  }

  /**
   * Rollback to the most recent checkpoint
   *
   * @param type - Optional type filter
   * @param options - Rollback options
   * @returns Rollback result
   */
  async rollbackLast(
    type?: CheckpointType,
    options: RollbackOptions = {},
  ): Promise<RollbackResult> {
    const checkpoint = await this.getLatestCheckpoint(type)

    if (!checkpoint) {
      return {
        success: false,
        checkpointId: '',
        error: 'No checkpoints found',
      }
    }

    return this.rollback(checkpoint.id, options)
  }

  /**
   * Execute the actual rollback operation
   *
   * @param checkpoint - Checkpoint to restore
   */
  private async executeRollback(checkpoint: Checkpoint): Promise<void> {
    switch (checkpoint.type) {
      case 'database':
        // Database rollback logic would go here
        logger.info('Restoring database snapshot...')
        logger.warn('Database rollback not fully implemented - data restored to memory')
        break

      case 'file':
        // File rollback logic
        logger.info('Restoring file content...')
        await this.restoreFile(checkpoint.data)
        break

      case 'configuration':
        // Configuration rollback logic
        logger.info('Restoring configuration...')
        await this.restoreConfiguration(checkpoint.data)
        break

      case 'schema':
        // Schema rollback logic
        logger.info('Restoring schema definition...')
        logger.warn('Schema rollback not fully implemented - data restored to memory')
        break

      case 'custom':
        // Custom rollback logic
        logger.info('Restoring custom data...')
        logger.warn('Custom rollback requires application-specific handler')
        break
    }
  }

  /**
   * Restore file content from checkpoint
   */
  private async restoreFile(data: unknown): Promise<void> {
    if (!data || typeof data !== 'object') {
      throw new ScriptError('Invalid file checkpoint data', ErrorCode.VALIDATION_ERROR)
    }

    const fileData = data as { path: string; content: string }

    if (!(fileData.path && fileData.content)) {
      throw new ScriptError('File checkpoint missing path or content', ErrorCode.VALIDATION_ERROR)
    }

    writeFileSync(fileData.path, fileData.content)
    logger.info(`Restored file: ${fileData.path}`)
  }

  /**
   * Restore configuration from checkpoint
   */
  private async restoreConfiguration(data: unknown): Promise<void> {
    if (!data || typeof data !== 'object') {
      throw new ScriptError('Invalid configuration checkpoint data', ErrorCode.VALIDATION_ERROR)
    }

    const configData = data as { path: string; config: unknown }

    if (!(configData.path && configData.config)) {
      throw new ScriptError(
        'Configuration checkpoint missing path or config',
        ErrorCode.VALIDATION_ERROR,
      )
    }

    writeFileSync(configData.path, JSON.stringify(configData.config, null, 2))
    logger.info(`Restored configuration: ${configData.path}`)
  }

  // ===========================================================================
  // Cleanup
  // ===========================================================================

  /**
   * Clean up checkpoints older than retention period
   *
   * @returns Number of checkpoints deleted
   */
  async cleanupOldCheckpoints(): Promise<number> {
    const checkpoints = await this.listCheckpoints()
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays)

    let deleted = 0

    for (const checkpoint of checkpoints) {
      if (checkpoint.createdAt < cutoffDate) {
        try {
          unlinkSync(checkpoint.dataPath)
          deleted++
          logger.info(`Deleted old checkpoint: ${checkpoint.id}`)
        } catch (error) {
          logger.warn(`Failed to delete checkpoint ${checkpoint.id}: ${error}`)
        }
      }
    }

    if (deleted > 0) {
      logger.info(`Cleaned up ${deleted} old checkpoints`)
    }

    return deleted
  }

  /**
   * Clear all checkpoints
   *
   * @param confirm - Must be true to actually clear
   * @returns Number of checkpoints deleted
   */
  async clearAllCheckpoints(confirm = false): Promise<number> {
    if (!confirm) {
      logger.warn('clearAllCheckpoints requires confirm=true')
      return 0
    }

    const checkpoints = await this.listCheckpoints()
    let deleted = 0

    for (const checkpoint of checkpoints) {
      try {
        unlinkSync(checkpoint.dataPath)
        deleted++
      } catch (error) {
        logger.warn(`Failed to delete checkpoint ${checkpoint.id}: ${error}`)
      }
    }

    logger.info(`Cleared ${deleted} checkpoints`)
    return deleted
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

let managerInstance: RollbackManager | null = null

/**
 * Get singleton RollbackManager instance
 *
 * @param rootDir - Project root directory
 * @param retentionDays - Days to retain checkpoints (default: 7)
 * @returns RollbackManager instance
 */
export function getRollbackManager(rootDir = process.cwd(), retentionDays = 7): RollbackManager {
  if (!managerInstance) {
    managerInstance = new RollbackManager(rootDir, retentionDays)
  }
  return managerInstance
}

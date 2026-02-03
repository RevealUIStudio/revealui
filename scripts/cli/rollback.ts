#!/usr/bin/env tsx
/**
 * Rollback CLI
 *
 * Unified interface for rollback operations including snapshots,
 * database migrations, and deployment rollbacks.
 *
 * Usage:
 *   pnpm rollback list                    List available snapshots
 *   pnpm rollback create <name>           Create a snapshot
 *   pnpm rollback restore <id>            Restore from snapshot
 *   pnpm rollback preview <id>            Preview restore operation
 *   pnpm rollback delete <id>             Delete a snapshot
 *   pnpm rollback cleanup                 Clean up old snapshots
 *
 * Examples:
 *   pnpm rollback create "before-migration"
 *   pnpm rollback restore snapshot-123 --dry-run
 *   pnpm rollback preview snapshot-123
 *   pnpm rollback cleanup --days 30
 */

import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ErrorCode, ScriptError } from '../lib/errors.js'
import { getSnapshotManager } from '../lib/rollback/snapshot-manager.js'
import { getUndoEngine } from '../lib/rollback/undo-engine.js'
import { BaseCLI, type CommandDefinition, runCLI } from './_base.js'

// Get project root
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const PROJECT_ROOT = join(__dirname, '../..')

/**
 * Rollback CLI
 */
class RollbackCLI extends BaseCLI {
  name = 'rollback'
  description = 'Manage snapshots and rollback operations'

  defineCommands(): CommandDefinition[] {
    return [
      {
        name: 'list',
        description: 'List all snapshots',
        handler: async () => this.list(),
        args: [
          {
            name: 'limit',
            short: 'l',
            type: 'number',
            description: 'Limit number of results',
          },
          {
            name: 'scope',
            short: 's',
            type: 'string',
            description: 'Filter by scope (files, database, config, full)',
          },
        ],
      },
      {
        name: 'create',
        description: 'Create a new snapshot (usage: rollback create <name>)',
        handler: async () => this.create(),
        args: [
          {
            name: 'files',
            type: 'boolean',
            description: 'Include file system snapshot',
          },
          {
            name: 'database',
            short: 'd',
            type: 'boolean',
            description: 'Include database snapshot',
          },
          {
            name: 'config',
            short: 'c',
            type: 'boolean',
            description: 'Include configuration snapshot',
          },
        ],
      },
      {
        name: 'restore',
        description: 'Restore from a snapshot (usage: rollback restore <id>)',
        handler: async () => this.restore(),
        args: [
          {
            name: 'files',
            type: 'boolean',
            description: 'Restore files',
          },
          {
            name: 'database',
            short: 'd',
            type: 'boolean',
            description: 'Restore database',
          },
          {
            name: 'config',
            short: 'c',
            type: 'boolean',
            description: 'Restore configuration',
          },
          {
            name: 'dry-run',
            type: 'boolean',
            description: 'Preview restore without making changes',
          },
          {
            name: 'backup',
            type: 'boolean',
            description: 'Create backup before restore',
          },
        ],
        confirmPrompt: 'This will restore system state from snapshot. Continue?',
      },
      {
        name: 'preview',
        description: 'Preview a restore operation (usage: rollback preview <id>)',
        handler: async () => this.preview(),
        args: [],
      },
      {
        name: 'delete',
        description: 'Delete a snapshot (usage: rollback delete <id>)',
        handler: async () => this.delete(),
        args: [],
        confirmPrompt: 'This will permanently delete the snapshot. Continue?',
      },
      {
        name: 'cleanup',
        description: 'Clean up old snapshots',
        handler: async () => this.cleanup(),
        args: [
          {
            name: 'days',
            type: 'number',
            description: 'Delete snapshots older than N days',
          },
          {
            name: 'keep',
            type: 'number',
            description: 'Number of recent snapshots to keep',
          },
        ],
        confirmPrompt: 'This will delete old snapshots. Continue?',
      },
    ]
  }

  /**
   * List snapshots
   */
  private async list() {
    const limit = this.getFlag<number>('limit', 0)
    const scope = this.getFlag<string>('scope', '')

    const manager = await getSnapshotManager(PROJECT_ROOT)

    const snapshots = await manager.listSnapshots({
      limit: limit || undefined,
      scope: (scope as any) || undefined,
    })

    if (this.args.flags.json) {
      return this.output.success({ snapshots })
    }

    // Human-readable output
    if (snapshots.length === 0) {
      this.output.warn('No snapshots found')
      return this.output.success({ total: 0 })
    }

    console.log(`\nAvailable Snapshots (${snapshots.length})\n`)

    for (const snapshot of snapshots) {
      const age = this.formatAge(snapshot.createdAt)
      const size = this.formatSize(snapshot.metadata.totalSize)

      console.log(`  ${snapshot.id}`)
      console.log(`    Name: ${snapshot.name}`)
      console.log(`    Created: ${snapshot.createdAt.toLocaleString()} (${age})`)
      console.log(`    Scope: ${snapshot.scope}`)
      console.log(`    Size: ${size}`)
      console.log(`    Files: ${snapshot.metadata.fileCount}`)

      if (snapshot.gitBranch) {
        console.log(
          `    Git: ${snapshot.gitBranch}${snapshot.gitCommit ? ` (${snapshot.gitCommit.substring(0, 7)})` : ''}`,
        )
      }

      console.log()
    }

    return this.output.success({ total: snapshots.length })
  }

  /**
   * Create snapshot
   */
  private async create() {
    const name = this.getPositional(0)
    if (!name) {
      throw new ScriptError('Missing required snapshot name', ErrorCode.VALIDATION_ERROR, {
        usage: 'pnpm rollback create <name>',
      })
    }

    const includeFiles = this.getFlag('files', true)
    const includeDatabase = this.getFlag('database', false)
    const includeConfig = this.getFlag('config', true)

    this.output.progress(`Creating snapshot: ${name}...`)

    const manager = await getSnapshotManager(PROJECT_ROOT)

    const snapshotId = await manager.createSnapshot(name, {
      includeFiles,
      includeDatabase,
      includeConfig,
    })

    const snapshot = await manager.getSnapshot(snapshotId)

    return this.output.success({
      message: 'Snapshot created successfully',
      snapshotId,
      snapshot,
    })
  }

  /**
   * Restore from snapshot
   */
  private async restore() {
    const id = this.getPositional(0)
    if (!id) {
      throw new ScriptError('Missing required snapshot ID', ErrorCode.VALIDATION_ERROR, {
        usage: 'pnpm rollback restore <id>',
      })
    }

    const restoreFiles = this.getFlag('files', true)
    const restoreDatabase = this.getFlag('database', false)
    const restoreConfig = this.getFlag('config', true)
    const dryRun = this.getFlag('dry-run', false)
    const createBackup = this.getFlag('backup', true)

    const engine = await getUndoEngine(PROJECT_ROOT)

    if (dryRun) {
      this.output.progress('Running restore preview...')
    } else {
      this.output.progress('Restoring from snapshot...')
    }

    const result = await engine.restore(id, {
      restoreFiles,
      restoreDatabase,
      restoreConfig,
      dryRun,
      createBackup,
    })

    if (!result.success) {
      return this.output.error({
        message: 'Restore failed',
        errors: result.errors,
        conflicts: result.conflicts,
      })
    }

    if (this.args.flags.json) {
      return this.output.success({ result })
    }

    // Human-readable output
    console.log()
    console.log(`${dryRun ? '✓ Restore Preview' : '✓ Restore Complete'}`)
    console.log()
    console.log(`  Files restored: ${result.filesRestored}`)
    console.log(`  Config files restored: ${result.configFilesRestored}`)
    console.log(`  Database tables restored: ${result.databaseTablesRestored}`)

    if (result.backupSnapshotId) {
      console.log(`  Backup created: ${result.backupSnapshotId}`)
    }

    if (result.conflicts.length > 0) {
      console.log()
      console.log(`  Conflicts detected: ${result.conflicts.length}`)
      for (const conflict of result.conflicts) {
        console.log(`    - ${conflict.resource}: ${conflict.reason}`)
      }
    }

    if (result.warnings.length > 0) {
      console.log()
      console.log('  Warnings:')
      for (const warning of result.warnings) {
        console.log(`    - ${warning}`)
      }
    }

    console.log()

    return this.output.success({ result })
  }

  /**
   * Preview restore operation
   */
  private async preview() {
    const id = this.getPositional(0)
    if (!id) {
      throw new ScriptError('Missing required snapshot ID', ErrorCode.VALIDATION_ERROR, {
        usage: 'pnpm rollback preview <id>',
      })
    }

    const engine = await getUndoEngine(PROJECT_ROOT)

    const preview = await engine.preview(id, {
      restoreFiles: true,
      restoreConfig: true,
      restoreDatabase: false,
    })

    if (this.args.flags.json) {
      return this.output.success({ preview })
    }

    // Human-readable output
    console.log()
    console.log('Restore Preview')
    console.log('='.repeat(60))
    console.log()
    console.log(`Snapshot: ${preview.snapshot.name} (${preview.snapshot.id})`)
    console.log(`Created: ${preview.snapshot.createdAt.toLocaleString()}`)
    console.log()

    console.log('Changes:')
    console.log(`  Files to restore: ${preview.files.length}`)
    console.log(`  Config files to restore: ${preview.configFiles.length}`)
    console.log(`  Database tables to restore: ${preview.databaseTables.length}`)
    console.log()

    console.log(`Estimated duration: ${this.formatDuration(preview.estimatedDuration)}`)
    console.log()

    if (preview.conflicts.length > 0) {
      console.log('⚠️  Conflicts:')
      for (const conflict of preview.conflicts) {
        console.log(`  - ${conflict.resource}: ${conflict.reason}`)
      }
      console.log()
    }

    if (preview.files.length > 0 && preview.files.length <= 20) {
      console.log('Files:')
      for (const file of preview.files) {
        console.log(`  - ${file}`)
      }
      console.log()
    }

    return this.output.success({ preview })
  }

  /**
   * Delete snapshot
   */
  private async delete() {
    const id = this.getPositional(0)
    if (!id) {
      throw new ScriptError('Missing required snapshot ID', ErrorCode.VALIDATION_ERROR, {
        usage: 'pnpm rollback delete <id>',
      })
    }

    const manager = await getSnapshotManager(PROJECT_ROOT)

    const deleted = await manager.deleteSnapshot(id)

    if (!deleted) {
      throw new ScriptError(`Snapshot not found: ${id}`, ErrorCode.NOT_FOUND, { id })
    }

    return this.output.success({
      message: 'Snapshot deleted successfully',
      snapshotId: id,
    })
  }

  /**
   * Cleanup old snapshots
   */
  private async cleanup() {
    const days = this.getFlag<number>('days', 30)
    const keep = this.getFlag<number>('keep', 10)

    const manager = await getSnapshotManager(PROJECT_ROOT)

    this.output.progress('Cleaning up old snapshots...')

    const deletedCount = await manager.cleanup({
      olderThanDays: days,
      keepCount: keep,
    })

    return this.output.success({
      message: `Cleaned up ${deletedCount} snapshot${deletedCount === 1 ? '' : 's'}`,
      deletedCount,
    })
  }

  // ===========================================================================
  // Helper Methods
  // ===========================================================================

  /**
   * Format age from date
   */
  private formatAge(date: Date): string {
    const now = Date.now()
    const age = now - date.getTime()

    const minutes = Math.floor(age / (1000 * 60))
    const hours = Math.floor(age / (1000 * 60 * 60))
    const days = Math.floor(age / (1000 * 60 * 60 * 24))

    if (days > 0) return `${days}d ago`
    if (hours > 0) return `${hours}h ago`
    if (minutes > 0) return `${minutes}m ago`
    return 'just now'
  }

  /**
   * Format size in bytes
   */
  private formatSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB']
    let size = bytes
    let unitIndex = 0

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024
      unitIndex++
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`
  }

  /**
   * Format duration in milliseconds
   */
  private formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
    return `${(ms / 60000).toFixed(1)}m`
  }
}

// Run CLI
runCLI(RollbackCLI)

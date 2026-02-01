/**
 * Backup Manager
 *
 * Provides database backup and restore functionality.
 */

import { mkdir, readdir, readFile, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createLogger, getProjectRoot, type Logger, listTables } from '../../../lib/index.js'
import type { DatabaseConnection } from './connection.js'

export interface BackupOptions {
  /** Directory to store backups (default: .revealui/backups) */
  backupDir?: string
  /** Number of backups to retain (default: 5) */
  retainCount?: number
  /** Tables to include (default: all) */
  tables?: string[]
  /** Format for backup (default: json) */
  format?: 'json' | 'sql'
  /** Logger instance */
  logger?: Logger
}

export interface BackupMetadata {
  id: string
  timestamp: Date
  tables: string[]
  rowCounts: Record<string, number>
  format: 'json' | 'sql'
  size: number
}

export interface BackupResult {
  success: boolean
  path?: string
  metadata?: BackupMetadata
  error?: string
}

const defaultLogger = createLogger({ level: 'silent' })

/**
 * Creates a backup of the database.
 *
 * @example
 * ```typescript
 * const result = await createBackup(connection, {
 *   retainCount: 5,
 *   format: 'json',
 * })
 * if (result.success) {
 *   console.log('Backup created:', result.path)
 * }
 * ```
 */
export async function createBackup(
  connection: DatabaseConnection,
  importMetaUrl: string,
  options: BackupOptions = {},
): Promise<BackupResult> {
  const {
    retainCount = 5,
    tables: specifiedTables,
    format = 'json',
    logger = defaultLogger,
  } = options

  const projectRoot = await getProjectRoot(importMetaUrl)
  const backupDir = options.backupDir || join(projectRoot, '.revealui', 'backups')

  try {
    // Ensure backup directory exists
    await mkdir(backupDir, { recursive: true })

    // Get tables to backup
    const allTables = await listTables(connection.pool.options.connectionString || '')
    const tablesToBackup = specifiedTables?.filter((t) => allTables.includes(t)) || allTables

    if (tablesToBackup.length === 0) {
      logger.warn('No tables to backup')
      return { success: true, metadata: undefined }
    }

    const timestamp = new Date()
    const backupId = `backup-${timestamp.toISOString().replace(/[:.]/g, '-')}`
    const backupPath = join(backupDir, `${backupId}.${format}`)

    const rowCounts: Record<string, number> = {}

    if (format === 'json') {
      // JSON format backup
      const backup: Record<string, unknown[]> = {}

      for (const table of tablesToBackup) {
        logger.info(`Backing up table: ${table}`)
        try {
          const result = await connection.query(`SELECT * FROM "${table}"`)
          backup[table] = result.rows
          rowCounts[table] = result.rows.length
          logger.debug(`  ${result.rows.length} rows`)
        } catch (error) {
          logger.warn(`Could not backup table ${table}: ${error}`)
          rowCounts[table] = 0
        }
      }

      await writeFile(backupPath, JSON.stringify(backup, null, 2))
    } else {
      // SQL format backup
      const sqlStatements: string[] = []

      sqlStatements.push('-- RevealUI Database Backup')
      sqlStatements.push(`-- Created: ${timestamp.toISOString()}`)
      sqlStatements.push('')

      for (const table of tablesToBackup) {
        logger.info(`Backing up table: ${table}`)
        try {
          const result = await connection.query(`SELECT * FROM "${table}"`)
          rowCounts[table] = result.rows.length

          if (result.rows.length > 0) {
            // Get column names
            const columns = Object.keys(result.rows[0] as Record<string, unknown>)

            sqlStatements.push(`-- Table: ${table}`)

            for (const row of result.rows) {
              const typedRow = row as Record<string, unknown>
              const values = columns.map((col) => {
                const val = typedRow[col]
                if (val === null || val === undefined) return 'NULL'
                if (typeof val === 'number') return String(val)
                if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE'
                if (val instanceof Date) return `'${val.toISOString()}'`
                if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`
                return `'${String(val).replace(/'/g, "''")}'`
              })

              sqlStatements.push(
                `INSERT INTO "${table}" ("${columns.join('", "')}") VALUES (${values.join(', ')});`,
              )
            }

            sqlStatements.push('')
          }

          logger.debug(`  ${result.rows.length} rows`)
        } catch (error) {
          logger.warn(`Could not backup table ${table}: ${error}`)
          rowCounts[table] = 0
        }
      }

      await writeFile(backupPath, sqlStatements.join('\n'))
    }

    // Get backup file size
    const backupContent = await readFile(backupPath)
    const size = backupContent.length

    const metadata: BackupMetadata = {
      id: backupId,
      timestamp,
      tables: tablesToBackup,
      rowCounts,
      format,
      size,
    }

    logger.success(`Backup created: ${backupPath}`)
    logger.info(`Total rows: ${Object.values(rowCounts).reduce((a, b) => a + b, 0)}`)
    logger.info(`Size: ${formatBytes(size)}`)

    // Clean up old backups
    await cleanOldBackups(backupDir, retainCount, logger)

    return { success: true, path: backupPath, metadata }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error(`Backup failed: ${errorMessage}`)
    return { success: false, error: errorMessage }
  }
}

/**
 * Restores a database from a backup.
 *
 * @example
 * ```typescript
 * const result = await restoreBackup(connection, backupPath)
 * ```
 */
export async function restoreBackup(
  connection: DatabaseConnection,
  backupPath: string,
  options: { logger?: Logger; clearTables?: boolean } = {},
): Promise<{ success: boolean; error?: string }> {
  const { logger = defaultLogger, clearTables = true } = options

  try {
    const content = await readFile(backupPath, 'utf-8')
    const isJson = backupPath.endsWith('.json')

    if (isJson) {
      const backup = JSON.parse(content) as Record<string, unknown[]>

      for (const [table, rows] of Object.entries(backup)) {
        if (rows.length === 0) continue

        logger.info(`Restoring table: ${table}`)

        if (clearTables) {
          await connection.query(`DELETE FROM "${table}"`)
        }

        const columns = Object.keys(rows[0] as Record<string, unknown>)

        for (const row of rows) {
          const typedRow = row as Record<string, unknown>
          const values = columns.map((col) => typedRow[col])
          const placeholders = columns.map((_, i) => `$${i + 1}`)

          await connection.query(
            `INSERT INTO "${table}" ("${columns.join('", "')}") VALUES (${placeholders.join(', ')})`,
            values,
          )
        }

        logger.debug(`  ${rows.length} rows restored`)
      }
    } else {
      // SQL format - execute statements
      const statements = content
        .split(';')
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && !s.startsWith('--'))

      for (const stmt of statements) {
        await connection.query(stmt)
      }
    }

    logger.success('Restore completed')
    return { success: true }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error(`Restore failed: ${errorMessage}`)
    return { success: false, error: errorMessage }
  }
}

/**
 * Lists available backups.
 */
export async function listBackups(
  importMetaUrl: string,
  options: { backupDir?: string } = {},
): Promise<string[]> {
  const projectRoot = await getProjectRoot(importMetaUrl)
  const backupDir = options.backupDir || join(projectRoot, '.revealui', 'backups')

  try {
    const files = await readdir(backupDir)
    return files
      .filter((f) => f.startsWith('backup-') && (f.endsWith('.json') || f.endsWith('.sql')))
      .sort()
      .reverse()
  } catch {
    return []
  }
}

/**
 * Removes old backup files, keeping only the most recent ones.
 */
async function cleanOldBackups(
  backupDir: string,
  keepCount: number,
  logger: Logger,
): Promise<void> {
  try {
    const files = await readdir(backupDir)
    const backupFiles = files
      .filter((f) => f.startsWith('backup-'))
      .sort()
      .reverse()

    const toDelete = backupFiles.slice(keepCount)
    for (const file of toDelete) {
      await unlink(join(backupDir, file))
      logger.debug(`Deleted old backup: ${file}`)
    }

    if (toDelete.length > 0) {
      logger.info(`Cleaned up ${toDelete.length} old backups`)
    }
  } catch {
    // Ignore errors during cleanup
  }
}

/**
 * Formats bytes to human-readable string.
 */
function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unitIndex = 0

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex++
  }

  return `${value.toFixed(unitIndex > 0 ? 1 : 0)} ${units[unitIndex]}`
}

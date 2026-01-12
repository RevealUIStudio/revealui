#!/usr/bin/env tsx

/**
 * Rollback Markdown File Moves
 *
 * Restores files moved by validate-root-markdown.ts --fix
 *
 * Usage:
 *   pnpm rollback:markdown-move <backup-dir>
 *
 * Example:
 *   pnpm rollback:markdown-move .cursor/backups/markdown-move-1234567890
 */

import { existsSync } from 'node:fs'
import { readFile, rename } from 'node:fs/promises'
import { join } from 'node:path'
import { createLogger, getProjectRoot } from '../shared/utils.js'

const logger = createLogger()

interface RollbackInfo {
  timestamp: string
  movedFiles: Array<{
    source: string
    target: string
    backup?: string
  }>
}

/**
 * Rollback file moves from backup
 */
async function rollbackMarkdownMoves(backupDir: string): Promise<void> {
  logger.header('Rollback Markdown File Moves')

  const _projectRoot = await getProjectRoot(import.meta.url)
  const rollbackInfoPath = join(backupDir, 'rollback-info.json')

  if (!existsSync(rollbackInfoPath)) {
    logger.error(`Rollback info not found: ${rollbackInfoPath}`)
    logger.info('Expected file: rollback-info.json in backup directory')
    process.exit(1)
  }

  // Read rollback info
  const rollbackInfoContent = await readFile(rollbackInfoPath, 'utf-8')
  const rollbackInfo: RollbackInfo = JSON.parse(rollbackInfoContent)

  logger.info(`Found ${rollbackInfo.movedFiles.length} files to rollback`)
  logger.info(`Original move timestamp: ${rollbackInfo.timestamp}`)

  // Confirm rollback
  if (process.stdin.isTTY && !process.env.CI && !process.env.NON_INTERACTIVE) {
    logger.warning('⚠️  This will move files back to their original locations.')
    logger.info('Press Ctrl+C to cancel, or Enter to continue...')

    const readline = await import('node:readline')
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    })

    await new Promise<void>((resolve) => {
      rl.once('line', () => {
        rl.close()
        resolve()
      })
    })
  }

  // Rollback files
  let restored = 0
  let failed = 0

  for (const fileInfo of rollbackInfo.movedFiles) {
    try {
      // Check if target (current location) exists
      if (!existsSync(fileInfo.target)) {
        logger.warning(`  ⚠️  Target not found: ${fileInfo.target}, skipping`)
        continue
      }

      // Check if source (original location) already exists
      if (existsSync(fileInfo.source)) {
        logger.warning(`  ⚠️  Source already exists: ${fileInfo.source}, skipping`)
        continue
      }

      // Move file back
      await rename(fileInfo.target, fileInfo.source)
      restored++
      logger.success(`  ✅ Restored ${fileInfo.source.split(/[/\\]/).pop()}`)
    } catch (error) {
      failed++
      logger.error(
        `  ❌ Failed to restore ${fileInfo.source}: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  logger.header('Rollback Summary')
  logger.success(`Restored ${restored} files`)
  if (failed > 0) {
    logger.warning(`Failed to restore ${failed} files`)
  }

  // Optionally delete backup
  if (restored === rollbackInfo.movedFiles.length) {
    logger.info('All files restored successfully.')
    logger.info(`Backup directory: ${backupDir}`)
    logger.info('You can manually delete the backup directory if desired.')
  }
}

/**
 * Main function
 */
async function main() {
  const backupDir = process.argv[2]

  if (!backupDir) {
    logger.error('Usage: pnpm rollback:markdown-move <backup-dir>')
    logger.info('Example: pnpm rollback:markdown-move .cursor/backups/markdown-move-1234567890')
    process.exit(1)
  }

  try {
    await rollbackMarkdownMoves(backupDir)
    logger.success('Rollback completed successfully')
  } catch (error) {
    logger.error(`Rollback failed: ${error instanceof Error ? error.message : String(error)}`)
    if (error instanceof Error && error.stack) {
      logger.error(`Stack trace: ${error.stack}`)
    }
    process.exit(1)
  }
}

// Only run main if this file is executed directly
if (
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith('rollback-markdown-move.ts')
) {
  main()
}

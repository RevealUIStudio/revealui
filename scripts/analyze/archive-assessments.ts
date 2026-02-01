#!/usr/bin/env tsx

/**
 * Archive Assessment Files
 * Cross-platform replacement for archive-assessments.sh
 * Moves all assessment/execution files to docs/archive/assessments
 */

import { mkdir, readdir, rename } from 'node:fs/promises'
import { join } from 'node:path'
import { createLogger, fileExists, getProjectRoot } from '../../utils/base.ts'
import { ErrorCode } from '../lib/errors.js'

const logger = createLogger()

const KEEP_FILES = [
  'ASSESSMENT-CONSOLIDATED.md',
  'BRUTAL-ASSESSMENT-ULTIMATE-FINAL.md',
  'IMPLEMENTATION-COMPLETE.md',
  'EXECUTION-COMPLETE-SUMMARY.md',
  'MANUAL-VALIDATION-GUIDE.md',
  'AUTOMATED-VALIDATION-GUIDE.md',
  'AUTOMATION-QUICK-START.md',
  'DOCKER-WSL2-SETUP.md',
]

async function runArchive() {
  logger.header('Archiving Assessment Files')

  const projectRoot = await getProjectRoot(import.meta.url)
  const archiveDir = join(projectRoot, 'docs/archive/assessments')

  // Create archive directory if it doesn't exist
  try {
    await mkdir(archiveDir, { recursive: true })
  } catch (_error) {
    // Directory might already exist, that's fine
  }

  // Find all assessment files recursively
  async function findFiles(dir: string, files: string[] = []): Promise<string[]> {
    try {
      const entries = await readdir(dir, { withFileTypes: true })
      for (const entry of entries) {
        const fullPath = join(dir, entry.name)

        // Skip node_modules and archive directory
        if (
          entry.name === 'node_modules' ||
          entry.name === '.git' ||
          fullPath.startsWith(archiveDir)
        ) {
          continue
        }

        if (entry.isDirectory()) {
          await findFiles(fullPath, files)
        } else if (entry.isFile()) {
          const name = entry.name.toUpperCase()
          if (
            name.includes('ASSESSMENT') ||
            name.includes('BRUTAL') ||
            name.includes('EXECUTION') ||
            name.includes('VALIDATION')
          ) {
            if (entry.name.endsWith('.md')) {
              files.push(fullPath)
            }
          }
        }
      }
    } catch {
      // Skip directories we can't read
    }
    return files
  }

  const uniqueFiles = await findFiles(projectRoot)

  let count = 0
  const keptFiles: string[] = []

  for (const file of uniqueFiles) {
    const filename = file.split(/[/\\]/).pop() || ''
    const shouldKeep = KEEP_FILES.includes(filename)

    if (shouldKeep) {
      if (await fileExists(file)) {
        keptFiles.push(filename)
        logger.info(`Kept: ${filename}`)
      }
    } else {
      try {
        const archivePath = join(archiveDir, filename)
        await rename(file, archivePath)
        count++
        logger.info(`Archived: ${filename}`)
      } catch (error) {
        logger.warning(
          `Failed to archive ${filename}: ${error instanceof Error ? error.message : String(error)}`,
        )
      }
    }
  }

  logger.header('Archive Complete')
  logger.success(`Archived ${count} files`)
  logger.info(`Archive location: ${archiveDir}`)
  logger.info('')
  logger.info('Kept files (active):')
  for (const keep of keptFiles) {
    logger.info(`  - ${keep}`)
  }
  logger.info('')
}

/**
 * Main function
 */
async function main() {
  try {
    await runArchive()
  } catch (error) {
    logger.error(`Archive failed: ${error instanceof Error ? error.message : String(error)}`)
    if (error instanceof Error && error.stack) {
      logger.error(`Stack trace: ${error.stack}`)
    }
    process.exit(ErrorCode.EXECUTION_ERROR)
  }
}

main()

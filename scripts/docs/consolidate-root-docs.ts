#!/usr/bin/env tsx

/**
 * Root-Level Documentation Consolidation Script
 *
 * Moves root-level markdown files to appropriate locations in docs/ directory.
 * Keeps only essential root files: README.md, CHANGELOG.md, CONTRIBUTING.md, LICENSE.md
 *
 * Usage:
 *   pnpm docs:consolidate
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import fg from 'fast-glob'
import { createLogger, getProjectRoot } from '../shared/utils.js'

const logger = createLogger()

// Essential root files that should stay at root
// Note: This is for project root, not docs root
const ESSENTIAL_ROOT_FILES = ['README.md', 'CHANGELOG.md', 'CONTRIBUTING.md', 'LICENSE.md']

// Essential docs root files (navigation files from new documentation friendliness strategy)
// These should NOT be moved from docs/ directory
const ESSENTIAL_DOCS_ROOT_FILES = [
  'README.md',
  'INDEX.md',
  'TASKS.md',
  'KEYWORDS.md',
  'STATUS.md',
  'AGENT_QUICK_START.md',
]

// Mapping of root files to their target locations
const ROOT_FILE_MAPPINGS: Record<string, string> = {
  // Assessment files → archive/assessments
  BRUTAL_HONEST_ASSESSMENT: 'docs/archive/assessments',
  BRUTAL_HONEST_ASSESSMENT_V2: 'docs/archive/assessments',
  BRUTAL_HONEST_ASSESSMENT_V3: 'docs/archive/assessments',
  BRUTAL_HONEST_ASSESSMENT_V4: 'docs/archive/assessments',
  BRUTAL_HONEST_ASSESSMENT_V5: 'docs/archive/assessments',
  BRUTAL_HONEST_ASSESSMENT_CONTRACT_SYSTEM: 'docs/archive/assessments',
  AGENT_WORK_ASSESSMENT: 'docs/archive/assessments',
  PACKAGE_RENAME_ASSESSMENT: 'docs/archive/assessments',
  TYPE_SYSTEM_ANALYSIS: 'docs/archive/assessments',
  TYPE_SYSTEM_FIXES_APPLIED: 'docs/archive/assessments',
  TYPE_SYSTEM_FIXES_COMPLETE: 'docs/archive/assessments',
  TYPE_SYSTEM_UNIFICATION_COMPLETE: 'docs/archive/assessments',
  TYPE_SYSTEM_UNIFICATION_PROGRESS: 'docs/archive/assessments',
  // Status files → archive/status
  IMPORT_MIGRATION_COMPLETE: 'docs/archive/status',
  TYPESCRIPT_CONFIGURATION_COMPLETE: 'docs/archive/status',
  TYPESCRIPT_CONFIGURATION_ANALYSIS: 'docs/archive/status',
  TYPESCRIPT_FIXES_APPLIED: 'docs/archive/status',
  TYPESCRIPT_SERVER_TROUBLESHOOTING: 'docs/archive/status',
  RESTART_TYPESCRIPT_SERVER: 'docs/archive/status',
  EXTENSION_CONFIGURATION_SUMMARY: 'docs/archive/status',
  CRITICAL_FIXES_COMPLETED: 'docs/archive/status',
  ELECTRICSQL_BLOG_ASSESSMENT: 'docs/archive/assessments',
}

interface ConsolidationResult {
  moved: number
  skipped: number
  errors: number
  files: Array<{ source: string; target: string; reason: string }>
}

function categorizeRootFile(fileName: string): { target: string; reason: string } | null {
  const baseName = path.basename(fileName, path.extname(fileName))

  // Skip essential files
  if (ESSENTIAL_ROOT_FILES.includes(fileName)) {
    return null
  }

  // Check explicit mappings
  if (ROOT_FILE_MAPPINGS[baseName]) {
    return {
      target: path.join(ROOT_FILE_MAPPINGS[baseName], fileName),
      reason: 'Explicit mapping',
    }
  }

  // Pattern-based categorization
  if (/^(BRUTAL|ASSESSMENT|AGENT_WORK|PACKAGE_RENAME|TYPE_SYSTEM)/i.test(baseName)) {
    return {
      target: path.join('docs/archive/assessments', fileName),
      reason: 'Assessment file',
    }
  }

  if (/^(IMPORT|TYPESCRIPT|RESTART|EXTENSION|CRITICAL|ELECTRIC)/i.test(baseName)) {
    return {
      target: path.join('docs/archive/status', fileName),
      reason: 'Status file',
    }
  }

  // Default: move to archive/status for unknown root files
  if (fileName.endsWith('.md')) {
    return {
      target: path.join('docs/archive/status', fileName),
      reason: 'Root-level documentation file',
    }
  }

  return null
}

async function consolidateRootDocs(dryRun = false): Promise<ConsolidationResult> {
  const projectRoot = await getProjectRoot(import.meta.url)

  logger.header('Root-Level Documentation Consolidation')

  // Find all markdown files in root
  const rootFiles = await fg(['*.md'], {
    cwd: projectRoot,
    ignore: ['node_modules/**', '.next/**', 'dist/**'],
  })

  logger.info(`Found ${rootFiles.length} markdown files in root directory\n`)

  const filesToMove: Array<{ source: string; target: string; reason: string }> = []
  let skipped = 0
  let moved = 0
  let errors = 0

  for (const file of rootFiles) {
    const categorization = categorizeRootFile(file)
    if (categorization) {
      filesToMove.push({
        source: path.join(projectRoot, file),
        target: path.join(projectRoot, categorization.target),
        reason: categorization.reason,
      })
    } else {
      skipped++
      logger.info(`  ⏭️  Keeping: ${file} (essential root file)`)
    }
  }

  if (filesToMove.length === 0) {
    logger.info('\nNo files need to be moved. Root directory is clean!')
    return { moved: 0, skipped, errors, files: [] }
  }

  logger.info(`\nFound ${filesToMove.length} files to move:\n`)

  // Group by target directory
  const byTarget = new Map<string, Array<{ source: string; target: string; reason: string }>>()
  for (const file of filesToMove) {
    const targetDir = path.dirname(file.target)
    if (!byTarget.has(targetDir)) {
      byTarget.set(targetDir, [])
    }
    byTarget.get(targetDir)!.push(file)
  }

  // Display planned moves
  for (const [targetDir, dirFiles] of byTarget.entries()) {
    logger.info(`\n${path.relative(projectRoot, targetDir)} (${dirFiles.length} files):`)
    for (const file of dirFiles) {
      const fileName = path.basename(file.source)
      logger.info(`  ${fileName}`)
      logger.info(`    → ${path.relative(projectRoot, file.target)}`)
      logger.info(`    Reason: ${file.reason}`)
    }
  }

  if (dryRun) {
    logger.warning('\n[DRY RUN] No files were moved. Run without --dry-run to apply changes.')
    return { moved: 0, skipped, errors, files: filesToMove }
  }

  // Confirm before proceeding
  logger.info(`\n\nReady to move ${filesToMove.length} files.`)
  const { confirm } = await import('../shared/utils.js')
  const proceed = await confirm('Proceed with consolidation?', false)

  if (!proceed) {
    logger.info('Consolidation cancelled.')
    return { moved: 0, skipped, errors, files: filesToMove }
  }

  // Execute moves
  logger.info('\nMoving files...\n')

  for (const file of filesToMove) {
    try {
      // Create target directory if it doesn't exist
      const targetDir = path.dirname(file.target)
      await fs.mkdir(targetDir, { recursive: true })

      // Check if target already exists
      try {
        await fs.access(file.target)
        logger.warning(`  ⚠️  Target exists, skipping: ${path.relative(projectRoot, file.target)}`)
        continue
      } catch {
        // File doesn't exist, proceed
      }

      // Move file
      await fs.rename(file.source, file.target)
      logger.success(
        `  ✅ ${path.basename(file.source)} → ${path.relative(projectRoot, file.target)}`,
      )
      moved++
    } catch (error) {
      logger.error(
        `  ❌ Failed to move ${path.basename(file.source)}: ${error instanceof Error ? error.message : String(error)}`,
      )
      errors++
    }
  }

  logger.info(`\n\nConsolidation complete:`)
  logger.info(`  ✅ Moved: ${moved}`)
  logger.info(`  ⏭️  Skipped: ${skipped}`)
  if (errors > 0) {
    logger.warning(`  ❌ Errors: ${errors}`)
  }

  return { moved, skipped, errors, files: filesToMove }
}

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run') || args.includes('-d')

  try {
    await consolidateRootDocs(dryRun)
  } catch (error) {
    logger.error(`Script failed: ${error instanceof Error ? error.message : String(error)}`)
    if (error instanceof Error && error.stack) {
      logger.error(`Stack trace: ${error.stack}`)
    }
    process.exit(1)
  }
}

main()

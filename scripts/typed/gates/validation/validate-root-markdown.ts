#!/usr/bin/env tsx

/**
 * Validate Root Markdown Files
 *
 * Enforces policy: Only predetermined .md files allowed in project root.
 * All other .md files must be in docs/ subfolder.
 *
 * Allowed root files:
 *   - README.md
 *   - AGENT.md (exact match only)
 *   - INFRASTRUCTURE.md / ARCHITECTURE.md
 *   - SKILLS.md
 *   - SECURITY.md (GitHub recognizes)
 *   - CONTRIBUTING.md (GitHub recognizes)
 *   - CODE_OF_CONDUCT.md (GitHub recognizes)
 *   - CHANGELOG.md (common in root)
 *
 * Usage:
 *   pnpm validate:root-markdown    - Check for violations
 *   pnpm validate:root-markdown --fix  - Move violations to appropriate docs/ subfolders
 */

import {existsSync} from 'node:fs'
import {copyFile,mkdir,readdir,rename,writeFile} from 'node:fs/promises'
import {join} from 'node:path'
import {createLogger,getProjectRoot} from '../../../../packages/core/src/scripts/utils.ts'

const logger = createLogger()

// Allowed markdown files in project root
const ALLOWED_ROOT_FILES = [
  'README.md',
  'AGENT.md',
  'INFRASTRUCTURE.md',
  'ARCHITECTURE.md',
  'SKILLS.md',
  'SECURITY.md',
  'CONTRIBUTING.md',
  'CODE_OF_CONDUCT.md',
  'CHANGELOG.md',
]

// Allowed patterns (case-insensitive matching, exact matches only)
const ALLOWED_PATTERNS = [
  /^README\.md$/i,
  /^AGENT\.md$/i, // AGENT.md only (exact match)
  /^INFRASTRUCTURE\.md$/i,
  /^ARCHITECTURE\.md$/i,
  /^SKILLS\.md$/i,
  /^SECURITY\.md$/i, // GitHub recognizes (Security tab)
  /^CONTRIBUTING\.md$/i, // GitHub recognizes (PR/Issue linking)
  /^CODE_OF_CONDUCT\.md$/i, // GitHub recognizes (Community tab)
  /^CHANGELOG\.md$/i, // Common in root (version history)
]

/**
 * Determine target subfolder for a file based on its name and patterns
 *
 * Exported for testing
 */
export function determineTargetSubfolder(filename: string): string {
  const lowerFilename = filename.toLowerCase()

  // Assessment files (check before agent - assessments take priority)
  if (
    lowerFilename.includes('assessment') ||
    lowerFilename.includes('brutal') ||
    lowerFilename.includes('analysis') ||
    lowerFilename.includes('cohesion_analysis') ||
    lowerFilename.includes('developer_experience')
  ) {
    return 'docs/assessments'
  }

  // Agent-related files (handoff, instructions - not assessments)
  if (
    lowerFilename.includes('agent') ||
    lowerFilename.includes('prompt_for_next') ||
    lowerFilename.includes('handoff')
  ) {
    return 'docs/agent'
  }

  // Development/Technical docs (check before guides - development takes priority)
  if (
    lowerFilename.includes('code-style') ||
    lowerFilename.includes('code_style') ||
    lowerFilename.includes('development') ||
    lowerFilename.includes('technical')
  ) {
    return 'docs/development'
  }

  // Guide files
  if (
    lowerFilename.includes('guide') ||
    lowerFilename.includes('how-to') ||
    lowerFilename.includes('quick_start') ||
    lowerFilename.includes('quick-start') ||
    lowerFilename.includes('creation') ||
    lowerFilename.includes('usage') ||
    lowerFilename.includes('connection') ||
    lowerFilename.includes('cms-content') ||
    lowerFilename.includes('cms_content') ||
    lowerFilename.includes('examples') ||
    lowerFilename.includes('recommendations')
  ) {
    return 'docs/guides'
  }

  // Migration docs
  if (
    lowerFilename.includes('migration') ||
    lowerFilename.includes('breaking-changes') ||
    lowerFilename.includes('breaking_changes') ||
    lowerFilename.includes('deprecated') ||
    lowerFilename.includes('modernization')
  ) {
    return 'docs/migrations'
  }

  // Reference docs
  if (
    lowerFilename.includes('reference') ||
    lowerFilename.includes('mapping') ||
    lowerFilename.includes('dependencies') ||
    lowerFilename.includes('frameworks') ||
    lowerFilename.includes('component')
  ) {
    return 'docs/reference'
  }

  // Planning/Research docs
  if (
    lowerFilename.includes('plan') ||
    lowerFilename.includes('planning') ||
    lowerFilename.includes('research') ||
    lowerFilename.includes('roadmap') ||
    lowerFilename.includes('inventory') ||
    lowerFilename.includes('prioritized') ||
    lowerFilename.includes('ralph')
  ) {
    return 'docs/planning'
  }

  // Legal docs
  if (
    lowerFilename.includes('license') ||
    lowerFilename.includes('legal') ||
    lowerFilename.includes('third_party') ||
    lowerFilename.includes('third-party')
  ) {
    return 'docs/legal'
  }

  // Documentation management
  if (
    lowerFilename.includes('documentation') ||
    lowerFilename.includes('doc_index') ||
    lowerFilename.includes('doc_strategy') ||
    lowerFilename.includes('doc_cleanup') ||
    lowerFilename.includes('root_markdown')
  ) {
    return 'docs'
  }

  // Summary/Completion docs
  if (
    lowerFilename.includes('summary') ||
    lowerFilename.includes('complete') ||
    lowerFilename.includes('finished')
  ) {
    return 'docs'
  }

  // Default: docs/ (root of docs)
  return 'docs'
}

interface ValidationResult {
  file: string
  allowed: boolean
  reason?: string
  targetSubfolder?: string
}

/**
 * Check if file is allowed in root
 */
/**
 * Check if a file is allowed in the project root
 *
 * Exported for testing
 */
export function isAllowedRootFile(filename: string): boolean {
  // Exact match
  if (ALLOWED_ROOT_FILES.includes(filename)) {
    return true
  }

  // Pattern match
  return ALLOWED_PATTERNS.some((pattern) => pattern.test(filename))
}

/**
 * Create backup of files before moving
 *
 * Exported for testing
 */
export async function createBackup(
  projectRoot: string,
  violations: ValidationResult[],
  backupDir: string,
): Promise<boolean> {
  try {
    await mkdir(backupDir, { recursive: true })

    for (const violation of violations) {
      const sourcePath = join(projectRoot, violation.file)
      if (existsSync(sourcePath)) {
        const backupPath = join(backupDir, violation.file)
        await copyFile(sourcePath, backupPath)
      }
    }

    return true
  } catch (error) {
    logger.warning(
      `Failed to create backup: ${error instanceof Error ? error.message : String(error)}`,
    )
    return false
  }
}

/**
 * Save rollback information
 *
 * Exported for testing
 */
export async function saveRollbackInfo(
  backupDir: string,
  movedFiles: Array<{ source: string; target: string; backup?: string }>,
): Promise<void> {
  const rollbackInfo = {
    timestamp: new Date().toISOString(),
    movedFiles: movedFiles.map((f) => ({
      source: f.source,
      target: f.target,
      backup: f.backup,
    })),
  }

  const rollbackPath = join(backupDir, 'rollback-info.json')
  await writeFile(rollbackPath, JSON.stringify(rollbackInfo, null, 2))
}

/**
 * Find all markdown files in root
 */
async function findRootMarkdownFiles(projectRoot: string): Promise<string[]> {
  const files: string[] = []

  try {
    const entries = await readdir(projectRoot, { withFileTypes: true })

    for (const entry of entries) {
      if (!entry.isFile()) continue
      if (!entry.name.endsWith('.md')) continue

      const filePath = join(projectRoot, entry.name)
      files.push(filePath)
    }
  } catch (error) {
    logger.error(
      `Failed to read root directory: ${error instanceof Error ? error.message : String(error)}`,
    )
  }

  return files
}

/**
 * Validate root markdown files
 *
 * Exported for testing
 *
 * @param options - Validation options
 * @param projectRoot - Project root directory
 */
export async function validateRootMarkdown(
  options: { fix: boolean },
  projectRoot: string,
): Promise<void> {
  logger.header('Validate Root Markdown Files')

  const root = projectRoot

  // Find all markdown files in root
  const rootFiles = await findRootMarkdownFiles(root)
  const _rootFileNames = rootFiles.map((f) => f.split(/[/\\]/).pop() || '')

  logger.info(`Found ${rootFiles.length} markdown files in project root`)

  // Validate each file
  const violations: ValidationResult[] = []
  const allowed: ValidationResult[] = []

  for (const filePath of rootFiles) {
    const filename = filePath.split(/[/\\]/).pop() || ''
    const isAllowed = isAllowedRootFile(filename)

    if (isAllowed) {
      allowed.push({ file: filename, allowed: true })
    } else {
      const targetSubfolder = determineTargetSubfolder(filename)
      violations.push({
        file: filename,
        allowed: false,
        reason: 'Not in allowed list',
        targetSubfolder,
      })
    }
  }

  // Report results
  logger.header('Validation Results')

  if (allowed.length > 0) {
    logger.success(`✅ Allowed files (${allowed.length}):`)
    for (const result of allowed) {
      logger.info(`  - ${result.file}`)
    }
  }

  if (violations.length > 0) {
    logger.warning(`❌ Violations found (${violations.length}):`)
    for (const result of violations) {
      logger.warning(`  - ${result.file} (${result.reason})`)
      if (result.targetSubfolder) {
        logger.info(`    → Will move to: ${result.targetSubfolder}/`)
      }
    }

    if (options.fix) {
      logger.header('Fixing Violations')

      // Safety: Confirmation prompt (unless in CI or non-interactive mode)
      if (process.stdin.isTTY && !process.env.CI && !process.env.NON_INTERACTIVE) {
        logger.warning(`⚠️  About to move ${violations.length} files.`)
        logger.info('Press Ctrl+C to cancel, or Enter to continue...')

        // Use readline for better compatibility
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

      // Create backup directory
      const backupDir = join(root, '.cursor', 'backups', `markdown-move-${Date.now()}`)
      const backupCreated = await createBackup(root, violations, backupDir)
      if (backupCreated) {
        logger.info(`📦 Backup created: ${backupDir}`)
      }

      // Group violations by target subfolder
      const bySubfolder = new Map<string, ValidationResult[]>()
      for (const violation of violations) {
        const subfolder = violation.targetSubfolder || 'docs'
        if (!bySubfolder.has(subfolder)) {
          bySubfolder.set(subfolder, [])
        }
        bySubfolder.get(subfolder)?.push(violation)
      }

      // Move files to their target subfolders
      let moved = 0
      let failed = 0
      const movedFiles: Array<{
        source: string
        target: string
        backup?: string
      }> = []

      for (const [subfolder, files] of bySubfolder.entries()) {
        const targetDir = join(root, subfolder)

        // Create target directory if needed
        if (!existsSync(targetDir)) {
          await mkdir(targetDir, { recursive: true })
          logger.info(`Created directory: ${subfolder}/`)
        }

        // Move files
        for (const violation of files) {
          const sourcePath = join(root, violation.file)
          const targetPath = join(targetDir, violation.file)

          try {
            // Check if target already exists
            if (existsSync(targetPath)) {
              logger.warning(`  ⚠️  ${violation.file} already exists in ${subfolder}/, skipping`)
              continue
            }

            await rename(sourcePath, targetPath)
            moved++
            const backupPath = backupCreated ? join(backupDir, violation.file) : undefined
            movedFiles.push({
              source: sourcePath,
              target: targetPath,
              backup: backupPath,
            })
            logger.success(`  ✅ Moved ${violation.file} -> ${subfolder}/${violation.file}`)
          } catch (error) {
            failed++
            logger.error(
              `  ❌ Failed to move ${violation.file}: ${error instanceof Error ? error.message : String(error)}`,
            )
          }
        }
      }

      // Save rollback information
      if (moved > 0 && backupCreated) {
        await saveRollbackInfo(backupDir, movedFiles)
        logger.info(`📦 Rollback info saved to: ${backupDir}/rollback-info.json`)
        logger.info(`💡 To rollback: pnpm rollback:markdown-move ${backupDir}`)
      }

      logger.header('Move Summary')
      logger.success(`Moved ${moved} files to appropriate docs/ subfolders`)
      if (failed > 0) {
        logger.warning(`Failed to move ${failed} files`)
      }
    } else {
      logger.header('How to Fix')
      logger.info(
        'Run with --fix to automatically move violations to appropriate docs/ subfolders:',
      )
      logger.info('  pnpm validate:root-markdown --fix')
      logger.info('')
      logger.info('Files will be categorized and moved to:')
      logger.info('  - docs/agent/ - Agent handoff files')
      logger.info('  - docs/assessments/ - Assessment files')
      logger.info('  - docs/guides/ - Guide files')
      logger.info('  - docs/development/ - Development docs')
      logger.info('  - docs/migrations/ - Migration docs')
      logger.info('  - docs/reference/ - Reference docs')
      logger.info('  - docs/planning/ - Planning/Research docs')
      logger.info('  - docs/legal/ - Legal docs')
      logger.info('  - docs/ - Other documentation')
    }
  } else {
    logger.success('✅ No violations found! All root markdown files are allowed.')
  }

  // Summary
  logger.header('Summary')
  logger.info(`Total files: ${rootFiles.length}`)
  logger.info(`Allowed: ${allowed.length}`)
  logger.info(`Violations: ${violations.length}`)

  if (violations.length > 0 && !options.fix) {
    process.exit(1)
  }
}

/**
 * Parse command line arguments
 *
 * Exported for testing
 */
export function parseOptions(): { fix: boolean } {
  const args = process.argv.slice(2)
  return {
    fix: args.includes('--fix') || args.includes('-f'),
  }
}

/**
 * Main function
 */
async function main() {
  const options = parseOptions()

  try {
    const projectRoot = await getProjectRoot(import.meta.url)
    await validateRootMarkdown(options, projectRoot)
  } catch (error) {
    logger.error(`Validation failed: ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  }
}

// Only run main if this file is executed directly (not imported)
if (
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith('validate-root-markdown.ts')
) {
  main()
}

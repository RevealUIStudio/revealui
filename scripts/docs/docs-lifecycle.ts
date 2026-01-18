#!/usr/bin/env tsx

/**
 * Documentation Lifecycle Manager
 *
 * Tracks, validates, and manages documentation files by detecting stale content,
 * archiving outdated files, and running in watch mode to prevent documentation pollution.
 *
 * Usage:
 *   pnpm docs:check    - Check all docs, report stale files (no changes)
 *   pnpm docs:archive  - Archive stale files
 *   pnpm docs:watch    - Watch mode (runs continuously)
 *   pnpm docs:clean    - Clean + archive in one command
 */

import type { Stats } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import { watch } from 'chokidar'
import fg from 'fast-glob'
import { createLogger, getProjectRoot } from '../shared/utils.js'

const logger = createLogger()

// Types - Exported for testing
export interface DocFile {
  path: string
  relativePath: string
  content: string
  stats: Stats
}

export interface ValidationError {
  type: 'packageName' | 'fileReference' | 'codeSnippet' | 'date' | 'status' | 'todo'
  message: string
  line?: number
  context?: string
}

export interface ValidationResult {
  file: DocFile
  isStale: boolean
  errors: ValidationError[]
}

export interface ArchiveEntry {
  originalPath: string
  archivePath: string
  archiveDate: string
  reason: string
  errors: ValidationError[]
}

export interface Config {
  patterns: {
    track: string[]
    ignore: string[]
    rootOnly: boolean
  }
  validation: {
    checkPackageNames: boolean
    checkFileReferences: boolean
    checkCodeSnippets: boolean
    checkDates: boolean
    checkStatus: boolean
    checkTodos: boolean
    maxAgeDays: number | null
    statusThresholdDays: number
    outdatedPackageNames?: string[]
    replacementPackageName?: string
    outdatedPaths?: string[]
  }
  actions: {
    onStale: 'archive' | 'delete' | 'mark'
    archiveDir: string
    dryRun: boolean
  }
  watch: {
    enabled: boolean
    debounceMs: number
  }
}

// Configuration
const CONFIG_PATH = path.join(process.cwd(), 'docs-lifecycle.config.json')
const DEFAULT_CONFIG: Config = {
  patterns: {
    track: ['**/*.md', '**/*REPORT*.json', '**/*SUMMARY*.json'],
    ignore: ['node_modules/**', '.next/**', 'dist/**', 'docs/archive/**'],
    rootOnly: false,
  },
  validation: {
    checkPackageNames: true,
    checkFileReferences: true,
    checkCodeSnippets: true,
    checkDates: true,
    checkStatus: true,
    checkTodos: true,
    maxAgeDays: null, // Set to number (e.g., 365) to enable date validation
    statusThresholdDays: 90, // Files older than this claiming completion are flagged
    outdatedPackageNames: ['@revealui/cms'],
    replacementPackageName: '@revealui/core',
    outdatedPaths: ['packages/core/src/admin/'],
  },
  actions: {
    onStale: 'archive',
    archiveDir: 'docs/archive',
    dryRun: false,
  },
  watch: {
    enabled: true,
    debounceMs: 1000,
  },
}

function validateConfig(config: Partial<Config>): Config {
  const validated: Config = {
    patterns: {
      track: config.patterns?.track ?? DEFAULT_CONFIG.patterns.track,
      ignore: config.patterns?.ignore ?? DEFAULT_CONFIG.patterns.ignore,
      rootOnly: config.patterns?.rootOnly ?? DEFAULT_CONFIG.patterns.rootOnly,
    },
    validation: {
      checkPackageNames:
        config.validation?.checkPackageNames ?? DEFAULT_CONFIG.validation.checkPackageNames,
      checkFileReferences:
        config.validation?.checkFileReferences ?? DEFAULT_CONFIG.validation.checkFileReferences,
      checkCodeSnippets:
        config.validation?.checkCodeSnippets ?? DEFAULT_CONFIG.validation.checkCodeSnippets,
      checkDates: config.validation?.checkDates ?? DEFAULT_CONFIG.validation.checkDates,
      checkStatus: config.validation?.checkStatus ?? DEFAULT_CONFIG.validation.checkStatus,
      checkTodos: config.validation?.checkTodos ?? DEFAULT_CONFIG.validation.checkTodos,
      maxAgeDays: config.validation?.maxAgeDays ?? DEFAULT_CONFIG.validation.maxAgeDays,
      statusThresholdDays:
        config.validation?.statusThresholdDays ?? DEFAULT_CONFIG.validation.statusThresholdDays,
      outdatedPackageNames:
        config.validation?.outdatedPackageNames ?? DEFAULT_CONFIG.validation.outdatedPackageNames,
      replacementPackageName:
        config.validation?.replacementPackageName ??
        DEFAULT_CONFIG.validation.replacementPackageName,
      outdatedPaths: config.validation?.outdatedPaths ?? DEFAULT_CONFIG.validation.outdatedPaths,
    },
    actions: {
      onStale: config.actions?.onStale ?? DEFAULT_CONFIG.actions.onStale,
      archiveDir: config.actions?.archiveDir ?? DEFAULT_CONFIG.actions.archiveDir,
      dryRun: config.actions?.dryRun ?? DEFAULT_CONFIG.actions.dryRun,
    },
    watch: {
      enabled: config.watch?.enabled ?? DEFAULT_CONFIG.watch.enabled,
      debounceMs: config.watch?.debounceMs ?? DEFAULT_CONFIG.watch.debounceMs,
    },
  }
  return validated
}

export async function loadConfig(): Promise<Config> {
  try {
    const configContent = await fs.readFile(CONFIG_PATH, 'utf-8')
    const config = JSON.parse(configContent) as Partial<Config>
    return validateConfig(config)
  } catch (error) {
    logger.warning(
      `Could not load config from ${CONFIG_PATH}, using defaults: ${error instanceof Error ? error.message : String(error)}`,
    )
    return DEFAULT_CONFIG
  }
}

// File Discovery
export async function discoverDocs(config: Config): Promise<DocFile[]> {
  const files: DocFile[] = []
  const patterns = config.patterns.rootOnly
    ? config.patterns.track.map((p) => p.replace('**/', ''))
    : config.patterns.track

  // Ensure node_modules is always ignored
  const ignorePatterns = [
    ...config.patterns.ignore,
    '**/node_modules/**',
    '**/.next/**',
    '**/dist/**',
    '**/docs/archive/**',
  ]

  const foundFiles = await fg(patterns, {
    ignore: ignorePatterns,
    absolute: false,
    cwd: process.cwd(),
  })

  for (const filePath of foundFiles) {
    // Double-check we're not processing node_modules
    if (filePath.includes('node_modules')) {
      continue
    }

    try {
      const fullPath = path.resolve(process.cwd(), filePath)
      const stats = await fs.stat(fullPath)
      const content = await fs.readFile(fullPath, 'utf-8')

      files.push({
        path: fullPath,
        relativePath: filePath,
        content,
        stats,
      })
    } catch (error) {
      // Skip files that can't be read
      logger.warning(
        `Could not read ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  return files
}

// Individual Validators - Exported for testing
export async function validatePackageNames(
  file: DocFile,
  config: Config,
): Promise<ValidationError[]> {
  const errors: ValidationError[] = []
  if (!config.validation.checkPackageNames) return errors

  const outdatedPackages = config.validation.outdatedPackageNames ?? []
  const replacement = config.validation.replacementPackageName ?? '@revealui/core'

  for (const outdatedPkg of outdatedPackages) {
    if (file.content.includes(outdatedPkg)) {
      errors.push({
        type: 'packageName',
        message: `Contains outdated package name '${outdatedPkg}' (should be '${replacement}')`,
      })
    }
  }
  return errors
}

export async function validateFileReferences(
  file: DocFile,
  config: Config,
): Promise<ValidationError[]> {
  const errors: ValidationError[] = []
  if (!config.validation.checkFileReferences) return errors

  // Match markdown links and import/require statements
  const fileRefRegex = /\[([^\]]+)\]\(([^)]+)\)|(?:from|import|require)\(['"]([^'"]+)['"]\)/g
  const lines = file.content.split('\n')
  // Common npm packages that shouldn't be checked as file paths
  const npmPackagePattern = /^[a-z0-9@][a-z0-9._-]*(\/[a-z0-9._-]+)*$/i

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]
    const matches = [...line.matchAll(fileRefRegex)]
    for (const match of matches) {
      // match[1] = markdown link text, match[2] = markdown link URL, match[3] = import/require path
      const ref = match[2] || match[3]
      if (!ref) continue

      // Skip URLs, anchors, and npm package imports
      if (
        ref.startsWith('http://') ||
        ref.startsWith('https://') ||
        ref.startsWith('mailto:') ||
        ref.startsWith('#') ||
        ref.startsWith('@') ||
        npmPackagePattern.test(ref)
      ) {
        continue
      }

      // Check if it looks like a file path (has extension or contains /)
      if (ref.includes('/') || /\.(ts|tsx|js|jsx|md|json|txt)$/i.test(ref)) {
        const refPath = path.isAbsolute(ref) ? ref : path.resolve(path.dirname(file.path), ref)

        // Only check paths within the project
        if (refPath.startsWith(process.cwd())) {
          try {
            await fs.access(refPath)
          } catch (error) {
            // Expected: file doesn't exist - this is the error we're checking for
            if (error instanceof Error && process.env.DEBUG) {
              console.debug(`File reference check: ${ref} does not exist (expected)`)
            }
            errors.push({
              type: 'fileReference',
              message: `References non-existent file: ${ref}`,
              line: index + 1,
              context: line.trim(),
            })
          }
        }
      }
    }
  }
  return errors
}

export async function validateCodeSnippets(
  file: DocFile,
  config: Config,
): Promise<ValidationError[]> {
  const errors: ValidationError[] = []
  if (!config.validation.checkCodeSnippets) return errors

  // Improved regex: handles language tags on same line, optional language, multiline
  const codeBlockRegex =
    /```(?:typescript|ts|javascript|js|json|markdown|md|bash|sh)?\s*\n?([\s\S]*?)```/g
  const matches = [...file.content.matchAll(codeBlockRegex)]

  const outdatedPackages = config.validation.outdatedPackageNames ?? []
  const replacement = config.validation.replacementPackageName ?? '@revealui/core'
  const outdatedPaths = config.validation.outdatedPaths ?? []

  for (const match of matches) {
    const code = match[1]?.trim() ?? ''
    if (!code) continue

    // Check for outdated package names in code
    for (const outdatedPkg of outdatedPackages) {
      if (code.includes(outdatedPkg)) {
        errors.push({
          type: 'codeSnippet',
          message: `Code snippet contains outdated package name '${outdatedPkg}' (should be '${replacement}')`,
        })
      }
    }

    // Check for outdated paths
    for (const outdatedPath of outdatedPaths) {
      if (code.includes(outdatedPath)) {
        errors.push({
          type: 'codeSnippet',
          message: `Code snippet contains outdated path '${outdatedPath}'`,
        })
      }
    }
  }
  return errors
}

export async function validateDates(file: DocFile, config: Config): Promise<ValidationError[]> {
  const errors: ValidationError[] = []
  if (!config.validation.checkDates || config.validation.maxAgeDays === null) {
    return errors
  }

  const maxAgeMs = config.validation.maxAgeDays * 24 * 60 * 60 * 1000
  const fileAgeMs = Date.now() - file.stats.mtimeMs
  if (fileAgeMs > maxAgeMs) {
    const ageDays = Math.floor(fileAgeMs / (24 * 60 * 60 * 1000))
    errors.push({
      type: 'date',
      message: `File is ${ageDays} days old (max: ${config.validation.maxAgeDays} days)`,
    })
  }

  // Also check for "Last Updated" dates in content
  const datePatterns = [
    /last\s+updated?[:\s]+(\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4})/gi,
    /updated?[:\s]+(\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4})/gi,
    /date[:\s]+(\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4})/gi,
  ]

  for (const pattern of datePatterns) {
    const matches = [...file.content.matchAll(pattern)]
    for (const match of matches) {
      const dateStr = match[1]
      let date: Date
      try {
        if (dateStr.includes('-')) {
          date = new Date(dateStr)
        } else {
          // Handle MM/DD/YYYY format (US format)
          // Note: This assumes US format. For international support, consider using a date library
          const parts = dateStr.split('/')
          if (parts.length === 3) {
            const [month, day, year] = parts
            date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10))
          } else {
            continue // Skip invalid dates
          }
        }
        if (Number.isNaN(date.getTime())) continue

        const dateAgeMs = Date.now() - date.getTime()
        if (dateAgeMs > maxAgeMs) {
          const ageDays = Math.floor(dateAgeMs / (24 * 60 * 60 * 1000))
          const lineNum = file.content.substring(0, match.index ?? 0).split('\n').length
          errors.push({
            type: 'date',
            message: `Document contains outdated date: ${dateStr} (${ageDays} days old)`,
            line: lineNum,
          })
        }
      } catch (error) {
        // Skip invalid dates but log for debugging
        // Note: No continue needed here - we're in the inner loop (matches),
        // so execution naturally continues to the next match after the catch block
        if (error instanceof Error && process.env.DEBUG) {
          logger.warning(`Failed to parse date "${dateStr}": ${error.message}`)
        }
      }
    }
  }
  return errors
}

export async function validateStatus(file: DocFile, config: Config): Promise<ValidationError[]> {
  const errors: ValidationError[] = []
  if (!config.validation.checkStatus) return errors

  const statusPatterns = [
    /status[:\s]+(complete|done|finished|incomplete|pending|wip|in progress)/gi,
    /phase\s+(\d+)\s+(complete|done|finished)/gi,
    /✅\s*(complete|done|finished)/gi,
    /\[x\]\s*(complete|done|finished)/gi,
  ]

  const fileAgeDays = Math.floor((Date.now() - file.stats.mtimeMs) / (24 * 60 * 60 * 1000))
  const thresholdDays = config.validation.statusThresholdDays

  // Check ALL matches, not just the first one
  for (const pattern of statusPatterns) {
    const matches = [...file.content.matchAll(pattern)]
    for (const match of matches) {
      if (fileAgeDays > thresholdDays && match[0].toLowerCase().includes('complete')) {
        const lineNum = file.content.substring(0, match.index ?? 0).split('\n').length
        errors.push({
          type: 'status',
          message: `Document claims completion status but hasn't been updated in ${fileAgeDays} days (threshold: ${thresholdDays} days)`,
          line: lineNum,
        })
      }
    }
  }
  return errors
}

export async function validateTodos(file: DocFile, config: Config): Promise<ValidationError[]> {
  const errors: ValidationError[] = []
  if (!config.validation.checkTodos) return errors

  const todoPattern = /TODO|FIXME|HACK|XXX|NOTE/gi
  const todoMatches = [...file.content.matchAll(todoPattern)]

  for (const match of todoMatches) {
    const lineNum = file.content.substring(0, match.index ?? 0).split('\n').length
    const line = file.content.split('\n')[lineNum - 1] ?? ''

    // Check if TODO references a file
    const refPattern = /(?:TODO|FIXME|HACK|XXX|NOTE)[:\s]+(?:in|at|see|check)\s+([^\s]+)/i
    const refMatch = line.match(refPattern)
    if (refMatch) {
      const ref = refMatch[1]
      // Check if referenced file exists
      if (ref.includes('/') || ref.endsWith('.ts') || ref.endsWith('.tsx')) {
        const refPath = path.isAbsolute(ref) ? ref : path.resolve(path.dirname(file.path), ref)

        if (refPath.startsWith(process.cwd())) {
          try {
            await fs.access(refPath)
            // File exists - now check if TODO still exists in that file
            try {
              const refContent = await fs.readFile(refPath, 'utf-8')
              // Extract TODO text from the original line (everything after the file reference)
              const todoText = line
                .replace(/^(?:TODO|FIXME|HACK|XXX|NOTE)[:\s]+(?:in|at|see|check)\s+[^\s]+\s*/i, '')
                .trim()

              // Check if TODO is still relevant:
              // 1. If there's specific TODO text, check if it exists in the file
              // 2. If no specific text, check if file has any TODOs at all
              // 3. If file has no TODOs and no matching text, the reference is likely stale
              const hasTodoPattern = todoPattern.test(refContent)
              const hasTodoText = todoText && refContent.includes(todoText)

              // Flag as stale if:
              // - There's specific text but it's not in the file AND file has no TODOs, OR
              // - No specific text AND file has no TODOs at all
              if (todoText) {
                // Specific TODO text provided - check if it exists
                if (!hasTodoText && !hasTodoPattern) {
                  errors.push({
                    type: 'todo',
                    message: `TODO references file '${ref}' but the TODO text is not found and file has no TODOs`,
                    line: lineNum,
                    context: line.trim(),
                  })
                }
              } else {
                // No specific text - just check if file has any TODOs
                if (!hasTodoPattern) {
                  errors.push({
                    type: 'todo',
                    message: `TODO references file '${ref}' but file contains no TODOs`,
                    line: lineNum,
                    context: line.trim(),
                  })
                }
              }
            } catch (readError) {
              // Couldn't read file - skip TODO check but log if debugging
              if (readError instanceof Error && process.env.DEBUG) {
                logger.warning(
                  `Could not read file ${refPath} for TODO validation: ${readError.message}`,
                )
              }
            }
          } catch (error) {
            // Expected: file doesn't exist - this is the error we're checking for
            if (error instanceof Error && process.env.DEBUG) {
              console.debug(`TODO file check: ${ref} does not exist (expected)`)
            }
            errors.push({
              type: 'todo',
              message: `TODO references non-existent file: ${ref}`,
              line: lineNum,
              context: line.trim(),
            })
          }
        }
      }
    }
  }
  return errors
}

// Content Validation - Main function that calls all validators
export async function validateContent(file: DocFile, config: Config): Promise<ValidationResult> {
  const errors: ValidationError[] = []

  // Run all validators in parallel for better performance
  const [packageErrors, fileRefErrors, codeSnippetErrors, dateErrors, statusErrors, todoErrors] =
    await Promise.all([
      validatePackageNames(file, config),
      validateFileReferences(file, config),
      validateCodeSnippets(file, config),
      validateDates(file, config),
      validateStatus(file, config),
      validateTodos(file, config),
    ])

  errors.push(
    ...packageErrors,
    ...fileRefErrors,
    ...codeSnippetErrors,
    ...dateErrors,
    ...statusErrors,
    ...todoErrors,
  )

  return {
    file,
    isStale: errors.length > 0,
    errors,
  }
}

// Staleness Detection
export async function detectStale(file: DocFile, config: Config): Promise<boolean> {
  const result = await validateContent(file, config)
  return result.isStale
}

// Archive Management
export async function getArchiveIndex(archiveDir: string): Promise<ArchiveEntry[]> {
  const indexPath = path.join(archiveDir, '.index.json')
  try {
    const content = await fs.readFile(indexPath, 'utf-8')
    return JSON.parse(content) as ArchiveEntry[]
  } catch (error) {
    // Expected: archive index doesn't exist yet (first run) - return empty array
    if (error instanceof Error && process.env.DEBUG) {
      console.debug(`Archive index not found at ${indexPath} (expected on first run)`)
    }
    return []
  }
}

export async function updateArchiveIndex(
  archiveDir: string,
  entries: ArchiveEntry[],
): Promise<void> {
  const indexPath = path.join(archiveDir, '.index.json')
  await fs.writeFile(indexPath, JSON.stringify(entries, null, 2), 'utf-8')
}

export async function archiveFile(
  file: DocFile,
  errors: ValidationError[],
  config: Config,
): Promise<boolean> {
  if (config.actions.dryRun) {
    logger.info(`[DRY RUN] Would archive: ${file.relativePath}`)
    return true
  }

  try {
    const archiveDir = path.resolve(process.cwd(), config.actions.archiveDir)
    await fs.mkdir(archiveDir, { recursive: true })

    const today = new Date().toISOString().split('T')[0]
    const fileName = path.basename(file.relativePath)
    const archiveFileName = `${today}_${fileName}`
    const archivePath = path.join(archiveDir, archiveFileName)

    // Check if archive file already exists (handle duplicates)
    let finalArchivePath = archivePath
    let counter = 1
    while (true) {
      try {
        await fs.access(finalArchivePath)
        // File exists, add counter
        const ext = path.extname(fileName)
        const base = path.basename(fileName, ext)
        finalArchivePath = path.join(archiveDir, `${today}_${base}_${counter}${ext}`)
        counter++
      } catch (error) {
        // Expected: file doesn't exist, we can use this path
        if (error instanceof Error && process.env.DEBUG) {
          console.debug(
            `Archive path available: ${finalArchivePath} (file doesn't exist, using this path)`,
          )
        }
        break
      }
    }

    // Move file to archive with error handling
    try {
      await fs.rename(file.path, finalArchivePath)
    } catch (error) {
      logger.error(
        `Failed to move file ${file.relativePath}: ${error instanceof Error ? error.message : String(error)}`,
      )
      return false
    }

    // Update archive index with error handling
    try {
      const entries = await getArchiveIndex(archiveDir)
      entries.push({
        originalPath: file.relativePath,
        archivePath: path.relative(process.cwd(), finalArchivePath),
        archiveDate: today,
        reason: errors.map((e) => e.message).join('; '),
        errors,
      })
      await updateArchiveIndex(archiveDir, entries)
    } catch (error) {
      logger.warning(
        `Failed to update archive index: ${error instanceof Error ? error.message : String(error)}`,
      )
      // File was moved but index wasn't updated - this is recoverable
    }

    logger.success(
      `Archived: ${file.relativePath} → ${path.relative(process.cwd(), finalArchivePath)}`,
    )
    return true
  } catch (error) {
    logger.error(
      `Failed to archive ${file.relativePath}: ${error instanceof Error ? error.message : String(error)}`,
    )
    return false
  }
}

// Main Operations
async function checkCommand(config: Config): Promise<void> {
  logger.info('Checking documentation files...\n')
  let files: DocFile[] = []
  try {
    files = await discoverDocs(config)
  } catch (error) {
    logger.error(
      `Failed to discover documentation files: ${error instanceof Error ? error.message : String(error)}`,
    )
    process.exit(1)
  }

  logger.info(`Found ${files.length} documentation file(s) to check...\n`)
  const staleFiles: ValidationResult[] = []
  let processed = 0

  for (const file of files) {
    processed++
    if (processed % 10 === 0) {
      process.stdout.write(`\rProgress: ${processed}/${files.length} files checked...`)
    }
    try {
      const result = await validateContent(file, config)
      if (result.isStale) {
        staleFiles.push(result)
      }
    } catch (error) {
      logger.warning(
        `Failed to validate ${file.relativePath}: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }
  process.stdout.write(`\r${' '.repeat(50)}\r`) // Clear progress line

  if (staleFiles.length === 0) {
    logger.success('All documentation files are up to date!')
    return
  }

  logger.info(`Found ${staleFiles.length} stale file(s):\n`)
  for (const result of staleFiles) {
    logger.info(`📄 ${result.file.relativePath}`)
    for (const error of result.errors) {
      logger.warning(`   ⚠️  ${error.type}: ${error.message}`)
      if (error.line) {
        logger.info(`      Line ${error.line}: ${error.context}`)
      }
    }
    logger.info('')
  }
}

async function archiveCommand(config: Config): Promise<void> {
  logger.info('Archiving stale documentation files...\n')
  let files: DocFile[] = []
  try {
    files = await discoverDocs(config)
  } catch (error) {
    logger.error(
      `Failed to discover documentation files: ${error instanceof Error ? error.message : String(error)}`,
    )
    process.exit(1)
  }

  const archiveDir = path.resolve(process.cwd(), config.actions.archiveDir)
  try {
    await fs.mkdir(archiveDir, { recursive: true })
  } catch (error) {
    logger.error(
      `Failed to create archive directory: ${error instanceof Error ? error.message : String(error)}`,
    )
    process.exit(1)
  }

  let archivedCount = 0
  let failedCount = 0

  for (const file of files) {
    try {
      const result = await validateContent(file, config)
      if (result.isStale) {
        const success = await archiveFile(file, result.errors, config)
        if (success) {
          archivedCount++
        } else {
          failedCount++
        }
      }
    } catch (error) {
      logger.error(
        `Failed to process ${file.relativePath}: ${error instanceof Error ? error.message : String(error)}`,
      )
      failedCount++
    }
  }

  if (archivedCount === 0 && failedCount === 0) {
    logger.success('No stale files to archive!')
  } else if (failedCount > 0) {
    logger.warning(`\n⚠️  Archived ${archivedCount} file(s), ${failedCount} failed`)
    process.exit(1)
  } else {
    logger.success(`\n✅ Archived ${archivedCount} file(s) to ${config.actions.archiveDir}`)
  }
}

async function cleanCommand(config: Config): Promise<void> {
  await checkCommand(config)
  logger.info('')
  await archiveCommand(config)
}

async function watchCommand(config: Config): Promise<void> {
  logger.info('Watching documentation files... (Press Ctrl+C to stop)\n')

  const patterns = config.patterns.rootOnly
    ? config.patterns.track.map((p) => p.replace('**/', ''))
    : config.patterns.track

  let debounceTimer: NodeJS.Timeout | null = null

  const watcher = watch(patterns, {
    ignored: config.patterns.ignore,
    persistent: true,
    ignoreInitial: true,
  })

  watcher.on('add', (filePath) => {
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(async () => {
      logger.info(`📄 File added: ${filePath}`)
      await processFile(filePath, config)
    }, config.watch.debounceMs)
  })

  watcher.on('change', (filePath) => {
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(async () => {
      logger.info(`📝 File changed: ${filePath}`)
      await processFile(filePath, config)
    }, config.watch.debounceMs)
  })

  watcher.on('error', (error) => {
    logger.error(`Watch error: ${error instanceof Error ? error.message : String(error)}`)
  })

  logger.info('Watching for changes...')
}

async function processFile(filePath: string, config: Config): Promise<void> {
  try {
    const fullPath = path.resolve(filePath)
    const stats = await fs.stat(fullPath)
    const content = await fs.readFile(fullPath, 'utf-8')
    const relativePath = path.relative(process.cwd(), fullPath)

    const file: DocFile = {
      path: fullPath,
      relativePath,
      content,
      stats,
    }

    const result = await validateContent(file, config)
    if (result.isStale) {
      logger.warning(`⚠️  Stale file detected: ${relativePath}`)
      if (config.actions.onStale === 'archive') {
        const success = await archiveFile(file, result.errors, config)
        if (!success) {
          logger.error(`Failed to archive ${relativePath}`)
        }
      }
    }
  } catch (error) {
    logger.warning(
      `Could not process file ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}

function printHelp(): void {
  logger.info(`
Documentation Lifecycle Manager

Usage:
  pnpm docs:check    - Check all docs, report stale files (no changes)
  pnpm docs:archive  - Archive stale files
  pnpm docs:watch    - Watch mode (runs continuously)
  pnpm docs:clean    - Check and archive in one command

Options:
  --dry-run          - Show what would be archived without making changes
  --help, -h         - Show this help message
  --version, -v      - Show version information

Commands:
  check              - Validate all documentation files and report issues
  archive            - Archive stale documentation files
  watch              - Watch for file changes and validate automatically
  clean              - Run check and archive in sequence

Configuration:
  Edit docs-lifecycle.config.json to customize validation rules and behavior.

Examples:
  pnpm docs:check
  pnpm docs:archive --dry-run
  pnpm docs:watch
`)
}

function printVersion(): void {
  logger.info('Documentation Lifecycle Manager v1.0.0')
}

// CLI
async function _main() {
  const args = process.argv.slice(2)

  // Handle help and version flags
  if (args.includes('--help') || args.includes('-h')) {
    printHelp()
    process.exit(0)
  }

  if (args.includes('--version') || args.includes('-v')) {
    printVersion()
    process.exit(0)
  }

  const command = args[0] || 'check'
  const config = await loadConfig()

  // Override dryRun from command line
  if (args.includes('--dry-run')) {
    config.actions.dryRun = true
  }

  try {
    switch (command) {
      case 'check':
        await checkCommand(config)
        break
      case 'archive':
        await archiveCommand(config)
        break
      case 'watch':
        await watchCommand(config)
        break
      case 'clean':
        await cleanCommand(config)
        break
      default:
        logger.error(`Unknown command: ${command}`)
        logger.info('\nRun with --help for usage information.')
        process.exit(1)
    }
  } catch (error) {
    logger.error(`Error: ${error instanceof Error ? error.message : String(error)}`)
    if (error instanceof Error && error.stack) {
      logger.error(`Stack trace: ${error.stack}`)
    }
    process.exit(1)
  }
}

/**
 * Main function
 */
async function main() {
  try {
    await getProjectRoot(import.meta.url)
    const args = process.argv.slice(2)

    // Handle help and version flags
    if (args.includes('--help') || args.includes('-h')) {
      printHelp()
      process.exit(0)
    }

    if (args.includes('--version') || args.includes('-v')) {
      printVersion()
      process.exit(0)
    }

    const command = args[0] || 'check'
    const config = await loadConfig()

    // Override dryRun from command line
    if (args.includes('--dry-run')) {
      config.actions.dryRun = true
    }

    switch (command) {
      case 'check':
        await checkCommand(config)
        break
      case 'archive':
        await archiveCommand(config)
        break
      case 'watch':
        await watchCommand(config)
        break
      case 'clean':
        await cleanCommand(config)
        break
      default:
        logger.error(`Unknown command: ${command}`)
        logger.info('\nRun with --help for usage information.')
        process.exit(1)
    }
  } catch (error) {
    logger.error(`Script failed: ${error instanceof Error ? error.message : String(error)}`)
    if (error instanceof Error && error.stack) {
      logger.error(`Stack trace: ${error.stack}`)
    }
    process.exit(1)
  }
}

main()

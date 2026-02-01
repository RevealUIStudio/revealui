#!/usr/bin/env tsx

/**
 * Console Statement Validation Script
 * Checks for console statements in production code
 * Run before commits to ensure clean production builds
 *
 * Usage:
 *   pnpm validate:console
 *   pnpm validate:console --json
 *   pnpm tsx scripts/validate/console-statements.ts
 *
 * Flags:
 *   --json   Output results as JSON for programmatic consumption
 */

import { readdir, readFile } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { createLogger, getProjectRoot } from '../lib/index.js'
import { ErrorCode } from '../lib/errors.js'

const logger = createLogger()

interface ConsoleUsage {
  file: string
  line: number
  column: number
  method: string
  code: string
}

// Files and directories to exclude from console checking
const EXCLUDED_PATHS = [
  'node_modules',
  '.next',
  '.turbo',
  'dist',
  'build',
  '.git',
  'coverage',
  '.cursor',
  // Allow console in test files
  '**/*.test.ts',
  '**/*.test.tsx',
  '**/*.spec.ts',
  '**/*.spec.tsx',
  '**/__tests__/**',
  // Allow console in config files
  '**/config/**',
  '**/configs/**',
  // Allow console in scripts directory
  'scripts/',
  // Allow console in development tools
  '**/dev/**',
  '**/tools/**',
  // Allow console in package libraries (they need logging for debugging)
  'packages/',
  // Allow console in apps for development logging
  'apps/',
]

async function shouldExcludeFile(filePath: string): Promise<boolean> {
  const relativePath = filePath.replace(`${process.cwd()}/`, '')

  for (const excludePattern of EXCLUDED_PATHS) {
    if (excludePattern.includes('*')) {
      // Simple glob matching
      const pattern = excludePattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*')
      if (new RegExp(pattern).test(relativePath)) {
        return true
      }
    } else if (relativePath.startsWith(excludePattern)) {
      return true
    }
  }

  return false
}

async function scanFile(filePath: string): Promise<ConsoleUsage[]> {
  try {
    const content = await readFile(filePath, 'utf-8')
    const lines = content.split('\n')
    const consoleUsages: ConsoleUsage[] = []

    // Simple regex to find console statements
    const consoleRegex = /\bconsole\.(log|warn|error|info|debug|trace)\s*\(/g

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      let match = consoleRegex.exec(line)

      while (match !== null) {
        consoleUsages.push({
          file: filePath,
          line: i + 1,
          column: match.index + 1,
          method: match[1],
          code: line.trim(),
        })
        match = consoleRegex.exec(line)
      }
    }

    return consoleUsages
  } catch (error) {
    logger.warning(`Failed to scan ${filePath}: ${error}`)
    return []
  }
}

async function scanDirectory(
  dirPath: string,
  results: ConsoleUsage[] = [],
): Promise<ConsoleUsage[]> {
  try {
    const entries = await readdir(dirPath, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name)

      if (await shouldExcludeFile(fullPath)) {
        continue
      }

      if (entry.isDirectory()) {
        await scanDirectory(fullPath, results)
      } else if (entry.isFile()) {
        const ext = extname(entry.name)
        if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
          const usages = await scanFile(fullPath)
          results.push(...usages)
        }
      }
    }
  } catch (error) {
    logger.warning(`Failed to scan directory ${dirPath}: ${error}`)
  }

  return results
}

async function main() {
  try {
    const isJsonMode = process.argv.includes('--json')
    const projectRoot = await getProjectRoot(import.meta.url)

    if (!isJsonMode) {
      logger.header('Console Statement Validation')
      logger.info('Scanning for console statements in production code...')
    }

    const consoleUsages = await scanDirectory(projectRoot)

    // Make paths relative for output
    const violations = consoleUsages.map((usage) => ({
      ...usage,
      file: usage.file.replace(`${projectRoot}/`, ''),
    }))

    if (isJsonMode) {
      // JSON output mode
      const output = {
        valid: violations.length === 0,
        violations,
        count: violations.length,
        excludedPaths: EXCLUDED_PATHS,
      }
      console.log(JSON.stringify(output, null, 2))

      if (violations.length > 0) {
        process.exit(ErrorCode.EXECUTION_ERROR)
      }
      return
    }

    // Human-readable output mode
    if (violations.length === 0) {
      logger.success('No console statements found in production code!')
      return
    }

    logger.error(`Found ${violations.length} console statement(s) in production code:`)
    console.log('')

    for (const usage of violations) {
      console.log(`${usage.file}:${usage.line}:${usage.column}`)
      console.log(`  ${usage.code}`)
      console.log('')
    }

    logger.error(
      'Please remove console statements from production code or move them to development-only code.',
    )
    logger.info('Allowed locations for console statements:')
    logger.info('  - Test files (*.test.ts, *.spec.ts)')
    logger.info('  - Config files')
    logger.info('  - Scripts directory')
    logger.info('  - Development tools')

    process.exit(ErrorCode.EXECUTION_ERROR)
  } catch (error) {
    logger.error(`Script failed: ${error}`)
    process.exit(ErrorCode.EXECUTION_ERROR)
  }
}

main()

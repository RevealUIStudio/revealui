#!/usr/bin/env tsx

/**
 * Check for console statements in production code
 * Cross-platform replacement for check-console-statements.sh
 */

import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createLogger, fileExists, getProjectRoot } from '../shared/utils.js'

const logger = createLogger()

interface ConsoleMatch {
  file: string
  line: number
  content: string
}

async function findConsoleStatements(
  dir: string,
  matches: ConsoleMatch[] = [],
): Promise<ConsoleMatch[]> {
  const entries = await readdir(dir, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = join(dir, entry.name)

    // Skip node_modules, dist, .next, __tests__, and other build/test directories
    if (
      entry.name === 'node_modules' ||
      entry.name === 'dist' ||
      entry.name === '.next' ||
      entry.name === '__tests__' ||
      entry.name === 'coverage' ||
      entry.name.startsWith('.')
    ) {
      continue
    }

    if (entry.isDirectory()) {
      await findConsoleStatements(fullPath, matches)
    } else if (entry.isFile()) {
      const ext = entry.name.split('.').pop()?.toLowerCase()
      if (['ts', 'tsx', 'js', 'jsx'].includes(ext || '')) {
        try {
          const content = await readFile(fullPath, 'utf-8')
          const lines = content.split('\n')

          lines.forEach((line, index) => {
            if (line.includes('console.')) {
              matches.push({
                file: fullPath,
                line: index + 1,
                content: line.trim(),
              })
            }
          })
        } catch (_error) {
          // Skip files that can't be read
        }
      }
    }
  }

  return matches
}

async function runCheck() {
  try {
    await getProjectRoot(import.meta.url)
    logger.info('Checking for console statements in production code...')
    logger.info('')

    const projectRoot = await getProjectRoot(import.meta.url)
    const searchPaths = [
      join(projectRoot, 'apps/cms/src'),
      join(projectRoot, 'apps/web/src'),
      join(projectRoot, 'packages/revealui/src'),
    ]

    const allMatches: ConsoleMatch[] = []

    for (const searchPath of searchPaths) {
      if (await fileExists(searchPath)) {
        await findConsoleStatements(searchPath, allMatches)
      }
    }

    if (allMatches.length === 0) {
      logger.success('No console statements found in production code')
      process.exit(0)
    }

    logger.warning(`Found ${allMatches.length} console statement(s) in production code:`)
    logger.info('')

    // Group by file
    const byFile = new Map<string, ConsoleMatch[]>()
    for (const match of allMatches) {
      const existing = byFile.get(match.file) || []
      existing.push(match)
      byFile.set(match.file, existing)
    }

    // Show first 3 matches per file
    for (const [file, fileMatches] of byFile.entries()) {
      logger.info(`  - ${file}`)
      for (const match of fileMatches.slice(0, 3)) {
        logger.info(`    ${match.line}: ${match.content}`)
      }
      if (fileMatches.length > 3) {
        logger.info(`    ... and ${fileMatches.length - 3} more`)
      }
    }

    logger.info('')
    logger.warning('Recommendation: Remove or replace with proper logging service')
    process.exit(1)
  } catch (error) {
    logger.error(`Check failed: ${error instanceof Error ? error.message : String(error)}`)
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
    await runCheck()
  } catch (error) {
    logger.error(`Script failed: ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  }
}

main()

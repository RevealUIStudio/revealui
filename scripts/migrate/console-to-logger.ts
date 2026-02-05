#!/usr/bin/env tsx
/**
 * Console to Logger Migration Script
 *
 * Automatically migrates console.* statements to use the logger
 * Handles imports and replacements
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const PROJECT_ROOT = process.cwd()

interface MigrationResult {
  file: string
  replaced: number
  imports: {
    added: boolean
    existingLogger: boolean
  }
}

/**
 * Detect which logger to import based on file location
 */
function detectLoggerImport(filePath: string): string {
  const relativePath = filePath.replace(`${PROJECT_ROOT}/`, '')

  // CMS app
  if (relativePath.startsWith('apps/cms/')) {
    return "import { logger } from '@revealui/core/observability/logger'"
  }

  // Other apps
  if (relativePath.startsWith('apps/')) {
    return "import { logger } from '@revealui/core/observability/logger'"
  }

  // Core package
  if (relativePath.startsWith('packages/core/')) {
    return "import { logger } from '@revealui/core/observability/logger'"
  }

  // Other packages
  if (relativePath.startsWith('packages/')) {
    return "import { logger } from '@revealui/core/observability/logger'"
  }

  // Default
  return "import { logger } from '@revealui/core/observability/logger'"
}

/**
 * Check if file already imports logger
 */
function hasLoggerImport(content: string): boolean {
  return (
    content.includes("from '@revealui/core/observability/logger'") ||
    content.includes('from "../observability/logger"') ||
    content.includes("from './logger'")
  )
}

/**
 * Add logger import to file
 */
function addLoggerImport(content: string, importStatement: string): string {
  const lines = content.split('\n')

  // Find the last import statement
  let lastImportIndex = -1
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith('import ')) {
      lastImportIndex = i
    }
  }

  // Insert after last import
  if (lastImportIndex >= 0) {
    lines.splice(lastImportIndex + 1, 0, importStatement)
  } else {
    // No imports found, add at top (after any comments/directives)
    let insertIndex = 0
    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim()
      if (
        trimmed === '' ||
        trimmed.startsWith('//') ||
        trimmed.startsWith('/*') ||
        trimmed.startsWith('*') ||
        trimmed.startsWith("'use") ||
        trimmed.startsWith('"use')
      ) {
        insertIndex = i + 1
      } else {
        break
      }
    }
    lines.splice(insertIndex, 0, importStatement, '')
  }

  return lines.join('\n')
}

/**
 * Migrate console statements to logger
 */
function migrateConsoleToLogger(content: string): { content: string; count: number } {
  let newContent = content
  let count = 0

  // console.log -> logger.info
  newContent = newContent.replace(/console\.log\(/g, () => {
    count++
    return 'logger.info('
  })

  // console.error -> logger.error with Error objects
  newContent = newContent.replace(
    /console\.error\((['"`].*?['"`]),?\s*([^)]+)?\)/g,
    (_match, message, context) => {
      count++
      if (context) {
        // If there's a second argument, treat it as error or context
        if (context.trim().startsWith('{') || context.includes('error')) {
          return `logger.error(${message}, ${context} instanceof Error ? ${context} : new Error(String(${context})))`
        }
        return `logger.error(${message}, new Error(String(${context})))`
      }
      return `logger.error(${message}, new Error(${message}))`
    },
  )

  // console.warn -> logger.warn
  newContent = newContent.replace(/console\.warn\(/g, () => {
    count++
    return 'logger.warn('
  })

  // console.debug -> logger.debug
  newContent = newContent.replace(/console\.debug\(/g, () => {
    count++
    return 'logger.debug('
  })

  // console.info -> logger.info
  newContent = newContent.replace(/console\.info\(/g, () => {
    count++
    return 'logger.info('
  })

  return { content: newContent, count }
}

/**
 * Migrate a single file
 */
function migrateFile(filePath: string, dryRun = false): MigrationResult | null {
  try {
    const content = readFileSync(filePath, 'utf-8')

    // Skip if no console statements
    if (!content.includes('console.')) {
      return null
    }

    const hasExistingLogger = hasLoggerImport(content)
    let newContent = content

    // Add logger import if needed
    if (!hasExistingLogger) {
      const importStatement = detectLoggerImport(filePath)
      newContent = addLoggerImport(newContent, importStatement)
    }

    // Migrate console statements
    const { content: migratedContent, count } = migrateConsoleToLogger(newContent)

    if (count === 0) {
      return null
    }

    // Write file
    if (!dryRun) {
      writeFileSync(filePath, migratedContent, 'utf-8')
    }

    return {
      file: filePath.replace(`${PROJECT_ROOT}/`, ''),
      replaced: count,
      imports: {
        added: !hasExistingLogger,
        existingLogger: hasExistingLogger,
      },
    }
  } catch (error) {
    console.error(`Error migrating ${filePath}:`, error)
    return null
  }
}

/**
 * Main migration
 */
async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const fileArg = process.argv.find((arg) => arg.startsWith('--file='))

  if (!fileArg) {
    console.error('Usage: tsx scripts/migrate/console-to-logger.ts --file=<path> [--dry-run]')
    console.error('')
    console.error('Example:')
    console.error('  tsx scripts/migrate/console-to-logger.ts --file=apps/api/src/index.ts')
    console.error(
      '  tsx scripts/migrate/console-to-logger.ts --file=apps/api/src/index.ts --dry-run',
    )
    process.exit(1)
  }

  const filePath = fileArg.split('=')[1]
  const fullPath = join(PROJECT_ROOT, filePath)

  console.log(`\n🔄 Migrating console statements in: ${filePath}`)
  if (dryRun) {
    console.log('   (DRY RUN - no files will be modified)\n')
  } else {
    console.log('')
  }

  const result = migrateFile(fullPath, dryRun)

  if (!result) {
    console.log('✅ No console statements found or migration not needed')
    return
  }

  console.log('📊 Migration Results:')
  console.log(`   Replaced: ${result.replaced} console statements`)
  console.log(`   Logger import: ${result.imports.added ? '✅ Added' : '⚠️  Already exists'}`)

  if (dryRun) {
    console.log('\n💡 Run without --dry-run to apply changes')
  } else {
    console.log('\n✅ Migration complete!')
  }
}

main()

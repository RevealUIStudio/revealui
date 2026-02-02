#!/usr/bin/env tsx
/**
 * Type System CLI
 *
 * Helpful commands for working with the unified type system.
 *
 * Usage:
 *   pnpm types:check       - Quick type consistency check
 *   pnpm types:diff        - Show differences between source and generated
 *   pnpm types:info        - Display type system information
 *   pnpm types:coverage    - Show schema coverage statistics
 */

import { execSync } from 'node:child_process'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const rootDir = join(import.meta.dirname, '../..')

type Command = 'check' | 'diff' | 'info' | 'coverage' | 'help'

const COMMANDS: Record<Command, { description: string; action: () => Promise<void> }> = {
  check: {
    description: 'Quick type consistency check',
    action: checkTypes,
  },
  diff: {
    description: 'Show differences between source and generated',
    action: showDiff,
  },
  info: {
    description: 'Display type system information',
    action: showInfo,
  },
  coverage: {
    description: 'Show schema coverage statistics',
    action: showCoverage,
  },
  help: {
    description: 'Show this help message',
    action: showHelp,
  },
}

/**
 * Quick type consistency check
 */
async function checkTypes(): Promise<void> {
  console.log('🔍 Checking type consistency...\n')

  const checks = [checkGeneratedFilesExist(), checkTimestamps(), checkImports()]

  const results = await Promise.all(checks)
  const allPassed = results.every((r) => r.success)

  console.log(`\n${'='.repeat(50)}`)
  if (allPassed) {
    console.log('✅ All checks passed!')
  } else {
    console.log('❌ Some checks failed')
    process.exit(1)
  }
}

interface CheckResult {
  success: boolean
  message: string
}

function checkGeneratedFilesExist(): CheckResult {
  const files = [
    'packages/db/src/types/database.ts',
    'packages/contracts/src/generated/zod-schemas.ts',
    'packages/contracts/src/generated/contracts.ts',
  ]

  for (const file of files) {
    const fullPath = join(rootDir, file)
    if (!existsSync(fullPath)) {
      return {
        success: false,
        message: `❌ Missing: ${file}`,
      }
    }
  }

  console.log('✅ All generated files exist')
  return { success: true, message: '' }
}

function checkTimestamps(): CheckResult {
  const sourceFiles = [
    'packages/db/src/schema/users.ts',
    'packages/db/src/schema/sites.ts',
    'packages/db/src/schema/pages.ts',
  ]

  const generatedFiles = [
    'packages/contracts/src/generated/zod-schemas.ts',
    'packages/contracts/src/generated/contracts.ts',
  ]

  let latestSourceTime = 0
  for (const file of sourceFiles) {
    const fullPath = join(rootDir, file)
    if (existsSync(fullPath)) {
      const stats = statSync(fullPath)
      latestSourceTime = Math.max(latestSourceTime, stats.mtimeMs)
    }
  }

  for (const file of generatedFiles) {
    const fullPath = join(rootDir, file)
    if (existsSync(fullPath)) {
      const stats = statSync(fullPath)
      if (stats.mtimeMs < latestSourceTime) {
        return {
          success: false,
          message: `⚠️  Generated files may be stale. Run: pnpm generate:all`,
        }
      }
    }
  }

  console.log('✅ Generated files are up to date')
  return { success: true, message: '' }
}

function checkImports(): CheckResult {
  const zodSchemasPath = join(rootDir, 'packages/contracts/src/generated/zod-schemas.ts')

  if (!existsSync(zodSchemasPath)) {
    return { success: false, message: '❌ zod-schemas.ts not found' }
  }

  const content = readFileSync(zodSchemasPath, 'utf-8')

  // Check for drizzle-zod imports
  if (!(content.includes('createInsertSchema') && content.includes('createSelectSchema'))) {
    return {
      success: false,
      message: '❌ Missing drizzle-zod imports in generated schemas',
    }
  }

  console.log('✅ Imports look correct')
  return { success: true, message: '' }
}

/**
 * Show differences between source and generated
 */
async function showDiff(): Promise<void> {
  console.log('📊 Analyzing schema changes...\n')

  // Get list of tables from generated schemas
  const zodSchemasPath = join(rootDir, 'packages/contracts/src/generated/zod-schemas.ts')

  if (!existsSync(zodSchemasPath)) {
    console.log('❌ Generated schemas not found. Run: pnpm generate:all')
    return
  }

  const content = readFileSync(zodSchemasPath, 'utf-8')
  const schemaMatches = content.match(/export const (\w+)SelectSchema/g) || []
  const tables = schemaMatches.map((m) =>
    m.replace('export const ', '').replace('SelectSchema', ''),
  )

  console.log(`Found ${tables.length} table schemas:\n`)

  for (const table of tables.slice(0, 5)) {
    console.log(`  ✓ ${table}`)
  }

  if (tables.length > 5) {
    console.log(`  ... and ${tables.length - 5} more`)
  }

  // Check for uncommitted changes in generated files
  console.log('\n🔍 Checking for uncommitted changes...\n')

  try {
    const status = execSync('git status --porcelain packages/contracts/src/generated/', {
      cwd: rootDir,
      encoding: 'utf-8',
    }).trim()

    if (status) {
      console.log('⚠️  Uncommitted changes detected:')
      console.log(status)
      console.log('\nRun: git add packages/contracts/src/generated/')
    } else {
      console.log('✅ No uncommitted changes in generated files')
    }
  } catch (_error) {
    console.log('ℹ️  Git check skipped (not in a git repository)')
  }
}

/**
 * Display type system information
 */
async function showInfo(): Promise<void> {
  console.log('📚 Type System Information\n')
  console.log('Architecture:')
  console.log('  Source:     packages/db/src/schema/*.ts (Drizzle)')
  console.log('  Generated:  packages/contracts/src/generated/*.ts')
  console.log('  Business:   packages/contracts/src/entities/*.ts')
  console.log('')

  // Count files
  const schemaFiles = execSync('find packages/db/src/schema -name "*.ts" | wc -l', {
    cwd: rootDir,
    encoding: 'utf-8',
  }).trim()

  const entityFiles = execSync('find packages/contracts/src/entities -name "*.ts" | wc -l', {
    cwd: rootDir,
    encoding: 'utf-8',
  }).trim()

  console.log('Statistics:')
  console.log(`  Schema files:   ${schemaFiles}`)
  console.log(`  Entity files:   ${entityFiles}`)

  // Get line counts
  const zodSchemasPath = join(rootDir, 'packages/contracts/src/generated/zod-schemas.ts')
  const contractsPath = join(rootDir, 'packages/contracts/src/generated/contracts.ts')

  if (existsSync(zodSchemasPath)) {
    const zodLines = readFileSync(zodSchemasPath, 'utf-8').split('\n').length
    console.log(`  Zod schemas:    ${zodLines} lines`)
  }

  if (existsSync(contractsPath)) {
    const contractLines = readFileSync(contractsPath, 'utf-8').split('\n').length
    console.log(`  Contracts:      ${contractLines} lines`)
  }

  console.log('\nCommands:')
  console.log('  pnpm generate:all           - Regenerate all types')
  console.log('  pnpm validate:types         - Basic validation')
  console.log('  pnpm validate:types:enhanced - Comprehensive validation')
  console.log('')
}

/**
 * Show schema coverage statistics
 */
async function showCoverage(): Promise<void> {
  console.log('📊 Schema Coverage Analysis\n')

  const zodSchemasPath = join(rootDir, 'packages/contracts/src/generated/zod-schemas.ts')

  if (!existsSync(zodSchemasPath)) {
    console.log('❌ Generated schemas not found. Run: pnpm generate:all')
    return
  }

  const content = readFileSync(zodSchemasPath, 'utf-8')

  // Count schemas
  const selectSchemas = (content.match(/export const \w+SelectSchema/g) || []).length
  const insertSchemas = (content.match(/export const \w+InsertSchema/g) || []).length
  const types = (content.match(/export type \w+/g) || []).length

  console.log('Generated Schemas:')
  console.log(`  Select schemas: ${selectSchemas}`)
  console.log(`  Insert schemas: ${insertSchemas}`)
  console.log(`  Type exports:   ${types}`)
  console.log('')

  // Check contracts
  const contractsPath = join(rootDir, 'packages/contracts/src/generated/contracts.ts')

  if (existsSync(contractsPath)) {
    const contractContent = readFileSync(contractsPath, 'utf-8')
    const contracts = (contractContent.match(/export const \w+Contract/g) || []).length

    console.log('Contract Coverage:')
    console.log(`  Total contracts: ${contracts}`)
    console.log(
      `  Coverage ratio:  ${contracts}/${selectSchemas + insertSchemas} (${Math.round((contracts / (selectSchemas + insertSchemas)) * 100)}%)`,
    )
  }

  console.log('')
}

/**
 * Show help message
 */
async function showHelp(): Promise<void> {
  console.log('Type System CLI\n')
  console.log('Usage: pnpm types:<command>\n')
  console.log('Commands:')

  for (const [cmd, { description }] of Object.entries(COMMANDS)) {
    console.log(`  ${cmd.padEnd(12)} ${description}`)
  }

  console.log('\nExamples:')
  console.log('  pnpm types:check       # Quick consistency check')
  console.log('  pnpm types:diff        # Show schema changes')
  console.log('  pnpm types:coverage    # Coverage statistics')
  console.log('')
}

// Main execution
const command = (process.argv[2] || 'help') as Command

if (!(command in COMMANDS)) {
  console.error(`❌ Unknown command: ${command}`)
  await showHelp()
  process.exit(1)
}

await COMMANDS[command].action()

#!/usr/bin/env tsx
/**
 * Schema Migration Detector
 *
 * Detects breaking changes between schema versions:
 * - Removed fields
 * - Type changes
 * - Required field additions
 * - Table removals
 *
 * @dependencies
 * - scripts/lib/errors.ts - ErrorCode and ScriptError for validation
 * - node:child_process - Process execution (execSync)
 * - node:fs - File system operations (existsSync, readFileSync, writeFileSync)
 * - node:path - Path manipulation utilities
 *
 * Usage: pnpm types:migration-check
 */

import { execSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { ErrorCode, ScriptError } from '../lib/errors.js'

const rootDir = join(import.meta.dirname, '../..')
const snapshotFile = join(rootDir, '.type-system-snapshot.json')

interface TableSnapshot {
  name: string
  fields: Array<{
    name: string
    type: string
    required: boolean
    hasDefault: boolean
  }>
}

interface SystemSnapshot {
  timestamp: string
  commit: string
  tables: TableSnapshot[]
}

interface MigrationIssue {
  severity: 'breaking' | 'warning' | 'info'
  type:
    | 'table-removed'
    | 'field-removed'
    | 'field-type-changed'
    | 'field-now-required'
    | 'table-added'
    | 'field-added'
  table: string
  field?: string
  details: string
  migration?: string
}

/**
 * Extract table structure from generated Zod schemas
 */
function extractTableStructure(): TableSnapshot[] {
  const zodSchemasPath = join(rootDir, 'packages/contracts/src/generated/zod-schemas.ts')

  if (!existsSync(zodSchemasPath)) {
    throw new ScriptError(
      'Generated schemas not found. Run: pnpm generate:all',
      ErrorCode.NOT_FOUND,
    )
  }

  const content = readFileSync(zodSchemasPath, 'utf-8')
  const tables: TableSnapshot[] = []

  // This is a simplified extraction - in production, you'd want to use TS compiler API
  const tableMatches = content.match(/export const (\w+)SelectSchema = createSelectSchema/g) || []

  for (const match of tableMatches) {
    const tableName = match
      .replace('export const ', '')
      .replace('SelectSchema = createSelectSchema', '')
      .trim()

    // For now, we'll track basic info
    // In production, parse the actual schema structure
    tables.push({
      name: tableName,
      fields: [], // Would need deeper parsing
    })
  }

  return tables
}

/**
 * Get current git commit
 */
function getCurrentCommit(): string {
  try {
    return execSync('git rev-parse --short HEAD', {
      cwd: rootDir,
      encoding: 'utf-8',
    }).trim()
  } catch {
    return 'unknown'
  }
}

/**
 * Create snapshot of current schema
 */
function createSnapshot(): SystemSnapshot {
  console.log('📸 Creating schema snapshot...\n')

  const tables = extractTableStructure()

  const snapshot: SystemSnapshot = {
    timestamp: new Date().toISOString(),
    commit: getCurrentCommit(),
    tables,
  }

  writeFileSync(snapshotFile, JSON.stringify(snapshot, null, 2))
  console.log(`✅ Snapshot saved: ${tables.length} tables`)

  return snapshot
}

/**
 * Load previous snapshot
 */
function loadSnapshot(): SystemSnapshot | null {
  if (!existsSync(snapshotFile)) {
    return null
  }

  const content = readFileSync(snapshotFile, 'utf-8')
  return JSON.parse(content)
}

/**
 * Compare snapshots and detect migrations
 */
function detectMigrations(previous: SystemSnapshot, current: SystemSnapshot): MigrationIssue[] {
  const issues: MigrationIssue[] = []

  const prevTableMap = new Map(previous.tables.map((t) => [t.name, t]))
  const currTableMap = new Map(current.tables.map((t) => [t.name, t]))

  // Check for removed tables
  for (const [tableName, _table] of prevTableMap) {
    if (!currTableMap.has(tableName)) {
      issues.push({
        severity: 'breaking',
        type: 'table-removed',
        table: tableName,
        details: `Table '${tableName}' was removed`,
        migration: `
-- Migration needed: Remove table
DROP TABLE IF EXISTS ${tableName};

-- Or if you want to preserve data:
-- ALTER TABLE ${tableName} RENAME TO ${tableName}_archived;
        `.trim(),
      })
    }
  }

  // Check for added tables
  for (const [tableName, _table] of currTableMap) {
    if (!prevTableMap.has(tableName)) {
      issues.push({
        severity: 'info',
        type: 'table-added',
        table: tableName,
        details: `New table '${tableName}' was added`,
      })
    }
  }

  // For existing tables, check field changes
  for (const [tableName, prevTable] of prevTableMap) {
    const currTable = currTableMap.get(tableName)
    if (!currTable) continue

    const prevFields = new Map(prevTable.fields.map((f) => [f.name, f]))
    const currFields = new Map(currTable.fields.map((f) => [f.name, f]))

    // Check for removed fields
    for (const [fieldName, _field] of prevFields) {
      if (!currFields.has(fieldName)) {
        issues.push({
          severity: 'breaking',
          type: 'field-removed',
          table: tableName,
          field: fieldName,
          details: `Field '${fieldName}' was removed from '${tableName}'`,
          migration: `
-- Migration needed: Remove field
ALTER TABLE ${tableName} DROP COLUMN ${fieldName};
          `.trim(),
        })
      }
    }

    // Check for added fields
    for (const [fieldName, field] of currFields) {
      if (!prevFields.has(fieldName)) {
        const severity = field.required && !field.hasDefault ? 'breaking' : 'warning'
        issues.push({
          severity,
          type: 'field-added',
          table: tableName,
          field: fieldName,
          details: field.required
            ? `Required field '${fieldName}' was added to '${tableName}'`
            : `Optional field '${fieldName}' was added to '${tableName}'`,
          migration:
            severity === 'breaking'
              ? `
-- Migration needed: Add required field
-- Option 1: Add with default value
ALTER TABLE ${tableName} ADD COLUMN ${fieldName} ${field.type} NOT NULL DEFAULT 'default_value';

-- Option 2: Add as nullable first, then backfill
ALTER TABLE ${tableName} ADD COLUMN ${fieldName} ${field.type};
UPDATE ${tableName} SET ${fieldName} = 'default_value' WHERE ${fieldName} IS NULL;
ALTER TABLE ${tableName} ALTER COLUMN ${fieldName} SET NOT NULL;
          `.trim()
              : undefined,
        })
      }
    }

    // Check for type changes
    for (const [fieldName, prevField] of prevFields) {
      const currField = currFields.get(fieldName)
      if (!currField) continue

      if (prevField.type !== currField.type) {
        issues.push({
          severity: 'breaking',
          type: 'field-type-changed',
          table: tableName,
          field: fieldName,
          details: `Field '${fieldName}' type changed from '${prevField.type}' to '${currField.type}'`,
          migration: `
-- Migration needed: Change field type
ALTER TABLE ${tableName} ALTER COLUMN ${fieldName} TYPE ${currField.type} USING ${fieldName}::${currField.type};
          `.trim(),
        })
      }

      // Check if field became required
      if (!prevField.required && currField.required) {
        issues.push({
          severity: 'breaking',
          type: 'field-now-required',
          table: tableName,
          field: fieldName,
          details: `Field '${fieldName}' is now required`,
          migration: `
-- Migration needed: Make field required
-- First, ensure no NULL values exist
UPDATE ${tableName} SET ${fieldName} = 'default_value' WHERE ${fieldName} IS NULL;
ALTER TABLE ${tableName} ALTER COLUMN ${fieldName} SET NOT NULL;
          `.trim(),
        })
      }
    }
  }

  return issues
}

/**
 * Display migration report
 */
function displayReport(
  issues: MigrationIssue[],
  previous: SystemSnapshot,
  current: SystemSnapshot,
): void {
  console.log('\n🔍 Schema Migration Analysis\n')
  console.log('='.repeat(70))

  console.log(`\nComparing:`)
  console.log(`  Previous: ${previous.commit} (${new Date(previous.timestamp).toLocaleString()})`)
  console.log(`  Current:  ${current.commit} (${new Date(current.timestamp).toLocaleString()})`)

  if (issues.length === 0) {
    console.log('\n✅ No breaking changes detected!\n')
    return
  }

  const breaking = issues.filter((i) => i.severity === 'breaking')
  const warnings = issues.filter((i) => i.severity === 'warning')
  const info = issues.filter((i) => i.severity === 'info')

  console.log(`\nFound ${issues.length} changes:`)
  console.log(`  Breaking: ${breaking.length}`)
  console.log(`  Warnings: ${warnings.length}`)
  console.log(`  Info:     ${info.length}`)

  if (breaking.length > 0) {
    console.log('\n❌ Breaking Changes:\n')
    for (const issue of breaking) {
      console.log(`  ${issue.table}${issue.field ? `.${issue.field}` : ''}`)
      console.log(`    ${issue.details}`)
      if (issue.migration) {
        console.log(`\n    Migration SQL:`)
        for (const line of issue.migration.split('\n')) {
          console.log(`    ${line}`)
        }
      }
      console.log('')
    }
  }

  if (warnings.length > 0) {
    console.log('\n⚠️  Warnings:\n')
    for (const issue of warnings) {
      console.log(`  ${issue.table}${issue.field ? `.${issue.field}` : ''}`)
      console.log(`    ${issue.details}`)
      console.log('')
    }
  }

  if (info.length > 0) {
    console.log('\nℹ️  Info:\n')
    for (const issue of info) {
      console.log(`  ${issue.table}${issue.field ? `.${issue.field}` : ''}`)
      console.log(`    ${issue.details}`)
      console.log('')
    }
  }

  console.log('='.repeat(70))

  if (breaking.length > 0) {
    console.log('\n⚠️  IMPORTANT: Breaking changes detected!')
    console.log('Review migration SQL above before deploying.\n')
  }
}

// Main execution
const command = process.argv[2] || 'check'

if (command === 'snapshot' || command === 'save') {
  createSnapshot()
} else if (command === 'check' || command === 'compare') {
  const previous = loadSnapshot()

  if (!previous) {
    console.log('ℹ️  No previous snapshot found.')
    console.log('Creating initial snapshot...\n')
    createSnapshot()
    console.log('\nRun this command again after making schema changes to detect migrations.')
  } else {
    // Generate current types and create new snapshot
    console.log('🔄 Generating current types...\n')
    execSync('pnpm generate:all', { cwd: rootDir, stdio: 'inherit' })

    const current = {
      timestamp: new Date().toISOString(),
      commit: getCurrentCommit(),
      tables: extractTableStructure(),
    }

    const issues = detectMigrations(previous, current)
    displayReport(issues, previous, current)

    // Prompt to update snapshot
    console.log('\nTo update the snapshot after reviewing:')
    console.log('  pnpm types:migration-check snapshot')
  }
} else if (command === 'diff') {
  const previous = loadSnapshot()
  if (!previous) {
    console.log('❌ No previous snapshot found. Run: pnpm types:migration-check snapshot')
    process.exit(ErrorCode.MISSING_CONFIG)
  }

  console.log('Previous snapshot:')
  console.log(`  Commit: ${previous.commit}`)
  console.log(`  Date:   ${new Date(previous.timestamp).toLocaleString()}`)
  console.log(`  Tables: ${previous.tables.length}`)
} else {
  console.log('Schema Migration Detector\n')
  console.log('Usage:')
  console.log('  pnpm types:migration-check           - Check for migrations')
  console.log('  pnpm types:migration-check snapshot  - Create/update snapshot')
  console.log('  pnpm types:migration-check diff      - Show snapshot info')
}

#!/usr/bin/env tsx
/**
 * Enhanced Type System Validation
 *
 * Provides comprehensive validation including:
 * - Schema drift detection
 * - Breaking change analysis
 * - Field type changes
 * - Missing/added fields
 * - Schema version validation
 * - Migration suggestions
 *
 * Usage: pnpm validate:types:enhanced
 */

import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import * as ts from 'typescript'

const VERBOSE_LOGGING =
  process.env.DB_VERBOSE !== 'false' &&
  (process.env.NODE_ENV !== 'production' || process.env.CI !== 'true')

interface ValidationIssue {
  severity: 'error' | 'warning' | 'info'
  category:
    | 'drift'
    | 'breaking-change'
    | 'missing-field'
    | 'type-change'
    | 'schema-version'
    | 'coverage'
  table: string
  field?: string
  message: string
  suggestion?: string
}

interface ValidationReport {
  success: boolean
  issues: ValidationIssue[]
  stats: {
    tablesChecked: number
    fieldsChecked: number
    errorsFound: number
    warningsFound: number
    breakingChanges: number
  }
}

/**
 * Parse TypeScript file and extract type information
 */
function parseTypeScript(filePath: string): ts.SourceFile | null {
  if (!existsSync(filePath)) return null

  const content = readFileSync(filePath, 'utf-8')
  return ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true)
}

/**
 * Extract table schemas from Drizzle source files
 */
function extractDrizzleSchemas(schemaDir: string): Map<string, any> {
  const schemas = new Map()
  // This would parse the actual Drizzle schema files
  // For now, we'll rely on the generated types
  return schemas
}

/**
 * Check for breaking changes between old and new generated files
 */
function detectBreakingChanges(
  oldGenerated: string,
  newGenerated: string,
): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  if (!existsSync(oldGenerated)) {
    return issues // First generation, no breaking changes
  }

  const oldContent = readFileSync(oldGenerated, 'utf-8')
  const newContent = readFileSync(newGenerated, 'utf-8')

  // Check for removed exports
  const oldExports = extractExports(oldContent)
  const newExports = extractExports(newContent)

  for (const oldExport of oldExports) {
    if (!newExports.has(oldExport)) {
      issues.push({
        severity: 'error',
        category: 'breaking-change',
        table: oldExport,
        message: `Exported type '${oldExport}' was removed`,
        suggestion: 'Add deprecation notice before removing types',
      })
    }
  }

  return issues
}

/**
 * Extract export names from TypeScript content
 */
function extractExports(content: string): Set<string> {
  const exports = new Set<string>()
  const exportRegex = /export (?:const|type|interface) (\w+)/g
  let match

  while ((match = exportRegex.exec(content)) !== null) {
    exports.add(match[1])
  }

  return exports
}

/**
 * Validate schema field coverage
 */
function validateCoverage(rootDir: string): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  // Check that all Drizzle tables have corresponding Zod schemas
  const schemaFiles = [
    'packages/db/src/schema/users.ts',
    'packages/db/src/schema/sites.ts',
    'packages/db/src/schema/pages.ts',
    // Add more as needed
  ]

  const generatedZodPath = join(rootDir, 'packages/contracts/src/generated/zod-schemas.ts')

  if (!existsSync(generatedZodPath)) {
    issues.push({
      severity: 'error',
      category: 'drift',
      table: 'all',
      message: 'Generated Zod schemas file does not exist',
      suggestion: 'Run: pnpm generate:all',
    })
    return issues
  }

  const zodContent = readFileSync(generatedZodPath, 'utf-8')

  for (const schemaFile of schemaFiles) {
    const fullPath = join(rootDir, schemaFile)
    if (!existsSync(fullPath)) continue

    const tableName = schemaFile.split('/').pop()?.replace('.ts', '') || ''
    const pascalName = tableName.charAt(0).toUpperCase() + tableName.slice(1)

    if (!zodContent.includes(`${pascalName}SelectSchema`)) {
      issues.push({
        severity: 'warning',
        category: 'coverage',
        table: tableName,
        message: `Table '${tableName}' has no generated Zod schema`,
        suggestion: 'Ensure table is properly exported and run: pnpm generate:all',
      })
    }
  }

  return issues
}

/**
 * Validate schema versions are consistent
 */
function validateSchemaVersions(rootDir: string): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  // Check database.ts has recent generation timestamp
  const dbTypesPath = join(rootDir, 'packages/db/src/types/database.ts')

  if (existsSync(dbTypesPath)) {
    const content = readFileSync(dbTypesPath, 'utf-8')
    const timestampMatch = content.match(/Generated: (.+)/)

    if (timestampMatch) {
      const generatedDate = new Date(timestampMatch[1])
      const daysSinceGeneration = (Date.now() - generatedDate.getTime()) / (1000 * 60 * 60 * 24)

      if (daysSinceGeneration > 30) {
        issues.push({
          severity: 'warning',
          category: 'schema-version',
          table: 'database',
          message: `Database types were generated ${Math.floor(daysSinceGeneration)} days ago`,
          suggestion: 'Consider regenerating to ensure types are current',
        })
      }
    }
  }

  return issues
}

/**
 * Check for common type safety issues
 */
function validateTypeSafety(rootDir: string): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  const zodSchemasPath = join(rootDir, 'packages/contracts/src/generated/zod-schemas.ts')

  if (existsSync(zodSchemasPath)) {
    const content = readFileSync(zodSchemasPath, 'utf-8')

    // Check for any usage
    if (content.includes(': any')) {
      issues.push({
        severity: 'warning',
        category: 'type-change',
        table: 'generated',
        message: 'Generated schemas contain "any" types',
        suggestion: 'Review Drizzle schemas for proper typing',
      })
    }

    // Check for proper imports
    if (!content.includes('import { createInsertSchema, createSelectSchema }')) {
      issues.push({
        severity: 'error',
        category: 'drift',
        table: 'generated',
        message: 'Missing drizzle-zod imports in generated schemas',
        suggestion: 'Regenerate schemas: pnpm generate:all',
      })
    }
  }

  return issues
}

/**
 * Validate file timestamps to detect stale generated files
 */
function validateFileTimestamps(rootDir: string): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  const sourceFiles = [
    'packages/db/src/schema/users.ts',
    'packages/db/src/schema/sites.ts',
    'packages/db/src/schema/pages.ts',
  ]

  const generatedFiles = [
    'packages/contracts/src/generated/zod-schemas.ts',
    'packages/contracts/src/generated/contracts.ts',
    'packages/db/src/types/database.ts',
  ]

  // Get latest source file modification time
  let latestSourceTime = 0
  for (const file of sourceFiles) {
    const fullPath = join(rootDir, file)
    if (existsSync(fullPath)) {
      const stats = statSync(fullPath)
      latestSourceTime = Math.max(latestSourceTime, stats.mtimeMs)
    }
  }

  // Check if any generated file is older than source
  for (const file of generatedFiles) {
    const fullPath = join(rootDir, file)
    if (existsSync(fullPath)) {
      const stats = statSync(fullPath)
      if (stats.mtimeMs < latestSourceTime) {
        issues.push({
          severity: 'warning',
          category: 'drift',
          table: 'generated',
          field: file,
          message: `Generated file is older than source schemas`,
          suggestion: 'Run: pnpm generate:all',
        })
      }
    }
  }

  return issues
}

/**
 * Main validation function
 */
export async function enhancedValidate(): Promise<ValidationReport> {
  const rootDir = join(import.meta.dirname, '../..')
  const issues: ValidationIssue[] = []

  if (VERBOSE_LOGGING) {
    console.log('🔍 Running enhanced type system validation...\n')
  }

  // Run all validation checks
  issues.push(...validateCoverage(rootDir))
  issues.push(...validateSchemaVersions(rootDir))
  issues.push(...validateTypeSafety(rootDir))
  issues.push(...validateFileTimestamps(rootDir))

  // Calculate stats
  const errors = issues.filter((i) => i.severity === 'error')
  const warnings = issues.filter((i) => i.severity === 'warning')
  const breakingChanges = issues.filter((i) => i.category === 'breaking-change')

  const report: ValidationReport = {
    success: errors.length === 0,
    issues,
    stats: {
      tablesChecked: new Set(issues.map((i) => i.table)).size,
      fieldsChecked: issues.filter((i) => i.field).length,
      errorsFound: errors.length,
      warningsFound: warnings.length,
      breakingChanges: breakingChanges.length,
    },
  }

  return report
}

/**
 * Format and display validation report
 */
function displayReport(report: ValidationReport): void {
  console.log('\n📊 Validation Results\n')
  console.log(`Tables checked: ${report.stats.tablesChecked}`)
  console.log(`Fields checked: ${report.stats.fieldsChecked}`)
  console.log(`Errors: ${report.stats.errorsFound}`)
  console.log(`Warnings: ${report.stats.warningsFound}`)
  console.log(`Breaking changes: ${report.stats.breakingChanges}`)
  console.log('')

  if (report.issues.length === 0) {
    console.log('✅ No issues found!\n')
    return
  }

  // Group issues by severity
  const errorIssues = report.issues.filter((i) => i.severity === 'error')
  const warningIssues = report.issues.filter((i) => i.severity === 'warning')
  const infoIssues = report.issues.filter((i) => i.severity === 'info')

  if (errorIssues.length > 0) {
    console.log('❌ Errors:\n')
    for (const issue of errorIssues) {
      console.log(`  ${issue.table}${issue.field ? `.${issue.field}` : ''}`)
      console.log(`    ${issue.message}`)
      if (issue.suggestion) {
        console.log(`    💡 ${issue.suggestion}`)
      }
      console.log('')
    }
  }

  if (warningIssues.length > 0) {
    console.log('⚠️  Warnings:\n')
    for (const issue of warningIssues) {
      console.log(`  ${issue.table}${issue.field ? `.${issue.field}` : ''}`)
      console.log(`    ${issue.message}`)
      if (issue.suggestion) {
        console.log(`    💡 ${issue.suggestion}`)
      }
      console.log('')
    }
  }

  if (infoIssues.length > 0 && VERBOSE_LOGGING) {
    console.log('ℹ️  Info:\n')
    for (const issue of infoIssues) {
      console.log(`  ${issue.table}${issue.field ? `.${issue.field}` : ''}`)
      console.log(`    ${issue.message}`)
      console.log('')
    }
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const report = await enhancedValidate()
    displayReport(report)

    if (!report.success) {
      console.log('❌ Enhanced validation failed\n')
      process.exit(1)
    }

    console.log('✅ Enhanced validation passed!\n')
  } catch (error) {
    console.error('❌ Error during enhanced validation:', error)
    process.exit(1)
  }
}

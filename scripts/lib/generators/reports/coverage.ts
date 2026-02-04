/**
 * Coverage Calculation Module
 *
 * Calculates type coverage statistics for the codebase.
 * Extracted from coverage-report.ts for better modularity.
 *
 * @dependencies
 * - node:fs - Synchronous file operations (existsSync, readFileSync)
 * - node:path - Path utilities (join)
 * - fast-glob - Efficient file pattern matching for finding application files
 *
 * @example
 * ```typescript
 * import { generateReport } from './coverage.js'
 *
 * const stats = await generateReport()
 * console.log(`Found ${stats.generated.totalContracts} contracts`)
 * ```
 */

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import glob from 'fast-glob'

// =============================================================================
// Types
// =============================================================================

export interface CoverageStats {
  generated: {
    totalContracts: number
    totalSchemas: number
    tables: number
  }
  usage: {
    contractImports: number
    schemaImports: number
    directDbImports: number
    totalFiles: number
  }
  validation: {
    filesUsingValidation: number
    filesUsingTypeGuards: number
    filesUsingParse: number
  }
  typeAny: {
    count: number
    files: string[]
  }
  entityContracts: {
    total: number
    extendingGenerated: number
    standalone: number
  }
}

export interface FileAnalysis {
  path: string
  importsContracts: boolean
  importsSchemas: boolean
  usesValidation: boolean
  usesTypeGuards: boolean
  usesParse: boolean
  hasAnyTypes: boolean
  anyCount: number
}

// =============================================================================
// Coverage Calculation
// =============================================================================

/**
 * Count generated contracts and schemas
 *
 * @param rootDir - Project root directory
 * @returns Generated content statistics
 */
export function countGenerated(rootDir: string): CoverageStats['generated'] {
  const zodSchemasPath = join(rootDir, 'packages/contracts/src/generated/zod-schemas.ts')
  const contractsPath = join(rootDir, 'packages/contracts/src/generated/contracts.ts')

  let tables = 0
  let totalSchemas = 0
  let totalContracts = 0

  if (existsSync(zodSchemasPath)) {
    const content = readFileSync(zodSchemasPath, 'utf-8')
    const selectSchemas = (content.match(/export const \w+SelectSchema/g) || []).length
    const insertSchemas = (content.match(/export const \w+InsertSchema/g) || []).length
    tables = selectSchemas
    totalSchemas = selectSchemas + insertSchemas
  }

  if (existsSync(contractsPath)) {
    const content = readFileSync(contractsPath, 'utf-8')
    totalContracts = (content.match(/export const \w+Contract/g) || []).length
  }

  return { totalContracts, totalSchemas, tables }
}

/**
 * Analyze a TypeScript file for contract usage
 *
 * @param filePath - Path to file
 * @param rootDir - Project root directory
 * @returns File analysis results
 */
export function analyzeFile(filePath: string, rootDir: string): FileAnalysis {
  const content = readFileSync(filePath, 'utf-8')

  return {
    path: filePath.replace(`${rootDir}/`, ''),
    importsContracts:
      content.includes("from '@revealui/contracts'") ||
      content.includes("from '@revealui/contracts/generated'") ||
      content.includes("from '../generated/contracts") ||
      /Contract\s*[,}]/.test(content),
    importsSchemas:
      content.includes("from '@revealui/contracts/generated'") ||
      content.includes("from '../generated/zod-schemas"),
    usesValidation: content.includes('.validate(') || content.includes('.safeParse('),
    usesTypeGuards: content.includes('.isType('),
    usesParse: content.includes('.parse('),
    hasAnyTypes: /:\s*any\b/.test(content) || /as\s+any\b/.test(content),
    anyCount:
      (content.match(/:\s*any\b/g) || []).length + (content.match(/as\s+any\b/g) || []).length,
  }
}

/**
 * Find all TypeScript files in application code
 *
 * @param rootDir - Project root directory
 * @returns Array of file paths
 */
export function findApplicationFiles(rootDir: string): string[] {
  const patterns = [
    'apps/*/src/**/*.ts',
    'apps/*/src/**/*.tsx',
    'packages/*/src/**/*.ts',
    'packages/*/src/**/*.tsx',
    '!**/*.test.ts',
    '!**/*.test.tsx',
    '!**/*.spec.ts',
    '!**/*.spec.tsx',
    '!**/node_modules/**',
    '!**/dist/**',
    '!**/.next/**',
  ]

  return glob.sync(patterns, { cwd: rootDir, absolute: true })
}

/**
 * Count entity contracts
 *
 * @param rootDir - Project root directory
 * @returns Entity contract statistics
 */
export function countEntityContracts(rootDir: string): CoverageStats['entityContracts'] {
  const entityDir = join(rootDir, 'packages/contracts/src/entities')

  if (!existsSync(entityDir)) {
    return { total: 0, extendingGenerated: 0, standalone: 0 }
  }

  const files = glob.sync('*.ts', { cwd: entityDir, absolute: true })
  let extendingGenerated = 0
  let standalone = 0

  for (const file of files) {
    const content = readFileSync(file, 'utf-8')
    if (content.includes("from '../generated/")) {
      extendingGenerated++
    } else {
      standalone++
    }
  }

  return {
    total: files.length,
    extendingGenerated,
    standalone,
  }
}

/**
 * Generate complete coverage report
 *
 * @param options - Report options
 * @returns Coverage statistics
 *
 * @example
 * ```typescript
 * const stats = await generateReport({ rootDir: process.cwd() })
 * ```
 */
export async function generateReport(
  options: { rootDir?: string; verbose?: boolean } = {},
): Promise<CoverageStats> {
  const { rootDir = process.cwd(), verbose = true } = options

  if (verbose) {
    console.log('📊 Analyzing type coverage...\n')
  }

  const generated = countGenerated(rootDir)
  if (verbose) {
    console.log(
      `✓ Found ${generated.tables} tables, ${generated.totalSchemas} schemas, ${generated.totalContracts} contracts`,
    )
  }

  const files = findApplicationFiles(rootDir)
  if (verbose) {
    console.log(`✓ Scanning ${files.length} application files...`)
  }

  const analyses: FileAnalysis[] = []
  let contractImports = 0
  let schemaImports = 0
  let directDbImports = 0
  let filesUsingValidation = 0
  let filesUsingTypeGuards = 0
  let filesUsingParse = 0
  const anyTypeFiles: string[] = []
  let totalAnyCount = 0

  for (const file of files) {
    const analysis = analyzeFile(file, rootDir)
    analyses.push(analysis)

    if (analysis.importsContracts) contractImports++
    if (analysis.importsSchemas) schemaImports++
    if (analysis.usesValidation) filesUsingValidation++
    if (analysis.usesTypeGuards) filesUsingTypeGuards++
    if (analysis.usesParse) filesUsingParse++

    if (analysis.hasAnyTypes) {
      anyTypeFiles.push(analysis.path)
      totalAnyCount += analysis.anyCount
    }

    const content = readFileSync(file, 'utf-8')
    if (content.includes("from '@revealui/db'") && !analysis.importsContracts) {
      directDbImports++
    }
  }

  const entityContracts = countEntityContracts(rootDir)
  if (verbose) {
    console.log(`✓ Found ${entityContracts.total} entity contracts`)
  }

  return {
    generated,
    usage: {
      contractImports,
      schemaImports,
      directDbImports,
      totalFiles: files.length,
    },
    validation: {
      filesUsingValidation,
      filesUsingTypeGuards,
      filesUsingParse,
    },
    typeAny: {
      count: totalAnyCount,
      files: anyTypeFiles,
    },
    entityContracts,
  }
}

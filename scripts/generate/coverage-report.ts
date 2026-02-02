#!/usr/bin/env tsx
/**
 * Type Coverage Report
 *
 * Tracks contract adoption across the codebase:
 * - Contract usage in application code
 * - Schema validation coverage
 * - Type-safe vs any usage
 * - Entity contract adoption
 *
 * Usage: pnpm types:coverage-report
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import glob from 'fast-glob'

const rootDir = join(import.meta.dirname, '../..')

interface CoverageStats {
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

interface FileAnalysis {
  path: string
  importsContracts: boolean
  importsSchemas: boolean
  usesValidation: boolean
  usesTypeGuards: boolean
  usesParse: boolean
  hasAnyTypes: boolean
  anyCount: number
}

/**
 * Count generated contracts and schemas
 */
function countGenerated(): CoverageStats['generated'] {
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
 */
function analyzeFile(filePath: string): FileAnalysis {
  const content = readFileSync(filePath, 'utf-8')

  return {
    path: filePath.replace(`${rootDir}/`, ''),
    importsContracts:
      content.includes("from '@revealui/contracts/generated'") ||
      content.includes("from '../generated/contracts"),
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
 */
function findApplicationFiles(): string[] {
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
 */
function countEntityContracts(): CoverageStats['entityContracts'] {
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
 * Generate coverage report
 */
async function generateReport(): Promise<CoverageStats> {
  console.log('📊 Analyzing type coverage...\n')

  const generated = countGenerated()
  console.log(
    `✓ Found ${generated.tables} tables, ${generated.totalSchemas} schemas, ${generated.totalContracts} contracts`,
  )

  const files = findApplicationFiles()
  console.log(`✓ Scanning ${files.length} application files...`)

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
    const analysis = analyzeFile(file)
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

  const entityContracts = countEntityContracts()
  console.log(`✓ Found ${entityContracts.total} entity contracts`)

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

/**
 * Display coverage report
 */
function displayReport(stats: CoverageStats): void {
  console.log('\n📊 Type Coverage Report\n')
  console.log('='.repeat(70))

  // Generated contracts
  console.log('\n📦 Generated Contracts:')
  console.log(`  Tables:      ${stats.generated.tables}`)
  console.log(`  Schemas:     ${stats.generated.totalSchemas}`)
  console.log(`  Contracts:   ${stats.generated.totalContracts}`)

  // Usage statistics
  console.log('\n📈 Usage Across Codebase:')
  console.log(`  Total files analyzed:       ${stats.usage.totalFiles}`)
  console.log(
    `  Files importing contracts:  ${stats.usage.contractImports} (${calcPercent(stats.usage.contractImports, stats.usage.totalFiles)}%)`,
  )
  console.log(
    `  Files importing schemas:    ${stats.usage.schemaImports} (${calcPercent(stats.usage.schemaImports, stats.usage.totalFiles)}%)`,
  )
  console.log(`  Direct DB imports:          ${stats.usage.directDbImports}`)

  // Validation usage
  console.log('\n✅ Validation Coverage:')
  console.log(`  Using .validate():  ${stats.validation.filesUsingValidation} files`)
  console.log(`  Using .isType():    ${stats.validation.filesUsingTypeGuards} files`)
  console.log(`  Using .parse():     ${stats.validation.filesUsingParse} files`)

  // Type safety
  console.log('\n🔒 Type Safety:')
  const anyPercent = calcPercent(stats.typeAny.files.length, stats.usage.totalFiles)
  const color = anyPercent > 10 ? '🔴' : anyPercent > 5 ? '🟡' : '🟢'
  console.log(`  Files with 'any' types:  ${color} ${stats.typeAny.files.length} (${anyPercent}%)`)
  console.log(`  Total 'any' occurrences: ${stats.typeAny.count}`)

  if (stats.typeAny.files.length > 0 && stats.typeAny.files.length <= 10) {
    console.log('\n  Top files with any types:')
    for (const file of stats.typeAny.files.slice(0, 10)) {
      console.log(`    - ${file}`)
    }
  }

  // Entity contracts
  console.log('\n📋 Entity Contracts:')
  console.log(`  Total entity contracts:       ${stats.entityContracts.total}`)
  console.log(`  Extending generated:          ${stats.entityContracts.extendingGenerated}`)
  console.log(`  Standalone (manual):          ${stats.entityContracts.standalone}`)

  // Recommendations
  console.log('\n💡 Recommendations:')

  const contractAdoption = calcPercent(stats.usage.contractImports, stats.usage.totalFiles)
  if (contractAdoption < 30) {
    console.log(
      `  ⚠️  Low contract adoption (${contractAdoption}%) - Consider using contracts for validation`,
    )
  }

  if (stats.usage.directDbImports > stats.usage.contractImports) {
    console.log(`  ⚠️  More direct DB imports than contract usage - Add validation layer`)
  }

  if (stats.typeAny.files.length > stats.usage.totalFiles * 0.1) {
    console.log(`  ⚠️  High 'any' type usage (${anyPercent}%) - Replace with proper types`)
  }

  if (stats.entityContracts.standalone > stats.entityContracts.extendingGenerated) {
    console.log(`  ℹ️  Many standalone contracts - Consider extending generated schemas`)
  }

  console.log(`\n${'='.repeat(70)}`)
}

/**
 * Calculate percentage
 */
function calcPercent(value: number, total: number): number {
  if (total === 0) return 0
  return Math.round((value / total) * 100)
}

/**
 * Save report to file
 */
function saveReport(stats: CoverageStats): void {
  const reportFile = join(rootDir, '.type-coverage-report.json')
  const report = {
    timestamp: new Date().toISOString(),
    stats,
  }
  writeFileSync(reportFile, JSON.stringify(report, null, 2))
  console.log(`\n📄 Report saved: ${reportFile}`)
}

/**
 * Generate markdown report
 */
function generateMarkdown(stats: CoverageStats): string {
  let md = `# Type Coverage Report\n\n`
  md += `Generated: ${new Date().toLocaleString()}\n\n`

  md += `## Summary\n\n`
  md += `| Metric | Value |\n`
  md += `|--------|-------|\n`
  md += `| Total Tables | ${stats.generated.tables} |\n`
  md += `| Generated Contracts | ${stats.generated.totalContracts} |\n`
  md += `| Files Analyzed | ${stats.usage.totalFiles} |\n`
  md += `| Contract Adoption | ${calcPercent(stats.usage.contractImports, stats.usage.totalFiles)}% |\n`
  md += `| Files with 'any' Types | ${calcPercent(stats.typeAny.files.length, stats.usage.totalFiles)}% |\n`
  md += `\n`

  md += `## Generated Contracts\n\n`
  md += `- **Tables:** ${stats.generated.tables}\n`
  md += `- **Schemas:** ${stats.generated.totalSchemas} (Select + Insert)\n`
  md += `- **Contracts:** ${stats.generated.totalContracts}\n\n`

  md += `## Usage Statistics\n\n`
  md += `- **Contract imports:** ${stats.usage.contractImports} files (${calcPercent(stats.usage.contractImports, stats.usage.totalFiles)}%)\n`
  md += `- **Schema imports:** ${stats.usage.schemaImports} files (${calcPercent(stats.usage.schemaImports, stats.usage.totalFiles)}%)\n`
  md += `- **Direct DB imports:** ${stats.usage.directDbImports} files\n\n`

  md += `## Validation Coverage\n\n`
  md += `- **Using .validate():** ${stats.validation.filesUsingValidation} files\n`
  md += `- **Using .isType():** ${stats.validation.filesUsingTypeGuards} files\n`
  md += `- **Using .parse():** ${stats.validation.filesUsingParse} files\n\n`

  return md
}

// Main execution
const command = process.argv[2] || 'report'

if (command === 'report' || command === 'analyze') {
  const stats = await generateReport()
  displayReport(stats)
  saveReport(stats)
} else if (command === 'markdown' || command === 'md') {
  const stats = await generateReport()
  const markdown = generateMarkdown(stats)
  const outputFile = join(rootDir, 'docs/TYPE_COVERAGE.md')
  writeFileSync(outputFile, markdown)
  console.log(`\n✅ Markdown report generated: ${outputFile}`)
} else if (command === 'json') {
  const stats = await generateReport()
  console.log(JSON.stringify(stats, null, 2))
} else {
  console.log('Type Coverage Report\n')
  console.log('Usage:')
  console.log('  pnpm types:coverage-report           - Generate and display report')
  console.log('  pnpm types:coverage-report markdown  - Generate markdown report')
  console.log('  pnpm types:coverage-report json      - Output as JSON')
}

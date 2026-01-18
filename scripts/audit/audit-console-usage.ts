#!/usr/bin/env tsx
/**
 * Console Usage Audit Script
 *
 * Scans all files for console usage and categorizes by file type using AST parsing:
 * - Production code (packages/src, apps/src)
 * - Test files (test.ts, spec.ts)
 * - Scripts (scripts directory)
 *
 * Usage:
 *   pnpm tsx scripts/audit/audit-console-usage.ts
 *   pnpm tsx scripts/audit/audit-console-usage.ts --json > console-usage.json
 */

import * as ts from 'typescript'
import { readFileSync, readdirSync } from 'fs'
import { join, relative, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const workspaceRoot = join(__dirname, '../..')

interface ConsoleUsage {
  file: string
  line: number
  column: number
  method: 'log' | 'error' | 'warn' | 'debug' | 'info'
  code: string
  category: 'production' | 'test' | 'script' | 'unknown'
}

interface AuditResult {
  production: ConsoleUsage[]
  test: ConsoleUsage[]
  script: ConsoleUsage[]
  unknown: ConsoleUsage[]
  summary: {
    total: number
    production: number
    test: number
    script: number
    unknown: number
  }
}

const CONSOLE_METHODS = new Set(['log', 'error', 'warn', 'debug', 'info'])

function categorizeFile(filePath: string): 'production' | 'test' | 'script' | 'unknown' {
  const relativePath = relative(workspaceRoot, filePath)

  // Test files
  if (
    relativePath.includes('.test.') ||
    relativePath.includes('.spec.') ||
    relativePath.includes('__tests__') ||
    relativePath.includes('/tests/')
  ) {
    return 'test'
  }

  // Scripts
  if (
    relativePath.startsWith('scripts/') ||
    relativePath.includes('/scripts/') ||
    relativePath.endsWith('.config.ts') ||
    relativePath.endsWith('.config.js')
  ) {
    return 'script'
  }

  // Production code
  if (
    relativePath.includes('/src/') &&
    (relativePath.startsWith('packages/') || relativePath.startsWith('apps/'))
  ) {
    return 'production'
  }

  return 'unknown'
}

/**
 * Recursively traverse AST to find console method calls
 */
function findConsoleCallsInNode(
  node: ts.Node,
  sourceFile: ts.SourceFile,
  usages: ConsoleUsage[],
  filePath: string,
  category: 'production' | 'test' | 'script' | 'unknown',
): void {
  if (ts.isPropertyAccessExpression(node)) {
    const expression = node.expression

    if (ts.isIdentifier(expression) && expression.text === 'console') {
      const methodName = node.name.text

      if (CONSOLE_METHODS.has(methodName)) {
        const parent = node.parent
        if (parent && ts.isCallExpression(parent)) {
          const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart())
          const lineText = sourceFile.getText().split('\n')[line]?.trim() || ''

          usages.push({
            file: relative(workspaceRoot, filePath),
            line: line + 1,
            column: character + 1,
            method: methodName as ConsoleUsage['method'],
            code: lineText.substring(0, 100),
            category,
          })
        }
      }
    }
  }

  ts.forEachChild(node, (child) => {
    findConsoleCallsInNode(child, sourceFile, usages, filePath, category)
  })
}

function findConsoleUsage(filePath: string): ConsoleUsage[] {
  const usages: ConsoleUsage[] = []
  const category = categorizeFile(filePath)

  try {
    const content = readFileSync(filePath, 'utf-8')

    const ext = filePath.split('.').pop()?.toLowerCase()
    const scriptKind =
      ext === 'tsx' || ext === 'jsx'
        ? ts.ScriptKind.TSX
        : ext === 'ts' || ext === 'js'
          ? ts.ScriptKind.TS
          : ts.ScriptKind.Unknown

    const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true, scriptKind)

    findConsoleCallsInNode(sourceFile, sourceFile, usages, filePath, category)
  } catch (error) {
    // Log error but continue processing other files
    console.error(`Error reading file ${filePath}: ${error instanceof Error ? error.message : String(error)}`)
  }

  return usages
}

function scanDirectory(dir: string, extensions: string[] = ['.ts', '.tsx', '.js', '.jsx']): string[] {
  const files: string[] = []

  try {
    const entries = readdirSync(dir, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = join(dir, entry.name)

      // Skip node_modules, dist, .next, build, etc.
      if (
        entry.name.startsWith('.') ||
        entry.name === 'node_modules' ||
        entry.name === 'dist' ||
        entry.name === '.next' ||
        entry.name === 'build' ||
        entry.name === '.turbo' ||
        entry.name === '.cursor'
      ) {
        continue
      }

      if (entry.isDirectory()) {
        files.push(...scanDirectory(fullPath, extensions))
      } else if (entry.isFile()) {
        const ext = entry.name.substring(entry.name.lastIndexOf('.'))
        if (extensions.includes(ext)) {
          files.push(fullPath)
        }
      }
    }
  } catch (error) {
    // Skip directories we can't read
  }

  return files
}

function auditConsoleUsage(): AuditResult {
  console.log('🔍 Scanning for console.* usage...\n')

  // Scan all TypeScript/JavaScript files
  const files = [
    ...scanDirectory(join(workspaceRoot, 'packages')),
    ...scanDirectory(join(workspaceRoot, 'apps')),
    ...scanDirectory(join(workspaceRoot, 'scripts')),
  ]

  console.log(`📁 Found ${files.length} files to scan\n`)

  const allUsages: ConsoleUsage[] = []

  for (const file of files) {
    const usages = findConsoleUsage(file)
    allUsages.push(...usages)
  }

  // Categorize
  const production = allUsages.filter((u) => u.category === 'production')
  const test = allUsages.filter((u) => u.category === 'test')
  const script = allUsages.filter((u) => u.category === 'script')
  const unknown = allUsages.filter((u) => u.category === 'unknown')

  return {
    production,
    test,
    script,
    unknown,
    summary: {
      total: allUsages.length,
      production: production.length,
      test: test.length,
      script: script.length,
      unknown: unknown.length,
    },
  }
}

function printReport(result: AuditResult, outputJson = false): void {
  if (outputJson) {
    console.log(JSON.stringify(result, null, 2))
    return
  }

  console.log('='.repeat(80))
  console.log('Console Usage Audit Report')
  console.log('='.repeat(80))
  console.log()

  console.log('Summary:')
  console.log(`  Total console.* statements: ${result.summary.total}`)
  console.log(`  🔴 Production code: ${result.summary.production} (MUST FIX)`)
  console.log(`  🟡 Test files: ${result.summary.test} (OK)`)
  console.log(`  🟡 Scripts: ${result.summary.script} (OK if dev-only)`)
  console.log(`  ⚠️  Unknown: ${result.summary.unknown}`)
  console.log()

  if (result.production.length > 0) {
    console.log('🔴 PRODUCTION CODE (MUST FIX):')
    console.log('-'.repeat(80))
    result.production.forEach((usage) => {
      console.log(`  ${usage.file}:${usage.line}:${usage.column}`)
      console.log(`    console.${usage.method}()`)
      console.log(`    ${usage.code}`)
      console.log()
    })
  }

  if (result.test.length > 0) {
    console.log('🟡 TEST FILES (OK):')
    console.log(`  ${result.test.length} console.* statements in test files`)
    if (result.test.length <= 10) {
      result.test.forEach((usage) => {
        console.log(`    ${usage.file}:${usage.line}`)
      })
    } else {
      console.log(`    (showing first 10 of ${result.test.length})`)
      result.test.slice(0, 10).forEach((usage) => {
        console.log(`    ${usage.file}:${usage.line}`)
      })
    }
    console.log()
  }

  if (result.script.length > 0) {
    console.log('🟡 SCRIPTS (OK if dev-only):')
    console.log(`  ${result.script.length} console.* statements in scripts`)
    if (result.script.length <= 10) {
      result.script.forEach((usage) => {
        console.log(`    ${usage.file}:${usage.line}`)
      })
    } else {
      console.log(`    (showing first 10 of ${result.script.length})`)
      result.script.slice(0, 10).forEach((usage) => {
        console.log(`    ${usage.file}:${usage.line}`)
      })
    }
    console.log()
  }

  if (result.unknown.length > 0) {
    console.log('⚠️  UNKNOWN CATEGORY:')
    result.unknown.forEach((usage) => {
      console.log(`  ${usage.file}:${usage.line}`)
    })
    console.log()
  }

  console.log('='.repeat(80))
  console.log()

  if (result.summary.production > 0) {
    console.log('❌ ACTION REQUIRED:')
    console.log(`   Found ${result.summary.production} console.* statements in production code.`)
    console.log('   These must be replaced with proper logger.')
    console.log()
    process.exit(1)
  } else {
    console.log('✅ No console.* statements found in production code!')
    console.log()
    process.exit(0)
  }
}

// Main
const outputJson = process.argv.includes('--json')
const result = auditConsoleUsage()
printReport(result, outputJson)
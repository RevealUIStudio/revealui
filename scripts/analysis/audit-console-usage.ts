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

import { readdirSync, readFileSync } from 'fs'
import { dirname, join, relative } from 'path'
import * as ts from 'typescript'
import * as ts from 'typescript'
import { fileURLToPath } from 'url'
import { createLogger, handleASTParseError } from '../shared/utils.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const workspaceRoot = join(__dirname, '../..')
const logger = createLogger()

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
 * Context for AST traversal (caches expensive operations)
 */
interface ConsoleASTContext {
  sourceFile: ts.SourceFile
  lines: string[] // Cached line array to avoid repeated split() calls
}

/**
 * Check if a node is inside a production-safe conditional
 * Looks for patterns like: if (process.env.NODE_ENV !== 'production')
 * or: if (!isProduction) where isProduction is derived from NODE_ENV
 */
function isInsideProductionGuard(node: ts.Node, sourceFile: ts.SourceFile): boolean {
  let current: ts.Node | undefined = node

  // Walk up the AST to find conditional statements
  while (current) {
    if (ts.isIfStatement(current)) {
      const condition = current.expression

      // Check for direct NODE_ENV checks
      if (isNodeEnvProductionCheck(condition)) {
        return true
      }

      // Check for variable references that might be production checks
      if (ts.isIdentifier(condition) || ts.isPropertyAccessExpression(condition)) {
        // Could be extended to track variable assignments
        // For now, just check common patterns
      }

      // Check for logical NOT expressions
      if (
        ts.isPrefixUnaryExpression(condition) &&
        condition.operator === ts.SyntaxKind.ExclamationToken &&
        isNodeEnvProductionCheck(condition.operand)
      ) {
        return true
      }
    }

    current = current.parent
  }

  return false
}

/**
 * Check if an expression is checking NODE_ENV for production
 */
function isNodeEnvProductionCheck(node: ts.Expression): boolean {
  // Check for: process.env.NODE_ENV !== 'production'
  if (ts.isBinaryExpression(node)) {
    const { left, operatorToken, right } = node

    if (
      operatorToken.kind === ts.SyntaxKind.ExclamationEqualsEqualsToken ||
      operatorToken.kind === ts.SyntaxKind.ExclamationEqualsToken
    ) {
      // Check if left side is process.env.NODE_ENV
      if (isProcessEnvNodeEnv(left)) {
        // Check if right side is 'production' literal
        if (ts.isStringLiteral(right) && right.text === 'production') {
          return true
        }
      }

      // Also check reverse: 'production' !== process.env.NODE_ENV
      if (isProcessEnvNodeEnv(right)) {
        if (ts.isStringLiteral(left) && left.text === 'production') {
          return true
        }
      }
    }
  }

  // Check for: process.env.NODE_ENV === 'development'
  if (ts.isBinaryExpression(node)) {
    const { left, operatorToken, right } = node

    if (
      operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken ||
      operatorToken.kind === ts.SyntaxKind.EqualsEqualsToken
    ) {
      if (isProcessEnvNodeEnv(left)) {
        if (ts.isStringLiteral(right) && right.text === 'development') {
          return true
        }
      }
    }
  }

  return false
}

/**
 * Check if expression is process.env.NODE_ENV
 */
function isProcessEnvNodeEnv(node: ts.Expression): boolean {
  if (ts.isPropertyAccessExpression(node)) {
    const { expression, name } = node

    if (ts.isPropertyAccessExpression(expression)) {
      const { expression: envExpr, name: envName } = expression

      if (
        ts.isIdentifier(envExpr) &&
        envExpr.text === 'process' &&
        ts.isIdentifier(envName) &&
        envName.text === 'env' &&
        ts.isIdentifier(name) &&
        name.text === 'NODE_ENV'
      ) {
        return true
      }
    }
  }

  return false
}

/**
 * Check if console method is appropriate for production
 * Error and warn methods are generally acceptable, info/debug/log are not
 */
function isProductionAppropriateConsole(method: string): boolean {
  return method === 'error' // Only error logging is acceptable in production
}

/**
 * Recursively traverse AST to find console method calls
 * Now aware of production-safe conditionals
 */
function findConsoleCallsInNode(
  node: ts.Node,
  context: ConsoleASTContext,
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
          // Check if this console call is inside a production guard
          const isGuarded = isInsideProductionGuard(node, context.sourceFile)

          // For production code, only count unguarded inappropriate calls
          // (calls not inside production guards that aren't error logging)
          if (
            category !== 'production' ||
            (!isGuarded && !isProductionAppropriateConsole(methodName))
          ) {
            const { line, character } = context.sourceFile.getLineAndCharacterOfPosition(
              node.getStart(),
            )
            // Use cached lines array instead of calling getText().split() every time
            const lineText = context.lines[line]?.trim() || ''

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
  }

  ts.forEachChild(node, (child) => {
    findConsoleCallsInNode(child, context, usages, filePath, category)
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

    const sourceFile = ts.createSourceFile(
      filePath,
      content,
      ts.ScriptTarget.Latest,
      true,
      scriptKind,
    )

    // Cache lines array once to avoid repeated split() calls (performance optimization)
    const context: ConsoleASTContext = {
      sourceFile,
      lines: content.split('\n'),
    }

    findConsoleCallsInNode(sourceFile, context, usages, filePath, category)
  } catch (error) {
    // Use standardized error handler (logs warning but allows script to continue)
    handleASTParseError(filePath, error, logger)
  }

  return usages
}

function scanDirectory(
  dir: string,
  extensions: string[] = ['.ts', '.tsx', '.js', '.jsx'],
): string[] {
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

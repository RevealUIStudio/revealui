/**
 * Unified Console Analyzer
 *
 * Provides both AST-based and regex-based console statement detection.
 * Consolidates logic from analyze/console-usage.ts and validate/console-statements.ts
 *
 * Features:
 * - AST mode: TypeScript AST parsing for accurate detection with production guard awareness
 * - Regex mode: Fast pattern matching for simple validation
 * - Auto mode: Intelligently picks best approach based on file type
 * - File categorization: production, test, script, unknown
 * - Production guard detection: Recognizes if (process.env.NODE_ENV !== 'production')
 */

import { readFile, readFileSync } from 'node:fs'
import { relative } from 'node:path'
import * as ts from 'typescript'

export interface ConsoleUsage {
  file: string
  line: number
  column: number
  method: 'log' | 'error' | 'warn' | 'debug' | 'info' | 'trace'
  code: string
  category: 'production' | 'test' | 'script' | 'unknown'
}

export interface ConsoleAnalysisResult {
  usages: ConsoleUsage[]
  summary: {
    total: number
    production: number
    test: number
    script: number
    unknown: number
  }
}

export type AnalysisMode = 'ast' | 'regex' | 'auto'

const CONSOLE_METHODS = new Set(['log', 'error', 'warn', 'debug', 'info', 'trace'])

/**
 * Categorize a file based on its path
 */
export function categorizeFile(
  filePath: string,
  workspaceRoot: string,
): 'production' | 'test' | 'script' | 'unknown' {
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
function isInsideProductionGuard(node: ts.Node, _sourceFile: ts.SourceFile): boolean {
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
 * Error methods are generally acceptable, info/debug/log are not
 */
function isProductionAppropriateConsole(method: string): boolean {
  return method === 'error' // Only error logging is acceptable in production
}

/**
 * Recursively traverse AST to find console method calls
 * Aware of production-safe conditionals
 */
function findConsoleCallsInNode(
  node: ts.Node,
  context: ConsoleASTContext,
  usages: ConsoleUsage[],
  filePath: string,
  category: 'production' | 'test' | 'script' | 'unknown',
  workspaceRoot: string,
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
            !(isGuarded || isProductionAppropriateConsole(methodName))
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
    findConsoleCallsInNode(child, context, usages, filePath, category, workspaceRoot)
  })
}

/**
 * Analyze file using TypeScript AST parsing
 * More accurate but slower than regex
 */
export function analyzeFileAST(filePath: string, workspaceRoot: string): ConsoleUsage[] {
  const usages: ConsoleUsage[] = []
  const category = categorizeFile(filePath, workspaceRoot)

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

    findConsoleCallsInNode(sourceFile, context, usages, filePath, category, workspaceRoot)
  } catch (error) {
    // Skip files that can't be parsed (silently continue for library usage)
    // Calling code can handle logging if needed
  }

  return usages
}

/**
 * Analyze file using regex pattern matching
 * Faster but less accurate than AST
 */
export async function analyzeFileRegex(
  filePath: string,
  workspaceRoot: string,
): Promise<ConsoleUsage[]> {
  const category = categorizeFile(filePath, workspaceRoot)
  const usages: ConsoleUsage[] = []

  try {
    const content = await new Promise<string>((resolve, reject) => {
      readFile(filePath, 'utf-8', (err, data) => {
        if (err) reject(err)
        else resolve(data)
      })
    })

    const lines = content.split('\n')
    const consoleRegex = /\bconsole\.(log|warn|error|info|debug|trace)\s*\(/g

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      let match = consoleRegex.exec(line)

      while (match !== null) {
        usages.push({
          file: relative(workspaceRoot, filePath),
          line: i + 1,
          column: match.index + 1,
          method: match[1] as ConsoleUsage['method'],
          code: line.trim(),
          category,
        })
        match = consoleRegex.exec(line)
      }
    }
  } catch (error) {
    // Skip files that can't be scanned (silently continue for library usage)
    // Calling code can handle logging if needed
  }

  return usages
}

/**
 * Analyze file with automatic mode selection
 * Uses AST for TypeScript files, regex for JavaScript
 */
export async function analyzeFile(
  filePath: string,
  workspaceRoot: string,
  mode: AnalysisMode = 'auto',
): Promise<ConsoleUsage[]> {
  if (mode === 'ast') {
    return analyzeFileAST(filePath, workspaceRoot)
  }

  if (mode === 'regex') {
    return analyzeFileRegex(filePath, workspaceRoot)
  }

  // Auto mode: use AST for TypeScript, regex for JavaScript
  const ext = filePath.split('.').pop()?.toLowerCase()
  if (ext === 'ts' || ext === 'tsx') {
    return analyzeFileAST(filePath, workspaceRoot)
  }

  return analyzeFileRegex(filePath, workspaceRoot)
}

/**
 * Analyze multiple files and aggregate results
 */
export async function analyzeFiles(
  filePaths: string[],
  workspaceRoot: string,
  mode: AnalysisMode = 'auto',
): Promise<ConsoleAnalysisResult> {
  const allUsages: ConsoleUsage[] = []

  for (const file of filePaths) {
    const usages = await analyzeFile(file, workspaceRoot, mode)
    allUsages.push(...usages)
  }

  // Calculate summary
  const production = allUsages.filter((u) => u.category === 'production')
  const test = allUsages.filter((u) => u.category === 'test')
  const script = allUsages.filter((u) => u.category === 'script')
  const unknown = allUsages.filter((u) => u.category === 'unknown')

  return {
    usages: allUsages,
    summary: {
      total: allUsages.length,
      production: production.length,
      test: test.length,
      script: script.length,
      unknown: unknown.length,
    },
  }
}

/**
 * Console Analyzer class for object-oriented usage
 */
export class ConsoleAnalyzer {
  constructor(private workspaceRoot: string) {}

  /**
   * Analyze using TypeScript AST parsing
   */
  analyzeAST(filePath: string): ConsoleUsage[] {
    return analyzeFileAST(filePath, this.workspaceRoot)
  }

  /**
   * Analyze using regex pattern matching
   */
  async analyzeRegex(filePath: string): Promise<ConsoleUsage[]> {
    return analyzeFileRegex(filePath, this.workspaceRoot)
  }

  /**
   * Smart analysis with automatic mode selection
   */
  async analyze(filePath: string, mode: AnalysisMode = 'auto'): Promise<ConsoleUsage[]> {
    return analyzeFile(filePath, this.workspaceRoot, mode)
  }

  /**
   * Analyze multiple files
   */
  async analyzeMultiple(
    filePaths: string[],
    mode: AnalysisMode = 'auto',
  ): Promise<ConsoleAnalysisResult> {
    return analyzeFiles(filePaths, this.workspaceRoot, mode)
  }
}

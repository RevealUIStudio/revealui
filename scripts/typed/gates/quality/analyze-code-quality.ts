#!/usr/bin/env tsx

/**
 * Code quality analysis script
 * Analyzes TODOs, any types, and documentation coverage using AST parsing
 *
 * Usage:
 *   pnpm tsx scripts/analysis/analyze-code-quality.ts
 */

import fg from 'fast-glob'
import fs from 'node:fs/promises'
import path from 'node:path'
import ts from 'typescript'
import { createLogger, getProjectRoot, handleASTParseError } from '../typed/shared/utils.ts'

const logger = createLogger()

// Exported types for testing
export interface AnalysisResult {
  file: string
  todos: number
  anyTypes: number
  jsdocFunctions: number
  totalFunctions: number
}

export interface AnalysisSummary {
  totalFiles: number
  totalTodos: number
  totalAnyTypes: number
  totalJSDocFunctions: number
  totalFunctions: number
  jsdocCoverage: string
  results: AnalysisResult[]
}

interface AnalysisState {
  todos: number
  anyTypes: number
  jsdocFunctions: number
  totalFunctions: number
}

interface ASTContext {
  sourceFile: ts.SourceFile
  fullText: string // Cached full text to avoid repeated getFullText() calls
}

/**
 * Recursively traverse AST to find functions, any types, and JSDoc
 * Performance: Uses cached fullText to avoid repeated getFullText() calls
 */
function analyzeNode(node: ts.Node, context: ASTContext, state: AnalysisState): void {
  // Check for any type usage
  if (ts.isTypeReferenceNode(node)) {
    if (ts.isIdentifier(node.typeName) && node.typeName.text === 'any') {
      state.anyTypes++
    }
  }

  // Check if this is a function declaration or expression
  let isFunction = false
  let functionNode: ts.FunctionLike | null = null

  if (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node)) {
    isFunction = true
    functionNode = node as ts.FunctionLike
  } else if (ts.isMethodDeclaration(node) || ts.isMethodSignature(node)) {
    isFunction = true
    functionNode = node
  } else if (
    ts.isVariableDeclaration(node) &&
    node.initializer &&
    (ts.isFunctionExpression(node.initializer) || ts.isArrowFunction(node.initializer))
  ) {
    isFunction = true
    functionNode = node.initializer
  }

  if (isFunction && functionNode) {
    state.totalFunctions++

    // Check for JSDoc comments using TypeScript's comment API
    // Use cached fullText instead of calling getFullText() again
    const functionLeadingComments =
      ts.getLeadingCommentRanges(context.fullText, functionNode.getFullStart()) || []

    // Check if there's a JSDoc comment before this function
    const hasJSDoc = functionLeadingComments.some((comment) => {
      if (comment.kind === ts.SyntaxKind.MultiLineCommentTrivia) {
        const commentText = context.fullText.substring(comment.pos, comment.end)
        return commentText.startsWith('/**')
      }
      return false
    })

    if (hasJSDoc) {
      state.jsdocFunctions++
    }
  }

  // Recurse into children
  ts.forEachChild(node, (child) => {
    analyzeNode(child, context, state)
  })
}

/**
 * Analyze a single file for code quality metrics
 * Exported for testing
 */
export async function analyzeFile(filePath: string): Promise<AnalysisResult> {
  const content = await fs.readFile(filePath, 'utf-8')
  const lines = content.split('\n')

  // Simple string matching for TODO/FIXME/HACK (case-insensitive)
  const todos = lines.filter((line) => {
    const upperLine = line.toUpperCase()
    return upperLine.includes('TODO') || upperLine.includes('FIXME') || upperLine.includes('HACK')
  }).length

  const state: AnalysisState = {
    todos: 0,
    anyTypes: 0,
    jsdocFunctions: 0,
    totalFunctions: 0,
  }

  try {
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

    // Cache fullText once to avoid repeated getFullText() calls (performance optimization)
    const context: ASTContext = {
      sourceFile,
      fullText: sourceFile.getFullText(),
    }

    analyzeNode(sourceFile, context, state)
  } catch (error) {
    // Use standardized error handler
    handleASTParseError(filePath, error, logger)
  }

  // Use absolute path for consistency (tests can compute relative paths if needed)
  // Return absolute path (can be made relative in runCodeQualityAnalysis for CLI output)
  const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(filePath)

  return {
    file: absolutePath,
    todos,
    anyTypes: state.anyTypes,
    jsdocFunctions: state.jsdocFunctions,
    totalFunctions: state.totalFunctions,
  }
}

/**
 * Run code quality analysis and return summary
 * Returns data structure instead of calling process.exit()
 * Exported for testing
 */
export async function runCodeQualityAnalysis(
  pattern?: string,
  projectRoot?: string,
): Promise<AnalysisSummary> {
  const root = projectRoot || (await getProjectRoot(import.meta.url))
  const globPattern = pattern || 'packages/core/src/**/*.{ts,tsx}'

  const files = await fg(globPattern, {
    ignore: ['**/*.test.ts', '**/*.spec.ts', '**/node_modules/**', '**/dist/**'],
    cwd: root,
  })

  const results: AnalysisResult[] = []
  let totalTodos = 0
  let totalAnyTypes = 0
  let totalJSDocFunctions = 0
  let totalFunctions = 0

  for (const file of files) {
    const fullPath = path.join(root, file)
    const result = await analyzeFile(fullPath)
    // Make file path relative to project root for cleaner output
    results.push({
      ...result,
      file: path.relative(root, result.file),
    })
    totalTodos += result.todos
    totalAnyTypes += result.anyTypes
    totalJSDocFunctions += result.jsdocFunctions
    totalFunctions += result.totalFunctions
  }

  // Sort by priority (todos + anyTypes)
  results.sort((a, b) => b.todos + b.anyTypes - (a.todos + a.anyTypes))

  const jsdocCoverage =
    totalFunctions > 0 ? `${((totalJSDocFunctions / totalFunctions) * 100).toFixed(1)}%` : '0%'

  return {
    totalFiles: results.length,
    totalTodos,
    totalAnyTypes,
    totalJSDocFunctions,
    totalFunctions,
    jsdocCoverage,
    results,
  }
}

/**
 * CLI wrapper that uses logger and writes report file
 */
async function _runAnalysis() {
  try {
    const summary = await runCodeQualityAnalysis()

    logger.header('Code Quality Analysis Report')
    logger.info(`Total Files Analyzed: ${summary.totalFiles}`)
    logger.info(`Total TODOs: ${summary.totalTodos}`)
    logger.info(`Total Any Types: ${summary.totalAnyTypes}`)
    logger.info(`JSDoc Coverage: ${summary.jsdocCoverage}`)
    logger.info('\nTop 20 Files Needing Attention:\n')

    summary.results.slice(0, 20).forEach((result, index) => {
      if (result.todos > 0 || result.anyTypes > 0) {
        logger.info(
          `${index + 1}. ${result.file}\n   TODOs: ${result.todos}, Any Types: ${result.anyTypes}`,
        )
      }
    })

    // Write detailed report
    const reportPath = path.join(process.cwd(), 'CODE-QUALITY-REPORT.json')
    await fs.writeFile(
      reportPath,
      JSON.stringify(
        {
          summary: {
            totalFiles: summary.totalFiles,
            totalTodos: summary.totalTodos,
            totalAnyTypes: summary.totalAnyTypes,
            jsdocCoverage: summary.jsdocCoverage,
          },
          files: summary.results,
        },
        null,
        2,
      ),
      'utf-8',
    )

    logger.success(`\nDetailed report written to: ${reportPath}`)
  } catch (error) {
    logger.error(`Analysis failed: ${error instanceof Error ? error.message : String(error)}`)
    if (error instanceof Error && error.stack) {
      logger.error(`Stack trace: ${error.stack}`)
    }
    process.exit(1)
  }
}

/**
 * Main function wrapper with error handling
 */
async function main() {
  try {
    await _runAnalysis()
  } catch (error) {
    logger.error(`Script failed: ${error instanceof Error ? error.message : String(error)}`)
    if (error instanceof Error && error.stack) {
      logger.error(`Stack trace: ${error.stack}`)
    }
    process.exit(1)
  }
}

main()

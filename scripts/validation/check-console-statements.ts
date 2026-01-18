#!/usr/bin/env tsx

/**
 * Check for console statements in production code using AST parsing
 * Uses TypeScript compiler API for accurate detection without regex
 */

import * as ts from 'typescript'
import { readdir, readFile } from 'node:fs/promises'
import { join, relative, normalize } from 'node:path'
import { createLogger, fileExists, getProjectRoot, handleASTParseError } from '../shared/utils.js'

const logger = createLogger()

// Exported types for testing
export interface ConsoleMatch {
  file: string
  line: number
  content: string
}

export interface CheckConsoleResult {
  success: boolean
  matches: ConsoleMatch[]
}

/**
 * Allowed console method names to detect
 */
const CONSOLE_METHODS = new Set(['log', 'error', 'warn', 'info', 'debug', 'trace', 'table', 'dir', 'assert'])

/**
 * Files that are allowed to use console (logger implementations)
 */
export const ALLOWED_FILES = [
  'packages/core/src/utils/logger.ts',
  'packages/core/src/instance/logger.ts',
]

/**
 * Context for AST traversal (caches expensive operations)
 */
interface ConsoleASTContext {
  sourceFile: ts.SourceFile
  lines: string[] // Cached line array to avoid repeated split() calls
}

/**
 * Recursively traverse AST to find console method calls
 * Performance: Uses cached lines array to avoid repeated split() calls
 */
function findConsoleCallsInNode(
  node: ts.Node,
  context: ConsoleASTContext,
  matches: ConsoleMatch[],
  filePath: string,
): void {
  // Check if this is a property access expression like console.log(...)
  if (ts.isPropertyAccessExpression(node)) {
    const expression = node.expression

    // Early exit if not console identifier
    if (!ts.isIdentifier(expression) || expression.text !== 'console') {
      // Continue traversal
      ts.forEachChild(node, (child) => {
        findConsoleCallsInNode(child, context, matches, filePath)
      })
      return
    }

    const methodName = node.name.text

    // Early exit if not a console method we care about
    if (!CONSOLE_METHODS.has(methodName)) {
      ts.forEachChild(node, (child) => {
        findConsoleCallsInNode(child, context, matches, filePath)
      })
      return
    }

    // Check if parent is a call expression (console.log(), not console.log)
    const parent = node.parent
    if (parent && ts.isCallExpression(parent)) {
      const { line } = context.sourceFile.getLineAndCharacterOfPosition(node.getStart())
      // Use cached lines array instead of splitting getText() every time
      const lineText = context.lines[line]?.trim() || ''

      matches.push({
        file: filePath,
        line: line + 1, // Convert 0-based to 1-based line numbers
        content: lineText,
      })
    }
  }

  // Recursively visit all children
  ts.forEachChild(node, (child) => {
    findConsoleCallsInNode(child, context, matches, filePath)
  })
}

/**
 * Find console statements in a TypeScript/JavaScript file using AST
 * Exported for testing
 */
export async function findConsoleStatementsInFile(filePath: string): Promise<ConsoleMatch[]> {
  const matches: ConsoleMatch[] = []
  
  try {
    const content = await readFile(filePath, 'utf-8')
    
    // Determine file extension to set appropriate script kind
    const ext = filePath.split('.').pop()?.toLowerCase()
    const scriptKind = ext === 'tsx' || ext === 'jsx' 
      ? ts.ScriptKind.TSX 
      : ext === 'ts' || ext === 'js'
        ? ts.ScriptKind.TS
        : ts.ScriptKind.Unknown
    
    // Parse the file into an AST
    const sourceFile = ts.createSourceFile(
      filePath,
      content,
      ts.ScriptTarget.Latest,
      true, // setParentNodes - needed for traversal
      scriptKind,
    )

    // Cache lines array once to avoid repeated split() calls (performance optimization)
    const context: ConsoleASTContext = {
      sourceFile,
      lines: content.split('\n'),
    }

    // Traverse the AST starting from root
    findConsoleCallsInNode(sourceFile, context, matches, filePath)
  } catch (error) {
    // Use standardized error handler
    handleASTParseError(filePath, error, logger)
  }
  
  return matches
}

/**
 * Recursively find all TypeScript/JavaScript files in a directory
 * Exported for testing
 */
export async function findSourceFiles(
  dir: string,
  files: string[] = [],
): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  
  for (const entry of entries) {
    const fullPath = join(dir, entry.name)
    
    // Skip node_modules, dist, .next, __tests__, and other build/test directories
    if (
      entry.name === 'node_modules' ||
      entry.name === 'dist' ||
      entry.name === '.next' ||
      entry.name === '__tests__' ||
      entry.name === 'coverage' ||
      entry.name.startsWith('.')
    ) {
      continue
    }
    
    if (entry.isDirectory()) {
      await findSourceFiles(fullPath, files)
    } else if (entry.isFile()) {
      const ext = entry.name.split('.').pop()?.toLowerCase()
      if (['ts', 'tsx', 'js', 'jsx'].includes(ext || '')) {
        files.push(fullPath)
      }
    }
  }
  
  return files
}

/**
 * Check for console statements across search paths
 * Returns result object instead of calling process.exit()
 * Exported for testing
 */
export async function checkConsoleStatements(
  searchPaths?: string[],
  projectRoot?: string,
): Promise<CheckConsoleResult> {
  const root = projectRoot || (await getProjectRoot(import.meta.url))
  
  const paths = searchPaths || [
    join(root, 'apps/cms/src'),
    join(root, 'apps/web/src'),
    join(root, 'packages/core/src'),
  ]
  
  const allMatches: ConsoleMatch[] = []
  
  // Find all source files
  for (const searchPath of paths) {
    if (await fileExists(searchPath)) {
      const files = await findSourceFiles(searchPath)
      
      // Process each file with AST parsing
      for (const file of files) {
        const fileMatches = await findConsoleStatementsInFile(file)
        allMatches.push(...fileMatches)
      }
    }
  }
  
  // Filter out allowed files
  const filteredMatches = allMatches.filter((match) => {
    // Normalize paths for cross-platform compatibility
    const normalizedFile = normalize(match.file)
    const normalizedRoot = normalize(root)
    const relativePath = relative(normalizedRoot, normalizedFile).replace(/\\/g, '/')
    
    // Check if this file is in the allowed list
    return !ALLOWED_FILES.includes(relativePath)
  })
  
  return {
    success: filteredMatches.length === 0,
    matches: filteredMatches,
  }
}

/**
 * CLI wrapper that uses logger and process.exit()
 */
async function runCheck() {
  logger.info('Checking for console statements in production code...')
  logger.info('')
  
  const result = await checkConsoleStatements()
  
  if (result.success) {
    logger.success('No console statements found in production code')
    process.exit(0)
  }
  
  logger.warning(`Found ${result.matches.length} console statement(s) in production code:`)
  logger.info('')
  
  // Group by file
  const byFile = new Map<string, ConsoleMatch[]>()
  for (const match of result.matches) {
    const existing = byFile.get(match.file) || []
    existing.push(match)
    byFile.set(match.file, existing)
  }
  
  // Show first 3 matches per file
  for (const [file, fileMatches] of byFile.entries()) {
    logger.info(`  - ${file}`)
    for (const match of fileMatches.slice(0, 3)) {
      logger.info(`    ${match.line}: ${match.content}`)
    }
    if (fileMatches.length > 3) {
      logger.info(`    ... and ${fileMatches.length - 3} more`)
    }
  }
  
  logger.info('')
  logger.warning('Recommendation: Remove or replace with proper logging service')
  process.exit(1)
}

/**
 * Main function
 */
async function main() {
  try {
    await runCheck()
  } catch (error) {
    logger.error(`Script failed: ${error instanceof Error ? error.message : String(error)}`)
    if (error instanceof Error && error.stack) {
      logger.error(`Stack trace: ${error.stack}`)
    }
    process.exit(1)
  }
}

main()
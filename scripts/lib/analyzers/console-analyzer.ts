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
 *
 * @dependencies
 * - node:fs - File system operations for reading files
 * - node:path - Path manipulation utilities
 * - typescript - TypeScript compiler API for AST parsing
 */

import { readFile, readFileSync } from 'node:fs';
import { relative } from 'node:path';
import * as ts from 'typescript';

export interface ConsoleUsage {
  file: string;
  line: number;
  column: number;
  method: 'log' | 'error' | 'warn' | 'debug' | 'info' | 'trace';
  code: string;
  category: 'production' | 'test' | 'script' | 'unknown';
}

export interface ConsoleAnalysisResult {
  usages: ConsoleUsage[];
  summary: {
    total: number;
    production: number;
    test: number;
    script: number;
    unknown: number;
  };
}

export type AnalysisMode = 'ast' | 'regex' | 'auto';

const CONSOLE_METHODS = new Set(['log', 'error', 'warn', 'debug', 'info', 'trace']);

/**
 * Categorize a file based on its path to determine the appropriate context
 * for console statement analysis.
 *
 * @param filePath - Absolute path to the file to categorize
 * @param workspaceRoot - Root directory of the workspace/project
 * @returns File category: 'production', 'test', 'script', or 'unknown'
 *
 * @example
 * ```typescript
 * const category = categorizeFile('/app/src/components/Button.tsx', '/app')
 * console.log(category) // 'production'
 *
 * const testCategory = categorizeFile('/app/src/__tests__/Button.test.tsx', '/app')
 * console.log(testCategory) // 'test'
 * ```
 */
export function categorizeFile(
  filePath: string,
  workspaceRoot: string,
): 'production' | 'test' | 'script' | 'unknown' {
  const relativePath = relative(workspaceRoot, filePath);

  // Test files
  if (
    relativePath.includes('.test.') ||
    relativePath.includes('.spec.') ||
    relativePath.includes('__tests__') ||
    relativePath.includes('/tests/')
  ) {
    return 'test';
  }

  // Scripts
  if (
    relativePath.startsWith('scripts/') ||
    relativePath.includes('/scripts/') ||
    relativePath.endsWith('.config.ts') ||
    relativePath.endsWith('.config.js')
  ) {
    return 'script';
  }

  // Production code
  if (
    relativePath.includes('/src/') &&
    (relativePath.startsWith('packages/') || relativePath.startsWith('apps/'))
  ) {
    return 'production';
  }

  return 'unknown';
}

/**
 * Context for AST traversal (caches expensive operations)
 */
interface ConsoleASTContext {
  sourceFile: ts.SourceFile;
  lines: string[]; // Cached line array to avoid repeated split() calls
}

/**
 * Check if a node is inside a production-safe conditional
 * Looks for patterns like: if (process.env.NODE_ENV !== 'production')
 * or: if (!isProduction) where isProduction is derived from NODE_ENV
 */
function isInsideProductionGuard(node: ts.Node, _sourceFile: ts.SourceFile): boolean {
  let current: ts.Node | undefined = node;

  // Walk up the AST to find conditional statements
  while (current) {
    if (ts.isIfStatement(current)) {
      const condition = current.expression;

      // Check for direct NODE_ENV checks
      if (isNodeEnvProductionCheck(condition)) {
        return true;
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
        return true;
      }
    }

    current = current.parent;
  }

  return false;
}

/**
 * Check if an expression is checking NODE_ENV for production
 */
function isNodeEnvProductionCheck(node: ts.Expression): boolean {
  // Check for: process.env.NODE_ENV !== 'production'
  if (ts.isBinaryExpression(node)) {
    const { left, operatorToken, right } = node;

    if (
      operatorToken.kind === ts.SyntaxKind.ExclamationEqualsEqualsToken ||
      operatorToken.kind === ts.SyntaxKind.ExclamationEqualsToken
    ) {
      // Check if left side is process.env.NODE_ENV
      if (isProcessEnvNodeEnv(left)) {
        // Check if right side is 'production' literal
        if (ts.isStringLiteral(right) && right.text === 'production') {
          return true;
        }
      }

      // Also check reverse: 'production' !== process.env.NODE_ENV
      if (isProcessEnvNodeEnv(right)) {
        if (ts.isStringLiteral(left) && left.text === 'production') {
          return true;
        }
      }
    }
  }

  // Check for: process.env.NODE_ENV === 'development'
  if (ts.isBinaryExpression(node)) {
    const { left, operatorToken, right } = node;

    if (
      operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken ||
      operatorToken.kind === ts.SyntaxKind.EqualsEqualsToken
    ) {
      if (isProcessEnvNodeEnv(left)) {
        if (ts.isStringLiteral(right) && right.text === 'development') {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Check if expression is process.env.NODE_ENV
 */
function isProcessEnvNodeEnv(node: ts.Expression): boolean {
  if (ts.isPropertyAccessExpression(node)) {
    const { expression, name } = node;

    if (ts.isPropertyAccessExpression(expression)) {
      const { expression: envExpr, name: envName } = expression;

      if (
        ts.isIdentifier(envExpr) &&
        envExpr.text === 'process' &&
        ts.isIdentifier(envName) &&
        envName.text === 'env' &&
        ts.isIdentifier(name) &&
        name.text === 'NODE_ENV'
      ) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Check if console method is appropriate for production
 * Error methods are generally acceptable, info/debug/log are not
 */
function isProductionAppropriateConsole(method: string): boolean {
  return method === 'error'; // Only error logging is acceptable in production
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
    const expression = node.expression;

    if (ts.isIdentifier(expression) && expression.text === 'console') {
      const methodName = node.name.text;

      if (CONSOLE_METHODS.has(methodName)) {
        const parent = node.parent;
        if (parent && ts.isCallExpression(parent)) {
          // Check if this console call is inside a production guard
          const isGuarded = isInsideProductionGuard(node, context.sourceFile);

          // For production code, only count unguarded inappropriate calls
          // (calls not inside production guards that aren't error logging)
          if (
            category !== 'production' ||
            !(isGuarded || isProductionAppropriateConsole(methodName))
          ) {
            const { line, character } = context.sourceFile.getLineAndCharacterOfPosition(
              node.getStart(),
            );
            // Use cached lines array instead of calling getText().split() every time
            const lineText = context.lines[line]?.trim() || '';

            usages.push({
              file: relative(workspaceRoot, filePath),
              line: line + 1,
              column: character + 1,
              method: methodName as ConsoleUsage['method'],
              code: lineText.substring(0, 100),
              category,
            });
          }
        }
      }
    }
  }

  ts.forEachChild(node, (child) => {
    findConsoleCallsInNode(child, context, usages, filePath, category, workspaceRoot);
  });
}

/**
 * Analyze file using TypeScript AST parsing for accurate console statement detection.
 * More accurate but slower than regex. Detects production guards and appropriate
 * console methods (e.g., console.error is acceptable in production).
 *
 * @param filePath - Absolute path to the file to analyze
 * @param workspaceRoot - Root directory of the workspace/project
 * @returns Array of console usages found in the file
 *
 * @example
 * ```typescript
 * const usages = analyzeFileAST('/app/src/utils/logger.ts', '/app')
 * console.log(`Found ${usages.length} console statements`)
 * usages.forEach(u => console.log(`${u.file}:${u.line} - ${u.method}`))
 * ```
 *
 * @see {@link analyzeFileRegex} for faster regex-based analysis
 * @see {@link analyzeFile} for automatic mode selection
 */
export function analyzeFileAST(filePath: string, workspaceRoot: string): ConsoleUsage[] {
  const usages: ConsoleUsage[] = [];
  const category = categorizeFile(filePath, workspaceRoot);

  try {
    const content = readFileSync(filePath, 'utf-8');

    const ext = filePath.split('.').pop()?.toLowerCase();
    const scriptKind =
      ext === 'tsx' || ext === 'jsx'
        ? ts.ScriptKind.TSX
        : ext === 'ts' || ext === 'js'
          ? ts.ScriptKind.TS
          : ts.ScriptKind.Unknown;

    const sourceFile = ts.createSourceFile(
      filePath,
      content,
      ts.ScriptTarget.Latest,
      true,
      scriptKind,
    );

    // Cache lines array once to avoid repeated split() calls (performance optimization)
    const context: ConsoleASTContext = {
      sourceFile,
      lines: content.split('\n'),
    };

    findConsoleCallsInNode(sourceFile, context, usages, filePath, category, workspaceRoot);
  } catch (_error) {
    // Skip files that can't be parsed (silently continue for library usage)
    // Calling code can handle logging if needed
  }

  return usages;
}

/**
 * Analyze file using regex pattern matching for fast console statement detection.
 * Faster but less accurate than AST - cannot detect production guards or
 * complex conditional logic.
 *
 * @param filePath - Absolute path to the file to analyze
 * @param workspaceRoot - Root directory of the workspace/project
 * @returns Promise resolving to array of console usages found
 *
 * @example
 * ```typescript
 * const usages = await analyzeFileRegex('/app/src/index.js', '/app')
 * console.log(`Found ${usages.length} console statements (regex mode)`)
 * ```
 *
 * @see {@link analyzeFileAST} for more accurate AST-based analysis
 * @see {@link analyzeFile} for automatic mode selection
 */
export async function analyzeFileRegex(
  filePath: string,
  workspaceRoot: string,
): Promise<ConsoleUsage[]> {
  const category = categorizeFile(filePath, workspaceRoot);
  const usages: ConsoleUsage[] = [];

  try {
    const content = await new Promise<string>((resolve, reject) => {
      readFile(filePath, 'utf-8', (err, data) => {
        if (err) reject(err);
        else resolve(data);
      });
    });

    const lines = content.split('\n');
    const consoleRegex = /\bconsole\.(log|warn|error|info|debug|trace)\s*\(/g;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      let match = consoleRegex.exec(line);

      while (match !== null) {
        usages.push({
          file: relative(workspaceRoot, filePath),
          line: i + 1,
          column: match.index + 1,
          method: match[1] as ConsoleUsage['method'],
          code: line.trim(),
          category,
        });
        match = consoleRegex.exec(line);
      }
    }
  } catch (_error) {
    // Skip files that can't be scanned (silently continue for library usage)
    // Calling code can handle logging if needed
  }

  return usages;
}

/**
 * Analyze file with automatic or explicit mode selection.
 * Auto mode intelligently selects AST for TypeScript files and regex for JavaScript.
 *
 * @param filePath - Absolute path to the file to analyze
 * @param workspaceRoot - Root directory of the workspace/project
 * @param mode - Analysis mode: 'auto' (default), 'ast', or 'regex'
 * @returns Promise resolving to array of console usages found
 *
 * @example
 * ```typescript
 * // Auto mode - picks best approach
 * const usages = await analyzeFile('/app/src/components/Button.tsx', '/app')
 *
 * // Force AST mode
 * const astUsages = await analyzeFile('/app/src/index.js', '/app', 'ast')
 *
 * // Force regex mode for speed
 * const regexUsages = await analyzeFile('/app/src/utils.ts', '/app', 'regex')
 * ```
 *
 * @see {@link analyzeFiles} to analyze multiple files at once
 */
export async function analyzeFile(
  filePath: string,
  workspaceRoot: string,
  mode: AnalysisMode = 'auto',
): Promise<ConsoleUsage[]> {
  if (mode === 'ast') {
    return analyzeFileAST(filePath, workspaceRoot);
  }

  if (mode === 'regex') {
    return analyzeFileRegex(filePath, workspaceRoot);
  }

  // Auto mode: use AST for TypeScript, regex for JavaScript
  const ext = filePath.split('.').pop()?.toLowerCase();
  if (ext === 'ts' || ext === 'tsx') {
    return analyzeFileAST(filePath, workspaceRoot);
  }

  return analyzeFileRegex(filePath, workspaceRoot);
}

/**
 * Analyze multiple files and aggregate results with categorized summary.
 * Provides comprehensive analysis across many files with performance optimization.
 *
 * @param filePaths - Array of absolute file paths to analyze
 * @param workspaceRoot - Root directory of the workspace/project
 * @param mode - Analysis mode: 'auto' (default), 'ast', or 'regex'
 * @returns Promise resolving to analysis result with usages and summary statistics
 *
 * @example
 * ```typescript
 * const files = await scanDirectoryAll('./src', { extensions: ['.ts', '.tsx'] })
 * const result = await analyzeFiles(files, process.cwd())
 *
 * console.log(`Total console statements: ${result.summary.total}`)
 * console.log(`Production issues: ${result.summary.production}`)
 * console.log(`Test files: ${result.summary.test}`)
 *
 * result.usages.forEach(usage => {
 *   console.log(`${usage.file}:${usage.line} - ${usage.method} (${usage.category})`)
 * })
 * ```
 */
export async function analyzeFiles(
  filePaths: string[],
  workspaceRoot: string,
  mode: AnalysisMode = 'auto',
): Promise<ConsoleAnalysisResult> {
  const allUsages: ConsoleUsage[] = [];

  for (const file of filePaths) {
    const usages = await analyzeFile(file, workspaceRoot, mode);
    allUsages.push(...usages);
  }

  // Calculate summary
  const production = allUsages.filter((u) => u.category === 'production');
  const test = allUsages.filter((u) => u.category === 'test');
  const script = allUsages.filter((u) => u.category === 'script');
  const unknown = allUsages.filter((u) => u.category === 'unknown');

  return {
    usages: allUsages,
    summary: {
      total: allUsages.length,
      production: production.length,
      test: test.length,
      script: script.length,
      unknown: unknown.length,
    },
  };
}

/**
 * Console Analyzer class for object-oriented usage.
 * Provides a convenient API for analyzing console statements across a project.
 *
 * @example
 * ```typescript
 * const analyzer = new ConsoleAnalyzer('/path/to/project')
 *
 * // Analyze single file
 * const usages = await analyzer.analyze('src/app.ts')
 *
 * // Analyze multiple files with summary
 * const files = await scanDirectoryAll('./src', { extensions: ['.ts'] })
 * const result = await analyzer.analyzeMultiple(files, 'auto')
 * console.log(`Found ${result.summary.total} console statements`)
 * ```
 */
export class ConsoleAnalyzer {
  /**
   * Create a new ConsoleAnalyzer instance.
   *
   * @param workspaceRoot - Root directory of the workspace/project
   */
  constructor(private workspaceRoot: string) {}

  /**
   * Analyze file using TypeScript AST parsing.
   *
   * @param filePath - Absolute path to file to analyze
   * @returns Array of console usages found
   */
  analyzeAST(filePath: string): ConsoleUsage[] {
    return analyzeFileAST(filePath, this.workspaceRoot);
  }

  /**
   * Analyze using regex pattern matching
   */
  async analyzeRegex(filePath: string): Promise<ConsoleUsage[]> {
    return analyzeFileRegex(filePath, this.workspaceRoot);
  }

  /**
   * Smart analysis with automatic mode selection
   */
  async analyze(filePath: string, mode: AnalysisMode = 'auto'): Promise<ConsoleUsage[]> {
    return analyzeFile(filePath, this.workspaceRoot, mode);
  }

  /**
   * Analyze multiple files
   */
  async analyzeMultiple(
    filePaths: string[],
    mode: AnalysisMode = 'auto',
  ): Promise<ConsoleAnalysisResult> {
    return analyzeFiles(filePaths, this.workspaceRoot, mode);
  }
}

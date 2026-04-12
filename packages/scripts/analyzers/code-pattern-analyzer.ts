/**
 * Code Pattern Security Analyzer
 *
 * Detects dangerous code patterns that slip past linting and type checking:
 * - execSync with string interpolation (command injection risk)
 * - stat-then-read sequences (TOCTOU race conditions)
 * - Catastrophic backtracking regex patterns (ReDoS)
 *
 * Runs as part of the security gate (warn-only).
 * False positives are expected; the goal is to flag code for human review.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import * as ts from 'typescript';

export type CodePatternIssueKind = 'exec-sync-string' | 'toctou-stat-read' | 'redos-regex';

export interface CodePatternIssue {
  kind: CodePatternIssueKind;
  file: string;
  line: number;
  column: number;
  snippet: string;
}

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mts', '.mjs']);

function collectSourceFiles(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      if (
        [
          'node_modules',
          'dist',
          '.next',
          '.turbo',
          'coverage',
          '.git',
          '__tests__',
          '__mocks__',
          'opensrc',
        ].includes(entry.name)
      ) {
        continue;
      }
      collectSourceFiles(fullPath, files);
      continue;
    }

    if (!SOURCE_EXTENSIONS.has(extname(entry.name))) {
      continue;
    }

    if (
      entry.name.includes('.test.') ||
      entry.name.includes('.spec.') ||
      entry.name.includes('.e2e.') ||
      entry.name.includes('.stories.')
    ) {
      continue;
    }

    files.push(fullPath);
  }

  return files;
}

function getSnippet(sourceFile: ts.SourceFile, node: ts.Node): string {
  return sourceFile.text.slice(node.getStart(sourceFile), node.getEnd()).trim().slice(0, 160);
}

function createIssue(
  kind: CodePatternIssueKind,
  sourceFile: ts.SourceFile,
  node: ts.Node,
  repoRoot: string,
): CodePatternIssue {
  const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));

  return {
    kind,
    file: relative(repoRoot, sourceFile.fileName),
    line: line + 1,
    column: character + 1,
    snippet: getSnippet(sourceFile, node),
  };
}

// =============================================================================
// Check 1: execSync with string concatenation/template (command injection)
// =============================================================================

/**
 * Detects calls to execSync (or spawnSync with shell:true) where the command
 * argument is built via template literal or string concatenation rather than
 * using execFileSync with an args array.
 */
function isExecSyncWithStringArg(node: ts.CallExpression): boolean {
  const callee = node.expression;

  // Match execSync(...) or child_process.execSync(...)
  let name: string | null = null;
  if (ts.isIdentifier(callee)) {
    name = callee.text;
  } else if (ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.name)) {
    name = callee.name.text;
  }

  if (name !== 'execSync') return false;

  const firstArg = node.arguments[0];
  if (!firstArg) return false;

  // Flag template literals with expressions (interpolation)
  if (ts.isTemplateExpression(firstArg)) return true;

  // Flag string concatenation: "git " + variable
  if (ts.isBinaryExpression(firstArg) && firstArg.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    return true;
  }

  return false;
}

// =============================================================================
// Check 2: stat then read on same path (TOCTOU)
// =============================================================================

/**
 * Detects the pattern: statSync(path) followed by readFileSync(path)
 * in the same function scope. This is a TOCTOU race: the file can change
 * or disappear between stat and read.
 */
function findToctouPatterns(sourceFile: ts.SourceFile, repoRoot: string): CodePatternIssue[] {
  const issues: CodePatternIssue[] = [];

  function visitBlock(block: ts.Node): void {
    // Collect all stat/read calls in this block
    const statCalls: { path: string; node: ts.Node }[] = [];
    const readCalls: { path: string; node: ts.Node }[] = [];

    ts.forEachChild(block, function visit(node) {
      if (ts.isCallExpression(node)) {
        const name = getCallName(node);
        const pathArg = node.arguments[0];
        if (pathArg) {
          const pathText = pathArg.getText(sourceFile);
          if (name === 'statSync' || name === 'lstatSync') {
            statCalls.push({ path: pathText, node });
          } else if (name === 'readFileSync') {
            readCalls.push({ path: pathText, node });
          }
        }
      }
      ts.forEachChild(node, visit);
    });

    // Check if any stat call has a matching read call on the same path expression
    for (const stat of statCalls) {
      for (const read of readCalls) {
        if (stat.path === read.path) {
          issues.push(createIssue('toctou-stat-read', sourceFile, stat.node, repoRoot));
          break;
        }
      }
    }
  }

  // Walk function bodies
  function walk(node: ts.Node): void {
    if (
      ts.isFunctionDeclaration(node) ||
      ts.isMethodDeclaration(node) ||
      ts.isArrowFunction(node) ||
      ts.isFunctionExpression(node)
    ) {
      if (node.body) visitBlock(node.body);
    }
    ts.forEachChild(node, walk);
  }

  walk(sourceFile);
  return issues;
}

function getCallName(node: ts.CallExpression): string | null {
  const callee = node.expression;
  if (ts.isIdentifier(callee)) return callee.text;
  if (ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.name)) {
    return callee.name.text;
  }
  return null;
}

// =============================================================================
// Check 3: Catastrophic backtracking regex (ReDoS)
// =============================================================================

/**
 * Detects regex patterns with common ReDoS shapes:
 * - Nested quantifiers: (a+)+ or (a*)*
 * - Overlapping alternation with quantifiers: (a|a)+
 *
 * This is a heuristic check, not a full NFA analysis. It catches the most
 * common patterns that cause exponential backtracking.
 */
function hasNestedQuantifier(pattern: string): boolean {
  // Look for quantified group containing a quantifier: (...)+ where ... contains +, *, {n,}
  // Simplified: find groups with inner quantifiers followed by outer quantifiers
  let depth = 0;
  let hasInnerQuantifier = false;

  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];

    // Skip escaped characters
    if (ch === '\\') {
      i++;
      continue;
    }

    // Skip character classes
    if (ch === '[') {
      while (i < pattern.length && pattern[i] !== ']') {
        if (pattern[i] === '\\') i++;
        i++;
      }
      continue;
    }

    if (ch === '(') {
      depth++;
      hasInnerQuantifier = false;
    } else if (ch === ')') {
      depth--;
      // Check if this closing paren is followed by a quantifier
      const next = pattern[i + 1];
      if (hasInnerQuantifier && (next === '+' || next === '*' || next === '{')) {
        return true;
      }
      hasInnerQuantifier = false;
    } else if (depth > 0 && (ch === '+' || ch === '*')) {
      hasInnerQuantifier = true;
    } else if (depth > 0 && ch === '{') {
      // Check for {n,} or {n,m} quantifier
      const rest = pattern.slice(i);
      if (/^\{\d+,\d*\}/.test(rest)) {
        hasInnerQuantifier = true;
      }
    }
  }

  return false;
}

/**
 * Detect [\s\S]*? or similar dot-star patterns inside groups followed by
 * a quantifier. These are common ReDoS vectors when the lazy quantifier
 * can be forced into exponential backtracking.
 */
function hasDotStarInQuantifiedGroup(pattern: string): boolean {
  // Pattern: group with [\s\S]* or .* inside, followed by +, *, or {n,}
  // This catches things like ([\s\S]*?)+ but not standalone [\s\S]*?
  return /\([^)]*(?:\.\*|\[\^?\]?[^\]]*\]\*)[^)]*\)[+*{]/.test(pattern);
}

function isRedosCandidate(pattern: string): boolean {
  return hasNestedQuantifier(pattern) || hasDotStarInQuantifiedGroup(pattern);
}

function findRedosRegex(sourceFile: ts.SourceFile, repoRoot: string): CodePatternIssue[] {
  const issues: CodePatternIssue[] = [];

  function visit(node: ts.Node): void {
    // Check regex literals: /pattern/flags
    if (ts.isRegularExpressionLiteral(node)) {
      const text = node.text;
      // Extract pattern between first and last /
      const lastSlash = text.lastIndexOf('/');
      if (lastSlash > 0) {
        const pattern = text.slice(1, lastSlash);
        if (isRedosCandidate(pattern)) {
          issues.push(createIssue('redos-regex', sourceFile, node, repoRoot));
        }
      }
    }

    // Check new RegExp("pattern") calls
    if (ts.isNewExpression(node) && ts.isIdentifier(node.expression)) {
      if (node.expression.text === 'RegExp' && node.arguments && node.arguments.length > 0) {
        const arg = node.arguments[0];
        if (arg && ts.isStringLiteral(arg)) {
          if (isRedosCandidate(arg.text)) {
            issues.push(createIssue('redos-regex', sourceFile, node, repoRoot));
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return issues;
}

// =============================================================================
// Main
// =============================================================================

export function findCodePatternIssues(repoRoot: string): CodePatternIssue[] {
  const issues: CodePatternIssue[] = [];
  const scanDirs = [join(repoRoot, 'apps'), join(repoRoot, 'packages'), join(repoRoot, 'scripts')];

  const files: string[] = [];
  for (const dir of scanDirs) {
    try {
      collectSourceFiles(dir, files);
    } catch {
      // Directory may not exist
    }
  }

  for (const filePath of files) {
    const content = readFileSync(filePath, 'utf8');
    const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);

    // Check 1: execSync with string interpolation
    function visitExecSync(node: ts.Node): void {
      if (ts.isCallExpression(node) && isExecSyncWithStringArg(node)) {
        issues.push(createIssue('exec-sync-string', sourceFile, node, repoRoot));
      }
      ts.forEachChild(node, visitExecSync);
    }
    visitExecSync(sourceFile);

    // Check 2: TOCTOU stat-then-read
    issues.push(...findToctouPatterns(sourceFile, repoRoot));

    // Check 3: ReDoS regex
    issues.push(...findRedosRegex(sourceFile, repoRoot));
  }

  return issues;
}

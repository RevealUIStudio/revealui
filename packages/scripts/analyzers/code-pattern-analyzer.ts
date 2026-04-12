/**
 * Code Pattern Security Analyzer
 *
 * Detects dangerous code patterns that slip past linting and type checking:
 * - execSync with string interpolation (command injection risk)
 * - stat-then-read sequences (TOCTOU race conditions)
 * - Catastrophic backtracking regex patterns (ReDoS)
 *
 * Uses typed schemas from @revealui/contracts/security for regex AST analysis
 * and rule definitions. Detection logic produces SecurityFinding objects that
 * pair a typed rule with a source location.
 *
 * Runs as part of the security gate (warn-only).
 */

import { readdirSync, readFileSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import type {
  RetGroup,
  RetRoot,
  RetToken,
  SecurityFinding,
  SecurityRuleId,
} from '@revealui/contracts/security';
import { RetNodeType, SECURITY_RULES } from '@revealui/contracts/security';
// ret parser (runtime only, not in contracts)
import * as retModule from 'ret';
import * as ts from 'typescript';

// ret exports a callable function via CJS default; cast through unknown for ESM compat
const retParse = (retModule as unknown as { default: (p: string) => unknown }).default ?? retModule;

// =============================================================================
// Types (derived from contracts)
// =============================================================================

export type CodePatternIssueKind = SecurityRuleId;

export interface CodePatternIssue {
  kind: CodePatternIssueKind;
  file: string;
  line: number;
  column: number;
  snippet: string;
}

/** Convert a CodePatternIssue to a typed SecurityFinding from contracts. */
export function toSecurityFinding(issue: CodePatternIssue): SecurityFinding {
  return {
    rule: SECURITY_RULES[issue.kind],
    location: {
      file: issue.file,
      line: issue.line,
      column: issue.column,
      snippet: issue.snippet,
    },
  };
}

// =============================================================================
// File Collection
// =============================================================================

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

function isExecSyncWithStringArg(node: ts.CallExpression): boolean {
  const callee = node.expression;

  let name: string | null = null;
  if (ts.isIdentifier(callee)) {
    name = callee.text;
  } else if (ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.name)) {
    name = callee.name.text;
  }

  if (name !== 'execSync') return false;

  const firstArg = node.arguments[0];
  if (!firstArg) return false;

  if (ts.isTemplateExpression(firstArg)) return true;
  if (ts.isBinaryExpression(firstArg) && firstArg.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    return true;
  }

  return false;
}

// =============================================================================
// Check 2: stat then read on same path (TOCTOU)
// =============================================================================

function findToctouPatterns(sourceFile: ts.SourceFile, repoRoot: string): CodePatternIssue[] {
  const issues: CodePatternIssue[] = [];

  function visitBlock(block: ts.Node): void {
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

    for (const stat of statCalls) {
      for (const read of readCalls) {
        if (stat.path === read.path) {
          issues.push(createIssue('toctou-stat-read', sourceFile, stat.node, repoRoot));
          break;
        }
      }
    }
  }

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
//
// Uses `ret` to parse regex patterns into a typed AST (RetRoot/RetToken from
// @revealui/contracts/security), then checks for nested quantifiers whose
// outer body has overlapping tail/start character sets.
// =============================================================================

type CharSet = Set<number> | 'any';

/** Collect character codes a node can match as its first character. */
function firstChars(node: RetToken | RetRoot): CharSet {
  switch (node.type) {
    case RetNodeType.CHAR:
      return new Set([node.value]);

    case RetNodeType.RANGE: {
      if (node.to - node.from > 256) return 'any';
      const s = new Set<number>();
      for (let c = node.from; c <= node.to; c++) s.add(c);
      return s;
    }

    case RetNodeType.SET: {
      if (node.not) return 'any';
      const s = new Set<number>();
      for (const member of node.set) {
        const mc = firstChars(member as RetToken);
        if (mc === 'any') return 'any';
        for (const c of mc) s.add(c);
      }
      return s;
    }

    case RetNodeType.GROUP: {
      if (node.options) {
        const s = new Set<number>();
        for (const branch of node.options) {
          if (branch.length > 0) {
            const bc = firstChars(branch[0]!);
            if (bc === 'any') return 'any';
            for (const c of bc) s.add(c);
          }
        }
        return s;
      }
      if (node.stack && node.stack.length > 0) {
        return firstChars(node.stack[0]!);
      }
      return new Set();
    }

    case RetNodeType.REPETITION:
      return firstChars(node.value);

    case RetNodeType.ROOT: {
      if (node.stack && node.stack.length > 0) return firstChars(node.stack[0]!);
      if (node.options) {
        const s = new Set<number>();
        for (const branch of node.options) {
          if (branch.length > 0) {
            const bc = firstChars(branch[0]!);
            if (bc === 'any') return 'any';
            for (const c of bc) s.add(c);
          }
        }
        return s;
      }
      return new Set();
    }

    default:
      return 'any';
  }
}

/** Collect the last matchable characters from a node. */
function lastChars(node: RetToken | RetRoot): CharSet {
  switch (node.type) {
    case RetNodeType.CHAR:
      return new Set([node.value]);

    case RetNodeType.RANGE: {
      if (node.to - node.from > 256) return 'any';
      const s = new Set<number>();
      for (let c = node.from; c <= node.to; c++) s.add(c);
      return s;
    }

    case RetNodeType.SET: {
      if (node.not) return 'any';
      const s = new Set<number>();
      for (const member of node.set) {
        const mc = lastChars(member as RetToken);
        if (mc === 'any') return 'any';
        for (const c of mc) s.add(c);
      }
      return s;
    }

    case RetNodeType.GROUP:
    case RetNodeType.ROOT: {
      if (node.options) {
        const s = new Set<number>();
        for (const branch of node.options) {
          if (branch.length > 0) {
            const bc = lastChars(branch[branch.length - 1]!);
            if (bc === 'any') return 'any';
            for (const c of bc) s.add(c);
          }
        }
        return s;
      }
      if (node.stack && node.stack.length > 0) {
        return lastChars(node.stack[node.stack.length - 1]!);
      }
      return new Set();
    }

    case RetNodeType.REPETITION:
      return lastChars(node.value);

    default:
      return 'any';
  }
}

function setsOverlap(a: CharSet, b: CharSet): boolean {
  if (a === 'any' || b === 'any') return true;
  for (const c of a) {
    if (b.has(c)) return true;
  }
  return false;
}

/** Check if a subtree contains any unbounded repetition. */
function containsRepetition(node: RetToken | RetRoot): boolean {
  if (node.type === RetNodeType.REPETITION) {
    if (node.max > 1) return true;
    return containsRepetition(node.value);
  }

  const children = (node as RetGroup | RetRoot).stack;
  if (children) {
    for (const child of children) {
      if (containsRepetition(child)) return true;
    }
  }

  const branches = (node as RetGroup | RetRoot).options;
  if (branches) {
    for (const branch of branches) {
      for (const child of branch) {
        if (containsRepetition(child)) return true;
      }
    }
  }

  return false;
}

/**
 * Walk the regex AST looking for nested quantifiers with overlapping character
 * sets. For `(body)*` to cause exponential backtracking, TWO conditions must hold:
 * 1. The body contains another unbounded repetition (star-height > 1)
 * 2. The OUTER body's tail overlaps with its start, allowing the engine to
 *    split the same input between iterations multiple ways
 */
function hasVulnerableNesting(node: RetToken | RetRoot): boolean {
  if (node.type === RetNodeType.REPETITION) {
    const body = node.value;
    const isUnbounded = node.max > 1;

    if (isUnbounded && containsRepetition(body)) {
      const tail = lastChars(body);
      const start = firstChars(body);
      if (setsOverlap(tail, start)) {
        return true;
      }
    }

    return hasVulnerableNesting(body);
  }

  const children = (node as RetGroup | RetRoot).stack;
  if (children) {
    for (const child of children) {
      if (hasVulnerableNesting(child)) return true;
    }
  }

  const branches = (node as RetGroup | RetRoot).options;
  if (branches) {
    for (const branch of branches) {
      for (const child of branch) {
        if (hasVulnerableNesting(child)) return true;
      }
    }
  }

  return false;
}

function isRedosCandidate(pattern: string): boolean {
  try {
    const ast = retParse(pattern) as RetRoot;
    return hasVulnerableNesting(ast);
  } catch {
    return false;
  }
}

function findRedosRegex(sourceFile: ts.SourceFile, repoRoot: string): CodePatternIssue[] {
  const issues: CodePatternIssue[] = [];

  function visit(node: ts.Node): void {
    if (ts.isRegularExpressionLiteral(node)) {
      const text = node.text;
      const lastSlash = text.lastIndexOf('/');
      if (lastSlash > 0) {
        const pattern = text.slice(1, lastSlash);
        if (isRedosCandidate(pattern)) {
          issues.push(createIssue('redos-regex', sourceFile, node, repoRoot));
        }
      }
    }

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

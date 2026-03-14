/**
 * Auth Pattern Analyzer
 *
 * AST-based analysis for auth/security code smells that are too noisy for regex.
 * Intended for warning-level security gate checks, not full taint analysis.
 *
 * Current checks:
 * - hardcoded JWT secret string literals
 * - weak password length requirements (< 8)
 * - plaintext password assignment from request/user objects
 */

import { readdirSync, readFileSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import * as ts from 'typescript';

export type AuthPatternKind =
  | 'hardcoded-jwt-secret'
  | 'weak-password-requirement'
  | 'plaintext-password-storage';

export interface AuthPatternIssue {
  kind: AuthPatternKind;
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

function getPropertyNameText(name: ts.PropertyName | ts.BindingName): string | null {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }

  return null;
}

function getSnippet(sourceFile: ts.SourceFile, node: ts.Node): string {
  return sourceFile.text.slice(node.getStart(sourceFile), node.getEnd()).trim().slice(0, 160);
}

function createIssue(
  kind: AuthPatternKind,
  sourceFile: ts.SourceFile,
  node: ts.Node,
  repoRoot: string,
): AuthPatternIssue {
  const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));

  return {
    kind,
    file: relative(repoRoot, sourceFile.fileName),
    line: line + 1,
    column: character + 1,
    snippet: getSnippet(sourceFile, node),
  };
}

function expressionMentionsPasswordLength(expression: ts.Expression): boolean {
  if (ts.isPropertyAccessExpression(expression)) {
    const text = expression.getText();
    return text.includes('password') && text.includes('length');
  }

  return false;
}

function isWeakPasswordLengthCheck(node: ts.BinaryExpression): boolean {
  const leftNumber = ts.isNumericLiteral(node.left) ? Number(node.left.text) : null;
  const rightNumber = ts.isNumericLiteral(node.right) ? Number(node.right.text) : null;

  switch (node.operatorToken.kind) {
    case ts.SyntaxKind.LessThanToken:
      return (
        (expressionMentionsPasswordLength(node.left) && rightNumber !== null && rightNumber < 8) ||
        (leftNumber !== null && leftNumber < 8 && expressionMentionsPasswordLength(node.right))
      );
    case ts.SyntaxKind.LessThanEqualsToken:
      return (
        (expressionMentionsPasswordLength(node.left) && rightNumber !== null && rightNumber <= 7) ||
        (leftNumber !== null && leftNumber <= 7 && expressionMentionsPasswordLength(node.right))
      );
    case ts.SyntaxKind.GreaterThanToken:
      return (
        (expressionMentionsPasswordLength(node.right) && leftNumber !== null && leftNumber < 8) ||
        (rightNumber !== null && rightNumber < 8 && expressionMentionsPasswordLength(node.left))
      );
    case ts.SyntaxKind.GreaterThanEqualsToken:
      return (
        (expressionMentionsPasswordLength(node.right) && leftNumber !== null && leftNumber <= 7) ||
        (rightNumber !== null && rightNumber <= 7 && expressionMentionsPasswordLength(node.left))
      );
    default:
      return false;
  }
}

function isReqBodyExpression(node: ts.Expression): boolean {
  return (
    ts.isPropertyAccessExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === 'req' &&
    node.name.text === 'body'
  );
}

function isSuspiciousPasswordSource(node: ts.Expression): boolean {
  if (isReqBodyExpression(node)) {
    return true;
  }

  if (ts.isPropertyAccessExpression(node)) {
    if (isReqBodyExpression(node.expression) && node.name.text === 'password') {
      return true;
    }

    if (
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'user' &&
      node.name.text === 'password'
    ) {
      return true;
    }
  }

  return false;
}

function isPasswordTargetName(name: string | null): boolean {
  return name === 'password';
}

function analyzeSourceFile(sourceFile: ts.SourceFile, repoRoot: string): AuthPatternIssue[] {
  const issues: AuthPatternIssue[] = [];

  function visit(node: ts.Node): void {
    if (ts.isVariableDeclaration(node)) {
      const variableName = getPropertyNameText(node.name);
      const initializer = node.initializer;

      if (
        initializer &&
        isPasswordTargetName(variableName) &&
        isSuspiciousPasswordSource(initializer)
      ) {
        issues.push(createIssue('plaintext-password-storage', sourceFile, node, repoRoot));
      }

      if (
        initializer &&
        variableName &&
        variableName.toLowerCase().includes('jwt') &&
        variableName.toLowerCase().includes('secret') &&
        (ts.isStringLiteral(initializer) || ts.isNoSubstitutionTemplateLiteral(initializer))
      ) {
        issues.push(createIssue('hardcoded-jwt-secret', sourceFile, node, repoRoot));
      }
    }

    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
      const leftName = ts.isIdentifier(node.left)
        ? node.left.text
        : ts.isPropertyAccessExpression(node.left)
          ? node.left.name.text
          : null;

      if (isPasswordTargetName(leftName) && isSuspiciousPasswordSource(node.right)) {
        issues.push(createIssue('plaintext-password-storage', sourceFile, node, repoRoot));
      }

      if (isWeakPasswordLengthCheck(node)) {
        issues.push(createIssue('weak-password-requirement', sourceFile, node, repoRoot));
      }
    }

    if (ts.isPropertyAssignment(node)) {
      const propertyName = getPropertyNameText(node.name);
      const initializer = node.initializer;

      if (isPasswordTargetName(propertyName) && isSuspiciousPasswordSource(initializer)) {
        issues.push(createIssue('plaintext-password-storage', sourceFile, node, repoRoot));
      }

      if (
        propertyName?.toLowerCase().includes('jwt') &&
        propertyName.toLowerCase().includes('secret') &&
        (ts.isStringLiteral(initializer) || ts.isNoSubstitutionTemplateLiteral(initializer))
      ) {
        issues.push(createIssue('hardcoded-jwt-secret', sourceFile, node, repoRoot));
      }
    }

    if (ts.isBinaryExpression(node) && isWeakPasswordLengthCheck(node)) {
      issues.push(createIssue('weak-password-requirement', sourceFile, node, repoRoot));
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return issues;
}

export function analyzeAuthPatternsAST(projectRoot: string): AuthPatternIssue[] {
  const files = [
    ...collectSourceFiles(join(projectRoot, 'packages')),
    ...collectSourceFiles(join(projectRoot, 'apps')),
  ];

  const issues: AuthPatternIssue[] = [];

  for (const file of files) {
    const content = readFileSync(file, 'utf8');
    const sourceFile = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true);
    issues.push(...analyzeSourceFile(sourceFile, projectRoot));
  }

  return issues;
}

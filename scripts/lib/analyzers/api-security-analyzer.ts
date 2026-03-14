/**
 * API Security Analyzer
 *
 * AST-based analysis for API security code smells that are too noisy for regex.
 * Intended for warning-level security gate checks, not full taint analysis.
 *
 * Current checks:
 * - wildcard CORS usage in headers and CORS config call sites
 */

import { readdirSync, readFileSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import * as ts from 'typescript';

export type ApiSecurityIssueKind = 'cors-wildcard';

export interface ApiSecurityIssue {
  kind: ApiSecurityIssueKind;
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
  kind: ApiSecurityIssueKind,
  sourceFile: ts.SourceFile,
  node: ts.Node,
  repoRoot: string,
): ApiSecurityIssue {
  const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));

  return {
    kind,
    file: relative(repoRoot, sourceFile.fileName),
    line: line + 1,
    column: character + 1,
    snippet: getSnippet(sourceFile, node),
  };
}

function isWildcardString(node: ts.Expression): boolean {
  return (
    (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && node.text === '*'
  );
}

function isCorsHeaderName(node: ts.Expression): boolean {
  return (
    (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) &&
    node.text.toLowerCase() === 'access-control-allow-origin'
  );
}

function isCorsLikeCallee(expression: ts.LeftHandSideExpression): boolean {
  if (ts.isIdentifier(expression)) {
    return expression.text === 'cors' || expression.text === 'createSecurityMiddleware';
  }

  if (ts.isPropertyAccessExpression(expression)) {
    const name = expression.name.text.toLowerCase();
    return name.includes('cors');
  }

  return false;
}

function getWildcardOriginProperty(
  node: ts.ObjectLiteralExpression,
): ts.PropertyAssignment | undefined {
  return node.properties.find((property) => {
    return (
      ts.isPropertyAssignment(property) &&
      getPropertyNameText(property.name) === 'origin' &&
      isWildcardString(property.initializer)
    );
  }) as ts.PropertyAssignment | undefined;
}

function isCorsPresetWildcardCall(node: ts.CallExpression): boolean {
  return (
    ts.isPropertyAccessExpression(node.expression) &&
    ts.isIdentifier(node.expression.expression) &&
    node.expression.expression.text === 'CORSPresets' &&
    ['permissive', 'api'].includes(node.expression.name.text)
  );
}

function analyzeSourceFile(sourceFile: ts.SourceFile, repoRoot: string): ApiSecurityIssue[] {
  const issues: ApiSecurityIssue[] = [];

  function visit(node: ts.Node): void {
    if (ts.isCallExpression(node)) {
      if (isCorsPresetWildcardCall(node)) {
        issues.push(createIssue('cors-wildcard', sourceFile, node, repoRoot));
      }

      const [firstArgument, secondArgument] = node.arguments;
      if (
        ts.isPropertyAccessExpression(node.expression) &&
        ['set', 'append'].includes(node.expression.name.text) &&
        firstArgument &&
        secondArgument &&
        isCorsHeaderName(firstArgument) &&
        isWildcardString(secondArgument)
      ) {
        issues.push(createIssue('cors-wildcard', sourceFile, node, repoRoot));
      }

      if (isCorsLikeCallee(node.expression)) {
        for (const argument of node.arguments) {
          if (!ts.isObjectLiteralExpression(argument)) {
            continue;
          }

          const wildcardOrigin = getWildcardOriginProperty(argument);
          if (wildcardOrigin) {
            issues.push(createIssue('cors-wildcard', sourceFile, wildcardOrigin, repoRoot));
          }
        }
      }
    }

    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isElementAccessExpression(node.left) &&
      node.left.argumentExpression &&
      isCorsHeaderName(node.left.argumentExpression) &&
      isWildcardString(node.right)
    ) {
      issues.push(createIssue('cors-wildcard', sourceFile, node, repoRoot));
    }

    if (ts.isPropertyAssignment(node)) {
      const propertyName = getPropertyNameText(node.name);
      if (propertyName === 'Access-Control-Allow-Origin' && isWildcardString(node.initializer)) {
        issues.push(createIssue('cors-wildcard', sourceFile, node, repoRoot));
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return issues;
}

export function findApiSecurityIssues(projectRoot: string): ApiSecurityIssue[] {
  const files = [
    ...collectSourceFiles(join(projectRoot, 'packages')),
    ...collectSourceFiles(join(projectRoot, 'apps')),
  ];

  const issues: ApiSecurityIssue[] = [];

  for (const file of files) {
    const content = readFileSync(file, 'utf8');
    const sourceFile = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true);
    issues.push(...analyzeSourceFile(sourceFile, projectRoot));
  }

  return issues;
}

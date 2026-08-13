/**
 * GAP-335: MCP admin routes import Node-only @revealui/mcp/oauth (and siblings).
 * Turbopack traces those into Edge unless every route pins runtime = 'nodejs'.
 * Walk route modules with the Compiler API (no authored regex).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from '@revealui/ts-strada';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const MCP_API_ROOT = join(REPO_ROOT, 'apps/admin/src/app/api/mcp');
const INSTRUMENTATION = join(REPO_ROOT, 'apps/admin/src/instrumentation.ts');

function listRouteFiles(dir: string): string[] {
  const out: string[] = [];
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, ent.name);
    if (ent.isDirectory()) {
      out.push(...listRouteFiles(abs));
      continue;
    }
    if (ent.isFile() && ent.name === 'route.ts') out.push(abs);
  }
  return out;
}

function declaresNodejsRuntime(source: string, fileName: string): boolean {
  const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  let found = false;
  const visit = (node: ts.Node): void => {
    if (ts.isVariableStatement(node)) {
      const isExport = (node.modifiers ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
      if (isExport) {
        for (const decl of node.declarationList.declarations) {
          if (ts.isIdentifier(decl.name) && decl.name.text === 'runtime') {
            if (decl.initializer && ts.isStringLiteral(decl.initializer)) {
              if (decl.initializer.text === 'nodejs') found = true;
            }
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}

function mentionsProcessExit(source: string, fileName: string): boolean {
  const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  let found = false;
  const visit = (node: ts.Node): void => {
    if (
      ts.isPropertyAccessExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'process' &&
      ts.isIdentifier(node.name) &&
      (node.name.text === 'exit' || node.name.text === 'stderr')
    ) {
      found = true;
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}

describe('GAP-335 MCP admin routes pin Node runtime', () => {
  const routes = listRouteFiles(MCP_API_ROOT);

  it('finds MCP route modules', () => {
    expect(routes.length).toBeGreaterThan(10);
  });

  it('every MCP route.ts exports runtime = nodejs', () => {
    const missing: string[] = [];
    for (const file of routes) {
      const src = readFileSync(file, 'utf8');
      if (!declaresNodejsRuntime(src, file)) missing.push(file);
    }
    expect(missing).toEqual([]);
  });
});

describe('GAP-335 instrumentation entry is Edge-trace safe', () => {
  it('does not mention process.exit or process.stderr in instrumentation.ts', () => {
    const src = readFileSync(INSTRUMENTATION, 'utf8');
    expect(mentionsProcessExit(src, INSTRUMENTATION)).toBe(false);
  });
});

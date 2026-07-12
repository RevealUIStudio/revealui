/**
 * Database schema extractor (Tier-1).
 *
 * Parses Drizzle schema files under `packages/db/src/schema` with the
 * TypeScript compiler API, finds `pgTable('table_name', ...)` call
 * expressions, and emits a `db-table` node per table plus a `stores-in` edge
 * from the `@revealui/db` package node.
 */

import { join } from 'node:path';
import ts from 'typescript';
import type { EdgeInput, NodeInput } from '../types.js';
import { isDir, packageKey, readTextFile, scanEpisode, tableKey, walkFiles } from './shared.js';
import type { Extractor, ExtractorContext, ScanProduct } from './types.js';

const DB_PACKAGE_NAME = '@revealui/db';
const SCHEMA_DIR = 'packages/db/src/schema';

function mapKey(kind: string, naturalKey: string): string {
  return `${kind}:${naturalKey}`;
}

function findPgTableNames(source: ts.SourceFile): string[] {
  const names: string[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'pgTable'
    ) {
      const firstArg = node.arguments[0];
      if (firstArg && ts.isStringLiteral(firstArg)) {
        names.push(firstArg.text);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return names;
}

export const dbSchemaExtractor: Extractor = {
  name: 'db-schema',
  async extract(ctx: ExtractorContext): Promise<ScanProduct[]> {
    const schemaDir = join(ctx.repoRoot, SCHEMA_DIR);
    if (!isDir(schemaDir)) return [];

    const nodes = new Map<string, NodeInput>();
    const edges: EdgeInput[] = [];

    const dbPackageNode: NodeInput = {
      kind: 'package',
      name: DB_PACKAGE_NAME,
      naturalKey: packageKey(ctx.repo, DB_PACKAGE_NAME),
      repo: ctx.repo,
    };
    nodes.set(mapKey(dbPackageNode.kind, dbPackageNode.naturalKey), dbPackageNode);

    const files = walkFiles(schemaDir, ctx.repoRoot, ['.ts']);
    for (const rel of files) {
      const text = readTextFile(join(ctx.repoRoot, rel));
      if (text === null) continue;

      let source: ts.SourceFile;
      try {
        source = ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true);
      } catch {
        continue;
      }

      for (const tableName of findPgTableNames(source)) {
        const tableNode: NodeInput = {
          kind: 'db-table',
          name: tableName,
          naturalKey: tableKey(ctx.repo, tableName),
          repo: ctx.repo,
          attributes: { tableName },
        };
        nodes.set(mapKey(tableNode.kind, tableNode.naturalKey), tableNode);

        edges.push({
          source: { kind: 'package', naturalKey: packageKey(ctx.repo, DB_PACKAGE_NAME) },
          target: { kind: 'db-table', naturalKey: tableKey(ctx.repo, tableName) },
          relation: 'stores-in',
          fact: `${DB_PACKAGE_NAME} stores in ${tableName}`,
          repo: ctx.repo,
        });
      }
    }

    if (edges.length === 0) return [];

    return [
      {
        episode: scanEpisode(ctx, 'db-schema'),
        nodes: [...nodes.values()],
        edges,
        scope: { repo: ctx.repo, extractor: 'db-schema' },
      },
    ];
  },
};

/**
 * HTTP route extractor (Tier-1).
 *
 * Walks each app's `app/api/**\/route.ts` files (Next.js route handler
 * convention), derives the URL path from the directory structure, and parses
 * exported `GET`/`POST`/`PUT`/`PATCH`/`DELETE`/`OPTIONS` declarations with
 * the compiler API. Emits a `route` node per file and an `app` `contains`
 * `route` edge.
 */

import { join } from 'node:path';
import ts from 'typescript';
import type { EdgeInput, NodeInput } from '../types.js';
import {
  isDir,
  listDir,
  packageKey,
  readTextFile,
  routeKey,
  scanEpisode,
  walkFiles,
} from './shared.js';
import type { Extractor, ExtractorContext, ScanProduct } from './types.js';

const HTTP_METHODS: ReadonlySet<string> = new Set([
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'OPTIONS',
]);

interface RouteFile {
  app: string;
  rel: string;
}

function mapKey(kind: string, naturalKey: string): string {
  return `${kind}:${naturalKey}`;
}

function findRouteFiles(repoRoot: string): RouteFile[] {
  const appsDir = join(repoRoot, 'apps');
  if (!isDir(appsDir)) return [];

  const out: RouteFile[] = [];
  for (const appName of listDir(appsDir)) {
    const appDir = join(appsDir, appName);
    if (!isDir(appDir)) continue;

    for (const rel of walkFiles(appDir, repoRoot, ['route.ts'])) {
      const segments = rel.split('/');
      if (segments[segments.length - 1] !== 'route.ts') continue;
      if (!(segments.includes('app') && segments.includes('api'))) continue;
      out.push({ app: appName, rel });
    }
  }
  return out;
}

/** URL path is everything between the `api` segment and the trailing `route.ts`. */
function deriveUrlPath(rel: string): string | null {
  const segments = rel.split('/');
  let apiIdx = -1;
  for (let i = 0; i < segments.length - 1; i++) {
    if (segments[i] === 'app' && segments[i + 1] === 'api') {
      apiIdx = i + 1;
      break;
    }
  }
  if (apiIdx === -1) return null;
  const urlSegments = segments.slice(apiIdx + 1, segments.length - 1);
  return `/${urlSegments.join('/')}`;
}

function hasExportModifier(node: ts.Node): boolean {
  if (!ts.canHaveModifiers(node)) return false;
  const modifiers = ts.getModifiers(node);
  if (!modifiers) return false;
  return modifiers.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
}

function findExportedMethods(source: ts.SourceFile): string[] {
  const methods = new Set<string>();
  for (const statement of source.statements) {
    if (!hasExportModifier(statement)) continue;

    if (
      ts.isFunctionDeclaration(statement) &&
      statement.name &&
      HTTP_METHODS.has(statement.name.text)
    ) {
      methods.add(statement.name.text);
      continue;
    }
    if (ts.isVariableStatement(statement)) {
      for (const decl of statement.declarationList.declarations) {
        if (ts.isIdentifier(decl.name) && HTTP_METHODS.has(decl.name.text)) {
          methods.add(decl.name.text);
        }
      }
    }
  }
  return [...methods].sort();
}

function isGuarded(source: ts.SourceFile): boolean {
  for (const statement of source.statements) {
    if (
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text.includes('auth')
    ) {
      return true;
    }
  }
  return false;
}

export const routesExtractor: Extractor = {
  name: 'routes',
  async extract(ctx: ExtractorContext): Promise<ScanProduct[]> {
    const nodes = new Map<string, NodeInput>();
    const edges: EdgeInput[] = [];

    for (const { app, rel } of findRouteFiles(ctx.repoRoot)) {
      try {
        const urlPath = deriveUrlPath(rel);
        if (urlPath === null) continue;

        const text = readTextFile(join(ctx.repoRoot, rel));
        if (text === null) continue;

        let source: ts.SourceFile;
        try {
          source = ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true);
        } catch {
          continue;
        }

        const methods = findExportedMethods(source);
        if (methods.length === 0) continue;

        const appNode: NodeInput = {
          kind: 'app',
          name: app,
          naturalKey: packageKey(ctx.repo, app),
          repo: ctx.repo,
        };
        const appMapKey = mapKey(appNode.kind, appNode.naturalKey);
        if (!nodes.has(appMapKey)) nodes.set(appMapKey, appNode);

        const routeNode: NodeInput = {
          kind: 'route',
          name: urlPath,
          naturalKey: routeKey(ctx.repo, app, urlPath),
          repo: ctx.repo,
          attributes: {
            method: methods.join(','),
            routeType: 'http',
            path: rel,
            guarded: isGuarded(source),
          },
        };
        nodes.set(mapKey(routeNode.kind, routeNode.naturalKey), routeNode);

        edges.push({
          source: { kind: 'app', naturalKey: appNode.naturalKey },
          target: { kind: 'route', naturalKey: routeNode.naturalKey },
          relation: 'contains',
          fact: `${app} contains route ${urlPath}`,
          repo: ctx.repo,
        });
      } catch {
        // Skip files that fail to parse; extraction is best-effort and resilient.
      }
    }

    if (edges.length === 0) return [];

    return [
      {
        episode: scanEpisode(ctx, 'routes'),
        nodes: [...nodes.values()],
        edges,
        scope: { repo: ctx.repo, extractor: 'routes' },
      },
    ];
  },
};

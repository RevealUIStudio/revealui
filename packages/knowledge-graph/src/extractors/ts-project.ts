/**
 * TypeScript project extractor (Tier-1).
 *
 * Walks each workspace package/app's `src` tree, parses every non-test
 * `.ts`/`.tsx` file with the TypeScript compiler API, and emits a `file` node
 * per file, a `symbol` node per exported top-level declaration, and `imports`
 * edges (to another file for relative specifiers, to a `dependency` node for
 * bare specifiers). One combined `ScanProduct` per repo so re-scan diffing
 * stays correct across the whole `ts-project` scope.
 *
 * When the repo has no `pnpm-workspace.yaml`, the repo root itself is walked
 * as a single implicit package (its `src` directory), matching the fallback
 * the `workspace` extractor uses so both derive the identical `packageKey`.
 */

import { dirname, join, relative } from 'node:path';
import ts from '@revealui/ts-strada';
import type { EdgeInput, NodeInput } from '../types.js';
import {
  dependencyKey,
  fileKey,
  hasPnpmWorkspace,
  implicitPackageName,
  isDir,
  listDir,
  packageKey,
  readJsonFile,
  readTextFile,
  scanEpisode,
  symbolKey,
  toPosix,
  walkFiles,
} from './shared.js';
import type { Extractor, ExtractorContext, ScanProduct } from './types.js';

interface DiscoveredPackage {
  dir: string;
  kind: 'package' | 'app';
  name: string;
}

interface ExportedSymbol {
  name: string;
  symbolKind: string;
}

function mapKey(kind: string, naturalKey: string): string {
  return `${kind}:${naturalKey}`;
}

function discoverPackages(repoRoot: string): DiscoveredPackage[] {
  if (!hasPnpmWorkspace(repoRoot)) {
    return [{ dir: '', kind: 'package', name: implicitPackageName(repoRoot) }];
  }
  const out: DiscoveredPackage[] = [];
  for (const [topDir, kind] of [
    ['packages', 'package'],
    ['apps', 'app'],
  ] as const) {
    const topAbs = join(repoRoot, topDir);
    if (!isDir(topAbs)) continue;
    for (const entry of listDir(topAbs)) {
      const full = join(topAbs, entry);
      if (!isDir(full)) continue;
      const pkgJson = readJsonFile<{ name?: string }>(join(full, 'package.json'));
      if (!pkgJson?.name) continue;
      out.push({ dir: `${topDir}/${entry}`, kind, name: pkgJson.name });
    }
  }
  return out;
}

function isTestFile(rel: string): boolean {
  if (
    rel.endsWith('.test.ts') ||
    rel.endsWith('.test.tsx') ||
    rel.endsWith('.spec.ts') ||
    rel.endsWith('.spec.tsx')
  ) {
    return true;
  }
  return rel.split('/').includes('__tests__');
}

function hasExportModifier(node: ts.Node): boolean {
  if (!ts.canHaveModifiers(node)) return false;
  const modifiers = ts.getModifiers(node);
  if (!modifiers) return false;
  return modifiers.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
}

function hasDefaultModifier(node: ts.Node): boolean {
  if (!ts.canHaveModifiers(node)) return false;
  const modifiers = ts.getModifiers(node);
  if (!modifiers) return false;
  return modifiers.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword);
}

function collectExportedSymbols(statement: ts.Statement): ExportedSymbol[] {
  if (ts.isExportAssignment(statement)) {
    return [{ name: 'default', symbolKind: 'default-export' }];
  }
  if (ts.isExportDeclaration(statement)) {
    const clause = statement.exportClause;
    if (clause && ts.isNamedExports(clause)) {
      return clause.elements.map((el) => ({ name: el.name.text, symbolKind: 're-export' }));
    }
    return [];
  }
  if (!hasExportModifier(statement)) return [];
  const isDefault = hasDefaultModifier(statement);

  if (ts.isFunctionDeclaration(statement)) {
    return [
      {
        name: statement.name?.text ?? (isDefault ? 'default' : '<anonymous>'),
        symbolKind: 'function',
      },
    ];
  }
  if (ts.isClassDeclaration(statement)) {
    return [
      {
        name: statement.name?.text ?? (isDefault ? 'default' : '<anonymous>'),
        symbolKind: 'class',
      },
    ];
  }
  if (ts.isInterfaceDeclaration(statement)) {
    return [{ name: statement.name.text, symbolKind: 'interface' }];
  }
  if (ts.isTypeAliasDeclaration(statement)) {
    return [{ name: statement.name.text, symbolKind: 'type' }];
  }
  if (ts.isEnumDeclaration(statement)) {
    return [{ name: statement.name.text, symbolKind: 'enum' }];
  }
  if (ts.isVariableStatement(statement)) {
    const isConst = (statement.declarationList.flags & ts.NodeFlags.Const) !== 0;
    const out: ExportedSymbol[] = [];
    for (const decl of statement.declarationList.declarations) {
      if (ts.isIdentifier(decl.name)) {
        out.push({ name: decl.name.text, symbolKind: isConst ? 'const' : 'variable' });
      }
    }
    return out;
  }
  return [];
}

function candidateExists(path: string): boolean {
  return readTextFile(path) !== null;
}

/** Resolve a relative import specifier to a repo-relative posix file path, or null. */
function resolveRelativeImport(
  repoRoot: string,
  fromRel: string,
  specifier: string,
): string | null {
  const fromDir = dirname(join(repoRoot, fromRel));
  const rawTarget = join(fromDir, specifier);
  const stem = specifier.endsWith('.js') ? rawTarget.slice(0, -3) : rawTarget;
  const candidates = specifier.endsWith('.js')
    ? [`${stem}.ts`, `${stem}.tsx`]
    : [`${stem}.ts`, `${stem}.tsx`, join(stem, 'index.ts'), join(stem, 'index.tsx')];
  for (const candidate of candidates) {
    if (candidateExists(candidate)) return toPosix(relative(repoRoot, candidate));
  }
  return null;
}

/** Reduce a bare import specifier to its owning package name (handles `@scope/pkg/sub`). */
function baseDependencyName(specifier: string): string {
  const parts = specifier.split('/');
  const p0 = parts[0] ?? specifier;
  if (specifier.startsWith('@')) {
    const p1 = parts[1] ?? '';
    return parts.length >= 2 ? `${p0}/${p1}` : specifier;
  }
  return p0;
}

export const tsProjectExtractor: Extractor = {
  name: 'ts-project',
  async extract(ctx: ExtractorContext): Promise<ScanProduct[]> {
    const packages = discoverPackages(ctx.repoRoot);
    const nodes = new Map<string, NodeInput>();
    const edges: EdgeInput[] = [];

    for (const pkg of packages) {
      const srcDir = join(ctx.repoRoot, pkg.dir, 'src');
      if (!isDir(srcDir)) continue;

      const files = walkFiles(srcDir, ctx.repoRoot, ['.ts', '.tsx']).filter(
        (rel) => !isTestFile(rel),
      );

      for (const rel of files) {
        const text = readTextFile(join(ctx.repoRoot, rel));
        if (text === null) continue;

        let source: ts.SourceFile;
        try {
          source = ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true);
        } catch {
          continue;
        }

        const fileNode: NodeInput = {
          kind: 'file',
          name: rel,
          naturalKey: fileKey(ctx.repo, rel),
          repo: ctx.repo,
          attributes: { path: rel, language: rel.endsWith('.tsx') ? 'tsx' : 'ts' },
        };
        nodes.set(mapKey(fileNode.kind, fileNode.naturalKey), fileNode);

        edges.push({
          source: { kind: pkg.kind, naturalKey: packageKey(ctx.repo, pkg.name) },
          target: { kind: 'file', naturalKey: fileKey(ctx.repo, rel) },
          relation: 'contains',
          fact: `${pkg.name} contains ${rel}`,
          repo: ctx.repo,
        });

        for (const statement of source.statements) {
          for (const sym of collectExportedSymbols(statement)) {
            const symNode: NodeInput = {
              kind: 'symbol',
              name: sym.name,
              naturalKey: symbolKey(ctx.repo, rel, sym.name),
              repo: ctx.repo,
              attributes: { symbolKind: sym.symbolKind, exported: true, path: rel },
            };
            nodes.set(mapKey(symNode.kind, symNode.naturalKey), symNode);

            edges.push({
              source: { kind: 'file', naturalKey: fileKey(ctx.repo, rel) },
              target: { kind: 'symbol', naturalKey: symbolKey(ctx.repo, rel, sym.name) },
              relation: 'exports',
              fact: `${rel} exports ${sym.name}`,
              repo: ctx.repo,
            });
          }

          if (
            ts.isImportDeclaration(statement) &&
            statement.moduleSpecifier &&
            ts.isStringLiteral(statement.moduleSpecifier)
          ) {
            const specifier = statement.moduleSpecifier.text;

            if (specifier.startsWith('.')) {
              const resolvedRel = resolveRelativeImport(ctx.repoRoot, rel, specifier);
              if (resolvedRel === null) continue;

              const targetKey = fileKey(ctx.repo, resolvedRel);
              const targetMapKey = mapKey('file', targetKey);
              if (!nodes.has(targetMapKey)) {
                nodes.set(targetMapKey, {
                  kind: 'file',
                  name: resolvedRel,
                  naturalKey: targetKey,
                  repo: ctx.repo,
                  attributes: { path: resolvedRel },
                });
              }

              edges.push({
                source: { kind: 'file', naturalKey: fileKey(ctx.repo, rel) },
                target: { kind: 'file', naturalKey: targetKey },
                relation: 'imports',
                fact: `${rel} imports ${resolvedRel}`,
                repo: ctx.repo,
              });
            } else {
              const depName = baseDependencyName(specifier);
              const depKey = dependencyKey(depName);
              const depMapKey = mapKey('dependency', depKey);
              if (!nodes.has(depMapKey)) {
                nodes.set(depMapKey, {
                  kind: 'dependency',
                  name: depName,
                  naturalKey: depKey,
                  repo: null,
                });
              }

              edges.push({
                source: { kind: 'file', naturalKey: fileKey(ctx.repo, rel) },
                target: { kind: 'dependency', naturalKey: depKey },
                relation: 'imports',
                fact: `${rel} imports ${depName}`,
                repo: ctx.repo,
              });
            }
          }
        }
      }
    }

    if (nodes.size === 0 && edges.length === 0) return [];

    return [
      {
        episode: scanEpisode(ctx, 'ts-project'),
        nodes: [...nodes.values()],
        edges,
        scope: { repo: ctx.repo, extractor: 'ts-project' },
      },
    ];
  },
};

/**
 * Workspace extractor (Tier-1).
 *
 * Reads `pnpm-workspace.yaml` for `packages:` globs (only the simple `dir/*`
 * form is handled) and each discovered package/app's `package.json`. Emits the
 * repo node, one package/app node per workspace member, one dependency node
 * per distinct external dependency, and `contains` / `depends-on` edges.
 *
 * When the repo has no `pnpm-workspace.yaml` (a non-monorepo fleet checkout,
 * e.g. a bare Vite SPA), the repo root itself is treated as a single implicit
 * package so the `ts-project` extractor still has a package to scope its
 * `src` walk under (see `implicitPackageName` in shared.ts).
 */

import { join } from 'node:path';
import { parse } from 'yaml';
import type { EdgeInput, NodeInput } from '../types.js';
import {
  dependencyKey,
  hasPnpmWorkspace,
  implicitPackageName,
  isDir,
  listDir,
  packageKey,
  readJsonFile,
  readTextFile,
  repoKey,
  scanEpisode,
  toPosix,
} from './shared.js';
import type { Extractor, ExtractorContext, ScanProduct } from './types.js';

interface PackageJsonShape {
  name?: string;
  version?: string;
  private?: boolean;
  license?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

interface WorkspaceYaml {
  packages?: string[];
}

interface DiscoveredPackage {
  dir: string;
  kind: 'package' | 'app';
  name: string;
  pkgJson: PackageJsonShape;
}

function mapKey(kind: string, naturalKey: string): string {
  return `${kind}:${naturalKey}`;
}

function definedEntries(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) out[key] = value;
  }
  return out;
}

function discoverWorkspaceDirs(repoRoot: string): string[] {
  const raw = readTextFile(join(repoRoot, 'pnpm-workspace.yaml'));
  if (raw === null) return [];
  let parsed: WorkspaceYaml;
  try {
    parsed = parse(raw) as WorkspaceYaml;
  } catch {
    return [];
  }
  const globs = parsed.packages ?? [];
  const dirs: string[] = [];
  for (const glob of globs) {
    if (!glob.endsWith('/*')) continue; // only the simple `dir/*` form is handled
    const base = glob.slice(0, -2);
    const baseAbs = join(repoRoot, base);
    if (!isDir(baseAbs)) continue;
    for (const entry of listDir(baseAbs)) {
      const full = join(baseAbs, entry);
      if (isDir(full)) dirs.push(toPosix(`${base}/${entry}`));
    }
  }
  return dirs;
}

export const workspaceExtractor: Extractor = {
  name: 'workspace',
  async extract(ctx: ExtractorContext): Promise<ScanProduct[]> {
    const isWorkspace = hasPnpmWorkspace(ctx.repoRoot);
    const dirs = isWorkspace ? discoverWorkspaceDirs(ctx.repoRoot) : [];
    const nodes = new Map<string, NodeInput>();
    const edges: EdgeInput[] = [];

    const repoNode: NodeInput = {
      kind: 'repo',
      name: ctx.repo,
      naturalKey: repoKey(ctx.repo),
      repo: ctx.repo,
    };
    nodes.set(mapKey(repoNode.kind, repoNode.naturalKey), repoNode);

    const discovered: DiscoveredPackage[] = [];
    for (const dir of dirs) {
      const pkgJson = readJsonFile<PackageJsonShape>(join(ctx.repoRoot, dir, 'package.json'));
      if (!pkgJson?.name) continue;
      const kind: 'package' | 'app' = dir.startsWith('apps/') ? 'app' : 'package';
      discovered.push({ dir, kind, name: pkgJson.name, pkgJson });
    }

    if (!isWorkspace) {
      const pkgJson = readJsonFile<PackageJsonShape>(join(ctx.repoRoot, 'package.json')) ?? {};
      discovered.push({
        dir: '',
        kind: 'package',
        name: implicitPackageName(ctx.repoRoot),
        pkgJson,
      });
    }

    const packageKindByName = new Map<string, 'package' | 'app'>();
    for (const pkg of discovered) packageKindByName.set(pkg.name, pkg.kind);

    for (const pkg of discovered) {
      const pkgNode: NodeInput = {
        kind: pkg.kind,
        name: pkg.name,
        naturalKey: packageKey(ctx.repo, pkg.name),
        repo: ctx.repo,
        attributes: definedEntries({
          version: pkg.pkgJson.version,
          private: pkg.pkgJson.private,
          license: pkg.pkgJson.license,
          path: pkg.dir,
        }),
      };
      nodes.set(mapKey(pkgNode.kind, pkgNode.naturalKey), pkgNode);

      edges.push({
        source: { kind: 'repo', naturalKey: repoKey(ctx.repo) },
        target: { kind: pkg.kind, naturalKey: packageKey(ctx.repo, pkg.name) },
        relation: 'contains',
        fact: `${ctx.repo} contains ${pkg.name}`,
        repo: ctx.repo,
      });

      const deps = { ...(pkg.pkgJson.dependencies ?? {}), ...(pkg.pkgJson.devDependencies ?? {}) };
      for (const [depName, depValue] of Object.entries(deps)) {
        const targetKind = packageKindByName.get(depName);
        if (depValue.startsWith('workspace:') && targetKind !== undefined) {
          edges.push({
            source: { kind: pkg.kind, naturalKey: packageKey(ctx.repo, pkg.name) },
            target: { kind: targetKind, naturalKey: packageKey(ctx.repo, depName) },
            relation: 'depends-on',
            fact: `${pkg.name} depends on ${depName}`,
            repo: ctx.repo,
          });
          continue;
        }

        const depNode: NodeInput = {
          kind: 'dependency',
          name: depName,
          naturalKey: dependencyKey(depName),
          repo: null,
        };
        const depMapKey = mapKey(depNode.kind, depNode.naturalKey);
        if (!nodes.has(depMapKey)) nodes.set(depMapKey, depNode);

        edges.push({
          source: { kind: pkg.kind, naturalKey: packageKey(ctx.repo, pkg.name) },
          target: { kind: 'dependency', naturalKey: dependencyKey(depName) },
          relation: 'depends-on',
          fact: `${pkg.name} depends on ${depName}`,
          repo: ctx.repo,
        });
      }
    }

    return [
      {
        episode: scanEpisode(ctx, 'workspace'),
        nodes: [...nodes.values()],
        edges,
        scope: { repo: ctx.repo, extractor: 'workspace' },
      },
    ];
  },
};

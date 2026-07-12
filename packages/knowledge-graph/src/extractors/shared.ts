/**
 * Shared extractor helpers: natural-key construction and filesystem walking.
 *
 * Natural keys must be globally unique across the fleet and identical whichever
 * extractor derives them (so deterministic node ids converge). These builders
 * are the single source for that convention.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join, relative } from 'node:path';
import type { EpisodeInput } from '../types.js';

// =============================================================================
// Natural-key builders
// =============================================================================

export function repoKey(repo: string): string {
  return repo;
}

/** A workspace package/app, keyed by its package.json name within its repo. */
export function packageKey(repo: string, packageName: string): string {
  return `${repo}:pkg:${packageName}`;
}

/** An external npm dependency (fleet-global, repo-agnostic). */
export function dependencyKey(name: string): string {
  return `npm:${name}`;
}

/** A source file, keyed by repo + repo-relative posix path. */
export function fileKey(repo: string, relPath: string): string {
  return `${repo}/${toPosix(relPath)}`;
}

/** An exported symbol within a file. */
export function symbolKey(repo: string, relPath: string, symbolName: string): string {
  return `${fileKey(repo, relPath)}#${symbolName}`;
}

/** A database table (repo-scoped by the owning schema package). */
export function tableKey(repo: string, tableName: string): string {
  return `${repo}#table:${tableName}`;
}

/** An HTTP / shape route, keyed by repo + app + url path. */
export function routeKey(repo: string, app: string, routePath: string): string {
  return `${repo}:${app}:route:${routePath}`;
}

/** A gap tracker id, e.g. `GAP-340` (fleet-global). */
export function gapKey(gapId: string): string {
  return gapId;
}

export function toPosix(p: string): string {
  return p.split('\\').join('/');
}

// =============================================================================
// Scan episode builder
// =============================================================================

export function scanEpisode(
  ctx: { repo: string; siteId: string; now: Date },
  extractor: string,
  extra: Record<string, unknown> = {},
): EpisodeInput {
  return {
    episodeType: 'code-scan',
    source: `${ctx.repo}:${extractor}`,
    siteId: ctx.siteId,
    content: null,
    contentRef: { repo: ctx.repo, extractor, ...extra },
    referenceTime: ctx.now,
  };
}

// =============================================================================
// Filesystem helpers
// =============================================================================

export function readJsonFile<T = Record<string, unknown>>(path: string): T | null {
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as T;
  } catch {
    return null;
  }
}

export function readTextFile(path: string): string | null {
  try {
    return readFileSync(path, 'utf-8');
  } catch {
    return null;
  }
}

export function isDir(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

export function listDir(path: string): string[] {
  try {
    return readdirSync(path);
  } catch {
    return [];
  }
}

// =============================================================================
// Single-package (non-monorepo) repo fallback
// =============================================================================

/** True when `repoRoot` declares a pnpm workspace (has a readable `pnpm-workspace.yaml`). */
export function hasPnpmWorkspace(repoRoot: string): boolean {
  return readTextFile(join(repoRoot, 'pnpm-workspace.yaml')) !== null;
}

/**
 * Name for the implicit single-package fallback used when a repo has no
 * `pnpm-workspace.yaml` (e.g. a bare Vite SPA checkout): the repo root's own
 * `package.json` name, or the repo root directory's basename when no
 * `package.json` exists. Shared by the `workspace` and `ts-project`
 * extractors so both derive the identical `packageKey`, keeping their
 * natural keys (and therefore deterministic node ids) convergent.
 */
export function implicitPackageName(repoRoot: string): string {
  const pkgJson = readJsonFile<{ name?: string }>(join(repoRoot, 'package.json'));
  return pkgJson?.name ?? basename(repoRoot);
}

const DEFAULT_IGNORE = new Set(['node_modules', 'dist', '.git', '.turbo', 'coverage', '.next']);

/**
 * Recursively collect files under `root` whose names end with one of `suffixes`.
 * Returns repo-relative posix paths. Skips build/vendor directories.
 */
export function walkFiles(
  root: string,
  base: string,
  suffixes: string[],
  ignore: ReadonlySet<string> = DEFAULT_IGNORE,
): string[] {
  const out: string[] = [];
  const stack: string[] = [root];
  while (stack.length > 0) {
    const dir = stack.pop();
    if (dir === undefined) continue;
    for (const entry of listDir(dir)) {
      if (ignore.has(entry)) continue;
      const full = join(dir, entry);
      if (isDir(full)) {
        stack.push(full);
      } else if (suffixes.some((s) => entry.endsWith(s))) {
        out.push(toPosix(relative(base, full)));
      }
    }
  }
  return out.sort();
}

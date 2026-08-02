#!/usr/bin/env tsx
/**
 * Dockerfile deps-stage COPY lockstep (GAP-379)
 *
 * Each app's Docker image installs with `pnpm install --filter <app>...`, which
 * needs every workspace package.json in that filter's dependency closure on
 * disk before install. Hardcoded COPY lists lag when a new workspace dep
 * joins the graph (revealui#1926 / @revealui/setup). This gate computes the
 * closure and hard-fails when a member lacks a package.json COPY line.
 *
 * Covers per-package COPY Dockerfiles (server + admin, plain + .forge).
 * Skips whole-tree-copy Dockerfiles (e.g. Dockerfile.worker copies packages/).
 *
 * Zero authored regex: path substring + whitespace splitting only.
 *
 * Usage:
 *   pnpm validate:dockerfile-deps
 *
 * Failure shape (exact missing COPY named):
 *   ✗ apps/server/Dockerfile.forge missing workspace package.json COPY:
 *       packages/setup
 *     add: COPY packages/setup/package.json ./packages/setup/
 *
 * Exit codes:
 *   0 = every targeted Dockerfile covers its filter's workspace closure
 *   1 = missing COPY line(s), missing Dockerfile, or pnpm list failed
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(import.meta.dirname, '../..');

export interface DockerfileTarget {
  /** pnpm package filter name (without the trailing `...`). */
  filterName: string;
  /** Repo-relative Dockerfile path. */
  dockerfileRel: string;
}

/**
 * Per-package package.json COPY Dockerfiles only.
 * Dockerfile.worker (and any whole-tree copy) is intentionally absent.
 */
export const TARGETS: DockerfileTarget[] = [
  { filterName: 'server', dockerfileRel: 'apps/server/Dockerfile' },
  { filterName: 'server', dockerfileRel: 'apps/server/Dockerfile.forge' },
  { filterName: 'admin', dockerfileRel: 'apps/admin/Dockerfile' },
  { filterName: 'admin', dockerfileRel: 'apps/admin/Dockerfile.forge' },
];

const PACKAGE_JSON_SUFFIX = '/package.json';

/** Collapse runs of spaces/tabs without regex. */
function splitWhitespace(text: string): string[] {
  const tokens: string[] = [];
  let current = '';
  for (const ch of text) {
    if (ch === ' ' || ch === '\t') {
      if (current.length > 0) {
        tokens.push(current);
        current = '';
      }
      continue;
    }
    current += ch;
  }
  if (current.length > 0) tokens.push(current);
  return tokens;
}

/**
 * Workspace package dirs referenced by `COPY packages/.../package.json` /
 * `COPY apps/.../package.json` lines. Root `COPY package.json …` is ignored.
 * Multi-stage `COPY --from=…` and whole-tree `COPY packages ./packages` are ignored.
 */
export function parseCopiedWorkspacePackageDirs(dockerfileText: string): Set<string> {
  const result = new Set<string>();
  for (const rawLine of dockerfileText.split('\n')) {
    const line = rawLine.trim();
    if (!line.startsWith('COPY ')) continue;
    const rest = line.slice('COPY '.length);
    if (rest.startsWith('--from')) continue;

    for (const token of splitWhitespace(rest)) {
      if (!token.endsWith(PACKAGE_JSON_SUFFIX)) continue;
      if (!(token.startsWith('packages/') || token.startsWith('apps/'))) continue;
      const dir = token.slice(0, token.length - PACKAGE_JSON_SUFFIX.length);
      if (dir.length > 0) result.add(dir);
    }
  }
  return result;
}

/**
 * True when the Dockerfile copies the packages tree as a unit and never lists
 * individual package.json paths (worker-style). Such files are out of scope.
 */
export function isWholeTreePackageCopy(dockerfileText: string): boolean {
  if (parseCopiedWorkspacePackageDirs(dockerfileText).size > 0) return false;
  for (const rawLine of dockerfileText.split('\n')) {
    const line = rawLine.trim();
    if (!line.startsWith('COPY ')) continue;
    const rest = line.slice('COPY '.length);
    if (rest.startsWith('--from')) continue;
    const tokens = splitWhitespace(rest);
    // Last token is the destination; sources are the rest.
    for (const token of tokens.slice(0, Math.max(0, tokens.length - 1))) {
      if (token === 'packages' || token === './packages') return true;
    }
  }
  return false;
}

/**
 * Convert `pnpm list --parseable` absolute paths into repo-relative posix dirs
 * under packages/ or apps/ (the monorepo root path is dropped if present).
 */
export function parseWorkspaceClosurePaths(parseableOutput: string, repoRoot: string): Set<string> {
  const root = path.resolve(repoRoot);
  const rootPrefix = root.endsWith(path.sep) ? root : root + path.sep;
  const result = new Set<string>();

  for (const raw of parseableOutput.split('\n')) {
    const abs = raw.trim();
    if (abs.length === 0) continue;
    const resolved = path.resolve(abs);
    if (resolved === root) continue;
    if (!resolved.startsWith(rootPrefix)) continue;
    const relPosix = path.relative(root, resolved).split(path.sep).join('/');
    if (relPosix.startsWith('packages/') || relPosix.startsWith('apps/')) {
      result.add(relPosix);
    }
  }
  return result;
}

export function findMissingCopies(closure: Set<string>, copied: Set<string>): string[] {
  const missing: string[] = [];
  for (const pkg of [...closure].sort()) {
    if (!copied.has(pkg)) missing.push(pkg);
  }
  return missing;
}

/** Suggested Dockerfile line for a missing workspace package. */
export function suggestedCopyLine(packageDir: string): string {
  return `COPY ${packageDir}/package.json ./${packageDir}/`;
}

export function listWorkspaceClosure(repoRoot: string, filterName: string): Set<string> {
  const out = execFileSync(
    'pnpm',
    ['--filter', `${filterName}...`, 'list', '--depth', '-1', '--parseable'],
    {
      cwd: repoRoot,
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
    },
  );
  return parseWorkspaceClosurePaths(out, repoRoot);
}

export interface TargetResult {
  dockerfileRel: string;
  filterName: string;
  skipped: boolean;
  skipReason?: string;
  closureSize: number;
  copiedSize: number;
  missing: string[];
}

export function checkTarget(
  repoRoot: string,
  target: DockerfileTarget,
  closure: Set<string>,
): TargetResult {
  const abs = path.join(repoRoot, target.dockerfileRel);
  if (!fs.existsSync(abs)) {
    return {
      dockerfileRel: target.dockerfileRel,
      filterName: target.filterName,
      skipped: false,
      closureSize: closure.size,
      copiedSize: 0,
      missing: [`<Dockerfile missing on disk: ${target.dockerfileRel}>`],
    };
  }

  const text = fs.readFileSync(abs, 'utf8');
  if (isWholeTreePackageCopy(text)) {
    return {
      dockerfileRel: target.dockerfileRel,
      filterName: target.filterName,
      skipped: true,
      skipReason: 'whole-tree packages/ copy (no per-package package.json COPY list)',
      closureSize: closure.size,
      copiedSize: 0,
      missing: [],
    };
  }

  const copied = parseCopiedWorkspacePackageDirs(text);
  const missing = findMissingCopies(closure, copied);
  return {
    dockerfileRel: target.dockerfileRel,
    filterName: target.filterName,
    skipped: false,
    closureSize: closure.size,
    copiedSize: copied.size,
    missing,
  };
}

export function main(repoRoot: string = ROOT, targets: DockerfileTarget[] = TARGETS): number {
  const closures = new Map<string, Set<string>>();
  const results: TargetResult[] = [];
  let failed = false;

  for (const target of targets) {
    let closure = closures.get(target.filterName);
    if (!closure) {
      try {
        closure = listWorkspaceClosure(repoRoot, target.filterName);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`✗ pnpm list failed for filter "${target.filterName}...": ${message}`);
        return 1;
      }
      if (closure.size === 0) {
        console.error(
          `✗ pnpm --filter "${target.filterName}..." list returned no workspace packages`,
        );
        return 1;
      }
      closures.set(target.filterName, closure);
    }

    const result = checkTarget(repoRoot, target, closure);
    results.push(result);

    if (result.skipped) {
      console.log(`○ ${result.dockerfileRel}: skipped (${result.skipReason})`);
      continue;
    }

    if (result.missing.length > 0) {
      failed = true;
      console.error(
        `✗ ${result.dockerfileRel} missing workspace package.json COPY ` +
          `(filter ${result.filterName}..., ${result.closureSize} package(s) in closure):`,
      );
      for (const pkg of result.missing) {
        if (pkg.startsWith('<')) {
          console.error(`    ${pkg}`);
          continue;
        }
        console.error(`    ${pkg}`);
        console.error(`      add: ${suggestedCopyLine(pkg)}`);
      }
      continue;
    }

    console.log(
      `✓ ${result.dockerfileRel}: ${result.closureSize} closure package(s) covered ` +
        `(${result.copiedSize} package.json COPY line(s); filter ${result.filterName}...)`,
    );
  }

  if (failed) {
    console.error('');
    console.error(
      'Dockerfile deps-stage COPY lists must include every workspace package in the ' +
        'app filter closure. See GAP-379 / revealui#1926.',
    );
    return 1;
  }

  const checked = results.filter((r) => !r.skipped).length;
  console.log(
    `✓ dockerfile-deps lockstep: ${checked} Dockerfile(s) in lockstep with workspace closure`,
  );
  return 0;
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main());
}

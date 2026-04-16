/**
 * Codemod runner — discovers applicable transforms for a project and
 * applies them across the source tree.
 *
 * Applicability is determined by comparing the installed version of each
 * codemod's target package (read from the project's `package.json` +
 * `node_modules`) against the codemod's `fromVersion` range. A codemod
 * is applicable when the *current* installed version satisfies
 * `fromVersion` — i.e. the project has not yet migrated.
 */

import { readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import semver from 'semver';
import { registry } from './registry.js';
import type { Codemod, CodemodApi, CodemodLogger, CodemodRunResult } from './types.js';

export interface RunOptions {
  /** Project root — the directory containing the user's package.json. */
  cwd: string;
  /** Globs to scan for transformable files (default: src/**\/*.{ts,tsx,js,jsx}). */
  include?: string[];
  /** When true, compute changes but do not write. */
  dryRun?: boolean;
  /** Restrict the run to a specific codemod by name. */
  only?: string;
  /** Logger to receive progress messages. */
  logger?: CodemodLogger;
}

const DEFAULT_INCLUDE = ['src/**/*.{ts,tsx,js,jsx,mjs,cjs}'];

const noop = (_: string): void => {
  /* intentional no-op */
};

const silentLogger: CodemodLogger = {
  info: noop,
  warn: noop,
  error: noop,
};

/**
 * Read the installed version of `packageName` from the user's project.
 * Resolution order:
 *   1. `node_modules/<pkg>/package.json` version (source of truth at runtime)
 *   2. `package.json` dependencies / devDependencies / peerDependencies
 *      (stripping leading `^` / `~` / range prefixes).
 * Returns `null` if the package is not listed at all.
 */
export async function readInstalledVersion(
  cwd: string,
  packageName: string,
): Promise<string | null> {
  // Try node_modules first
  const installedPkgPath = path.join(cwd, 'node_modules', packageName, 'package.json');
  try {
    const raw = await readFile(installedPkgPath, 'utf8');
    const parsed = JSON.parse(raw) as { version?: string };
    if (parsed.version) return parsed.version;
  } catch {
    // fall through
  }

  // Fall back to the declared range in the user's package.json
  const userPkgPath = path.join(cwd, 'package.json');
  try {
    const raw = await readFile(userPkgPath, 'utf8');
    const parsed = JSON.parse(raw) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
    };
    const declared =
      parsed.dependencies?.[packageName] ??
      parsed.devDependencies?.[packageName] ??
      parsed.peerDependencies?.[packageName];
    if (!declared) return null;
    // Extract a concrete version from common range prefixes.
    const match = declared.match(/(\d+\.\d+\.\d+(?:-[^\s]+)?)/);
    return match ? (match[1] ?? null) : null;
  } catch {
    return null;
  }
}

/**
 * Return codemods that apply to the given project state. A codemod
 * applies when its `package` is installed AND the installed version
 * satisfies its `fromVersion` range.
 */
export async function listApplicableCodemods(cwd: string): Promise<
  Array<{
    codemod: Codemod;
    installedVersion: string | null;
    applicable: boolean;
    reason: string;
  }>
> {
  const entries: Array<{
    codemod: Codemod;
    installedVersion: string | null;
    applicable: boolean;
    reason: string;
  }> = [];

  for (const codemod of registry) {
    const installedVersion = await readInstalledVersion(cwd, codemod.package);
    if (installedVersion === null) {
      entries.push({
        codemod,
        installedVersion: null,
        applicable: false,
        reason: `${codemod.package} not installed`,
      });
      continue;
    }
    const coerced = semver.coerce(installedVersion)?.version ?? installedVersion;
    if (semver.satisfies(coerced, codemod.fromVersion, { includePrerelease: true })) {
      entries.push({
        codemod,
        installedVersion: coerced,
        applicable: true,
        reason: `matches ${codemod.fromVersion}`,
      });
    } else {
      entries.push({
        codemod,
        installedVersion: coerced,
        applicable: false,
        reason: `${coerced} does not satisfy ${codemod.fromVersion}`,
      });
    }
  }
  return entries;
}

async function findFiles(cwd: string, patterns: string[]): Promise<string[]> {
  // Use dynamic import so we don't hard-require `fast-glob` at module load.
  // tinyglobby is part of the existing dep tree via Vite; fall back to fast-glob.
  let globber: (patterns: string[], opts: { cwd: string; absolute: boolean }) => Promise<string[]>;
  try {
    const mod = (await import('tinyglobby')) as {
      glob: typeof globber;
    };
    globber = mod.glob;
  } catch {
    const mod = (await import('fast-glob')) as unknown as {
      default: (patterns: string[], opts: { cwd: string; absolute: boolean }) => Promise<string[]>;
    };
    globber = mod.default;
  }
  return globber(patterns, { cwd, absolute: true });
}

async function applyCodemodToFile(
  codemod: Codemod,
  filePath: string,
  opts: { dryRun: boolean; logger: CodemodLogger },
): Promise<{ changed: boolean; error?: Error }> {
  if (codemod.match && !codemod.match(filePath)) {
    return { changed: false };
  }
  try {
    const stats = await stat(filePath);
    if (!stats.isFile()) return { changed: false };
    const source = await readFile(filePath, 'utf8');
    const api: CodemodApi = { filePath, logger: opts.logger };
    const next = codemod.transform(source, api);
    if (next === null || next === source) return { changed: false };
    if (!opts.dryRun) {
      await writeFile(filePath, next, 'utf8');
    }
    return { changed: true };
  } catch (error) {
    return { changed: false, error: error instanceof Error ? error : new Error(String(error)) };
  }
}

/**
 * Run all applicable codemods against a project. Returns a structured
 * summary with per-file outcomes.
 */
export async function runCodemods(options: RunOptions): Promise<CodemodRunResult> {
  const logger = options.logger ?? silentLogger;
  const include = options.include ?? DEFAULT_INCLUDE;
  const applicable = await listApplicableCodemods(options.cwd);

  const codemods = applicable.filter((a) => a.applicable).map((a) => a.codemod);
  const filtered = options.only ? codemods.filter((c) => c.name === options.only) : codemods;

  const result: CodemodRunResult = {
    applied: [],
    skipped: applicable.filter((a) => !a.applicable).map((a) => `${a.codemod.name} (${a.reason})`),
    changedFiles: 0,
    errored: 0,
    results: [],
  };

  if (filtered.length === 0) {
    logger.info('No codemods applicable to this project.');
    return result;
  }

  const files = await findFiles(options.cwd, include);
  logger.info(
    `Scanning ${files.length} file(s) with ${filtered.length} codemod(s)${options.dryRun ? ' (dry run)' : ''}...`,
  );

  for (const codemod of filtered) {
    let changed = 0;
    for (const file of files) {
      const outcome = await applyCodemodToFile(codemod, file, {
        dryRun: options.dryRun ?? false,
        logger,
      });
      if (outcome.error) {
        result.errored += 1;
        result.results.push({
          filePath: file,
          codemod: codemod.name,
          status: 'error',
          error: outcome.error.message,
        });
        logger.error(`[${codemod.name}] ${file}: ${outcome.error.message}`);
      } else if (outcome.changed) {
        changed += 1;
        result.changedFiles += 1;
        result.results.push({
          filePath: file,
          codemod: codemod.name,
          status: 'changed',
        });
      } else {
        result.results.push({
          filePath: file,
          codemod: codemod.name,
          status: 'unchanged',
        });
      }
    }
    result.applied.push(codemod.name);
    logger.info(`[${codemod.name}] ${changed} file(s) changed`);
  }

  return result;
}

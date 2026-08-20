/**
 * Fleet-scan write policy + sibling-repo discovery (GAP-349 residual).
 *
 * `revkg scan --fleet` walks sibling checkouts of `--root` (owner fleet layout).
 * Writes are opt-in: fleet mode is dry-run unless `--publish`, and `--publish`
 * is refused in CI unless `REVKG_ALLOW_WRITE=1`. This is the path a PR can
 * land without touching the production graph.
 */

import { basename, dirname, join } from 'node:path';
import { isDir, listDir, readJsonFile, readTextFile } from '../extractors/shared.js';

export interface ScanWritePolicy {
  /** When true, extractors may call applyScan / ingestEpisode. */
  write: boolean;
  /** When true, the CLI must not open a database pool. */
  dryRun: boolean;
}

export interface ResolveScanWritePolicyOptions {
  fleet: boolean;
  publish: boolean;
  dryRun: boolean;
  /** `CI=true` (GitHub Actions). Default false. */
  ci?: boolean;
  /** `REVKG_ALLOW_WRITE=1` owner override. Default false. */
  allowCiWrite?: boolean;
}

export function assertCiWriteAllowed(options: {
  ci?: boolean;
  allowCiWrite?: boolean;
  action: string;
}): void {
  if (options.ci && !options.allowCiWrite) {
    throw new Error(
      `refusing ${options.action} in CI (would write the graph). Owner override: REVKG_ALLOW_WRITE=1`,
    );
  }
}

export function resolveScanWritePolicy(options: ResolveScanWritePolicyOptions): ScanWritePolicy {
  if (options.publish && options.dryRun) {
    throw new Error('--publish and --dry-run are mutually exclusive');
  }

  if (options.fleet) {
    if (!options.publish) {
      return { write: false, dryRun: true };
    }
    assertCiWriteAllowed({
      ci: options.ci,
      allowCiWrite: options.allowCiWrite,
      action: '--publish',
    });
    return { write: true, dryRun: false };
  }

  if (options.dryRun) {
    return { write: false, dryRun: true };
  }
  return { write: true, dryRun: false };
}

export function isRepoRoot(path: string): boolean {
  return (
    isDir(join(path, '.git')) ||
    readTextFile(join(path, 'pnpm-workspace.yaml')) !== null ||
    readJsonFile(join(path, 'package.json')) !== null
  );
}

export interface FleetRepo {
  name: string;
  path: string;
}

/**
 * Discover fleet checkouts as siblings of `anchorRoot` (including the anchor
 * itself). Hidden directories are skipped. Matches the existing `revkg scan
 * --fleet` layout: a parent folder of repo checkouts.
 */
export function discoverFleetRepos(anchorRoot: string): FleetRepo[] {
  const parent = dirname(anchorRoot);
  const found: FleetRepo[] = [];
  for (const entry of listDir(parent)) {
    if (entry.startsWith('.')) continue;
    const path = join(parent, entry);
    if (isDir(path) && isRepoRoot(path)) {
      found.push({ name: entry, path });
    }
  }
  return found;
}

export function resolveScanTargets(
  root: string,
  options: { fleet: boolean; repo?: string },
): FleetRepo[] {
  if (options.fleet) {
    return discoverFleetRepos(root);
  }
  return [{ name: options.repo ?? basename(root), path: root }];
}

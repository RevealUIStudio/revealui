/**
 * Fleet-scan write policy (GAP-349 residual).
 *
 * `revkg scan --fleet` must default to dry-run so a PR/CI checkout cannot
 * write the production graph. `--publish` is the explicit owner write path
 * and is refused when `CI` is set unless an override env is present.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { discoverFleetRepos, isRepoRoot, resolveScanWritePolicy } from '../policy.js';

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'revkg-fleet-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe('resolveScanWritePolicy', () => {
  it('defaults --fleet to dry-run (no write) without --publish', () => {
    expect(resolveScanWritePolicy({ fleet: true, publish: false, dryRun: false })).toEqual({
      write: false,
      dryRun: true,
    });
  });

  it('treats explicit --dry-run the same as the fleet default', () => {
    expect(resolveScanWritePolicy({ fleet: true, publish: false, dryRun: true })).toEqual({
      write: false,
      dryRun: true,
    });
  });

  it('allows --fleet --publish outside CI', () => {
    expect(
      resolveScanWritePolicy({ fleet: true, publish: true, dryRun: false, ci: false }),
    ).toEqual({ write: true, dryRun: false });
  });

  it('refuses --fleet --publish in CI without an override', () => {
    expect(() =>
      resolveScanWritePolicy({ fleet: true, publish: true, dryRun: false, ci: true }),
    ).toThrow(/CI/);
  });

  it('allows --fleet --publish in CI when REVKG_ALLOW_WRITE is set', () => {
    expect(
      resolveScanWritePolicy({
        fleet: true,
        publish: true,
        dryRun: false,
        ci: true,
        allowCiWrite: true,
      }),
    ).toEqual({ write: true, dryRun: false });
  });

  it('rejects --publish combined with --dry-run', () => {
    expect(() => resolveScanWritePolicy({ fleet: true, publish: true, dryRun: true })).toThrow(
      /mutually exclusive/,
    );
  });

  it('keeps single-repo scan writable unless --dry-run', () => {
    expect(resolveScanWritePolicy({ fleet: false, publish: false, dryRun: false })).toEqual({
      write: true,
      dryRun: false,
    });
    expect(resolveScanWritePolicy({ fleet: false, publish: false, dryRun: true })).toEqual({
      write: false,
      dryRun: true,
    });
  });
});

describe('discoverFleetRepos', () => {
  it('finds sibling repo roots and skips hidden / non-repo dirs', () => {
    const parent = makeTempDir();
    const anchor = join(parent, 'revealui');
    mkdirSync(anchor);
    writeFileSync(join(anchor, 'package.json'), '{"name":"revealui"}');

    const agency = join(parent, 'agency');
    mkdirSync(agency);
    writeFileSync(join(agency, 'package.json'), '{"name":"agency"}');

    const hidden = join(parent, '.hidden-repo');
    mkdirSync(hidden);
    writeFileSync(join(hidden, 'package.json'), '{"name":"hidden"}');

    const notes = join(parent, 'notes');
    mkdirSync(notes);
    writeFileSync(join(notes, 'readme.txt'), 'not a repo');

    const found = discoverFleetRepos(anchor);
    expect(found.map((r) => r.name).sort()).toEqual(['agency', 'revealui']);
    expect(found.every((r) => isRepoRoot(r.path))).toBe(true);
  });

  it('treats a git checkout without package.json as a repo root', () => {
    const parent = makeTempDir();
    const repo = join(parent, 'bare-git');
    mkdirSync(join(repo, '.git'), { recursive: true });
    expect(isRepoRoot(repo)).toBe(true);
    expect(discoverFleetRepos(repo).map((r) => r.name)).toEqual(['bare-git']);
  });
});

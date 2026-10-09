import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { evaluateComparePayload } from '../commit-signatures.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const script = path.join(repoRoot, 'scripts/ci/commit-signatures.mjs');
const workflowPath = path.join(repoRoot, '.github/workflows/commit-signatures.yml');

function commit(sha: string, verified: boolean, reason: string) {
  return { sha, commit: { verification: { verified, reason } } };
}

describe('evaluateComparePayload', () => {
  it('accepts a complete range of GitHub-verified commits', () => {
    const result = evaluateComparePayload({
      total_commits: 2,
      commits: [commit('aaa', true, 'valid'), commit('bbb', true, 'valid')],
    });
    expect(result).toEqual({ ok: true, reason: 'ok', unverified: [] });
  });

  it('accepts an empty range', () => {
    expect(evaluateComparePayload({ total_commits: 0, commits: [] })).toEqual({
      ok: true,
      reason: 'ok',
      unverified: [],
    });
  });

  it('rejects an unverified commit and a missing verification object', () => {
    const result = evaluateComparePayload({
      total_commits: 2,
      commits: [commit('ccc', false, 'unsigned'), { sha: 'ddd', commit: {} }],
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('unverified');
    expect(result.unverified).toEqual([
      { sha: 'ccc', reason: 'unsigned' },
      { sha: 'ddd', reason: 'missing' },
    ]);
  });

  it('rejects a partial compare page', () => {
    const result = evaluateComparePayload({
      total_commits: 3,
      commits: [commit('eee', true, 'valid')],
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('partial-range');
  });

  it('rejects a payload that is not a compare result', () => {
    expect(evaluateComparePayload(null).reason).toBe('missing-commits');
    expect(evaluateComparePayload({ commits: 'nope' }).reason).toBe('missing-commits');
    expect(evaluateComparePayload({ total_commits: 1 }).reason).toBe('missing-commits');
  });
});

describe('commit signature CLI', () => {
  it('exits 0 for a verified range and 1 for an unsigned commit', () => {
    const ok = spawnSync(process.execPath, [script], {
      input: JSON.stringify({ total_commits: 1, commits: [commit('fff', true, 'valid')] }),
      encoding: 'utf8',
    });
    expect(ok.status).toBe(0);

    const bad = spawnSync(process.execPath, [script], {
      input: JSON.stringify({
        total_commits: 1,
        commits: [commit('ggg', false, 'unsigned')],
      }),
      encoding: 'utf8',
    });
    expect(bad.status).toBe(1);
    expect(bad.stderr).toContain('ggg');
    expect(bad.stderr).not.toContain('unsigned commit message');
  });
});

describe('commit signature workflow', () => {
  const yml = readFileSync(workflowPath, 'utf8');

  it('is a required-check-ready job named Commit signatures', () => {
    expect(yml).toContain('name: Commit signatures');
    expect(yml).toContain('pull_request_target:');
    expect(yml).not.toContain('\n  pull_request:\n');
    expect(yml).toContain('cancel-in-progress: false');
  });

  it('reads the checker from the base commit and does not check out the pull request', () => {
    expect(yml).toContain(['ref: ', '$', '{{ github.event.pull_request.base.sha }}'].join(''));
    expect(yml).not.toContain(['ref: ', '$', '{{ github.event.pull_request.head.sha }}'].join(''));
    expect(yml).not.toContain('github.event.pull_request.head.repo');
    expect(yml).toContain('persist-credentials: false');
    expect(yml).toContain('node scripts/ci/commit-signatures.mjs');
    const checkout = yml.indexOf('uses: actions/checkout');
    expect(checkout).toBeGreaterThan(0);
    expect(yml.indexOf('uses: actions/checkout', checkout + 1)).toBe(-1);
  });

  it('uses contents read only', () => {
    const start = yml.indexOf('\npermissions:\n');
    const end = yml.indexOf('\nconcurrency:', start);
    const permissions = yml.slice(start, end);
    expect(permissions).toContain('contents: read');
    expect(permissions).not.toContain('write');
  });
});

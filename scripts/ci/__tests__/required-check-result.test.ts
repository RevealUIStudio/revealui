import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { evaluateRequiredResult } from '../required-check-result.mjs';

const script = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../required-check-result.mjs',
);

function decide(
  input: Parameters<typeof evaluateRequiredResult>[0],
): ReturnType<typeof evaluateRequiredResult> {
  return evaluateRequiredResult(input);
}

const base = {
  check: 'unit',
  changes: 'success',
  fullSuite: 'true',
  result: 'success',
  eventName: 'pull_request',
  ref: 'refs/pull/1/merge',
  baseRef: 'test',
};

describe('evaluateRequiredResult', () => {
  it('passes a green standard check', () => {
    expect(decide(base).ok).toBe(true);
  });

  it('passes a skipped standard check only when the suite was not scheduled', () => {
    expect(decide({ ...base, result: 'skipped', fullSuite: 'false' }).ok).toBe(true);
    expect(decide({ ...base, result: 'skipped', fullSuite: 'true' }).ok).toBe(false);
  });

  it('fails when the classifier job did not succeed', () => {
    expect(decide({ ...base, changes: 'failure' }).ok).toBe(false);
  });

  it('allows a skipped integration run on push to test', () => {
    const decision = decide({
      ...base,
      check: 'integration',
      result: 'skipped',
      fullSuite: 'true',
      eventName: 'push',
      ref: 'refs/heads/test',
    });
    expect(decision.ok).toBe(true);
  });

  it('rejects a skipped integration run on a full pull request suite', () => {
    const decision = decide({
      ...base,
      check: 'integration',
      result: 'skipped',
      fullSuite: 'true',
      eventName: 'pull_request',
    });
    expect(decision.ok).toBe(false);
  });

  it('allows skipped coverage off main and rejects it on main', () => {
    expect(
      decide({
        ...base,
        check: 'coverage',
        result: 'skipped',
        fullSuite: 'true',
        ref: 'refs/heads/test',
        baseRef: 'test',
      }).ok,
    ).toBe(true);
    expect(
      decide({
        ...base,
        check: 'coverage',
        result: 'skipped',
        fullSuite: 'true',
        ref: 'refs/heads/main',
        baseRef: '',
      }).ok,
    ).toBe(false);
  });

  it('passes docker when the matrix succeeded or was skipped', () => {
    expect(decide({ ...base, check: 'docker', result: 'success' }).ok).toBe(true);
    expect(decide({ ...base, check: 'docker', result: 'skipped', changes: 'failure' }).ok).toBe(
      true,
    );
    expect(decide({ ...base, check: 'docker', result: 'failure' }).ok).toBe(false);
  });

  it('rejects an unknown check id', () => {
    expect(decide({ ...base, check: 'exit-zero' }).ok).toBe(false);
  });
});

describe('required-check-result CLI', () => {
  it('exits 0 for a green unit result', () => {
    const result = spawnSync(process.execPath, [script], {
      encoding: 'utf8',
      env: {
        ...process.env,
        CHECK: 'unit',
        CHANGES: 'success',
        FULL_SUITE: 'true',
        RESULT: 'success',
      },
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Unit Tests green');
  });
});

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

function read(rel: string): string {
  return readFileSync(path.join(repoRoot, rel), 'utf8');
}

describe('gate scripts execute from the base commit', () => {
  const ci = read('.github/workflows/ci.yml');
  const ds = read('.github/workflows/ds.yml');
  const backflow = read('.github/workflows/backflow-merge-method-guard.yml');
  const leaks = read('.github/workflows/check-client-leaks.yml');
  const archive = read('.github/workflows/archive-check.yml');
  const review = read('.github/workflows/security-review-gate.yml');

  it('keeps the required check names', () => {
    expect(ci).toContain('name: Detect expensive-suite paths');
    expect(ds).toContain('name: Detect design-system paths');
    expect(backflow).toContain('name: Backflow merge-commit policy');
    expect(leaks).toContain('name: Client / prospect name leak scan');
    expect(archive).toContain('name: Archive Check');
    expect(review).toContain('name: Security review gate');
  });

  it('classifies pull request files with the base expensive-suite copy', () => {
    expect(ci).toContain('path: trusted-classifier');
    expect(ci).toContain('github.event.pull_request.base.sha || github.sha');
    expect(ci).toContain('node trusted-classifier/scripts/ci/expensive-suite.mjs');
    expect(ci).not.toContain('node scripts/ci/expensive-suite.mjs');
    expect(ds).toContain('node trusted-classifier/scripts/ci/expensive-suite.mjs --ds');
    expect(ds).not.toContain('node scripts/ci/expensive-suite.mjs');
  });

  it('runs the backflow guard from the trusted checkout', () => {
    expect(backflow).toContain('path: trusted-guard');
    expect(backflow).toContain('github.event.pull_request.base.sha');
    expect(backflow).toContain(
      'node trusted-guard/scripts/validate/backflow-merge-method-guard.cjs --mode=pr',
    );
    expect(backflow).toContain(
      'node trusted-guard/scripts/validate/backflow-merge-method-guard.cjs --mode=ancestry',
    );
    expect(backflow).not.toContain('github.event.pull_request.head.sha');
    expect(backflow).not.toContain('node scripts/validate/backflow-merge-method-guard.cjs');
  });

  it('scans pull request changes with the base leak scanner', () => {
    expect(leaks).toContain('path: scan-tree');
    expect(leaks).toContain('path: trusted-scanner');
    expect(leaks).toContain('github.event.pull_request.base.sha || github.sha');
    expect(leaks).toContain('bash trusted-scanner/scripts/check-client-leaks.sh scan-tree');
    expect(leaks).not.toContain('uses: RevealUIStudio/.github/.github/actions/check-client-leaks@');
  });

  it('scans pull request changes with the base archive gate and gates resolver', () => {
    expect(archive).toContain('name: Checkout trusted gate');
    expect(archive).toContain('github.event.pull_request.base.sha || github.sha');
    expect(archive).toContain('scripts/validate/gates-resolver.cjs');
    expect(archive).toContain('path: scan-tree');
    expect(archive).toContain('--root "$GITHUB_WORKSPACE/scan-tree"');
    expect(ci).toContain('path: trusted-gate');
    expect(ci).toContain(
      'install -m 0644 scripts/validate/gates-resolver.cjs "$GITHUB_WORKSPACE/scripts/validate/gates-resolver.cjs"',
    );
    expect(ci).toContain(
      'install -m 0644 packages/harnesses/dist/gates/index.cjs "$GITHUB_WORKSPACE/packages/harnesses/dist/gates/index.cjs"',
    );
  });

  it('keeps the security review gate on the base commit copy', () => {
    expect(review).toContain(['ref: ', '$', '{{ github.event.pull_request.base.sha }}'].join(''));
    expect(review).toContain('scripts/validate/gates-resolver.cjs');
  });
});

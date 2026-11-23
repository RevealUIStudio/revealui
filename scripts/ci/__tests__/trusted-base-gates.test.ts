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
  const security = read('.github/workflows/security.yml');
  const docker = read('.github/workflows/docker.yml');
  const judge = read('.github/workflows/trusted-gate-judge.yml');

  it('keeps every required check name byte for byte', () => {
    const owned: Array<[string, string]> = [
      ['.github/workflows/ci.yml', 'name: Quality'],
      ['.github/workflows/ci.yml', 'name: Typecheck'],
      ['.github/workflows/ci.yml', 'name: Unit Tests'],
      ['.github/workflows/ci.yml', 'name: Build'],
      ['.github/workflows/ci.yml', 'name: Integration Tests'],
      ['.github/workflows/ci.yml', 'name: E2E Smoke'],
      ['.github/workflows/ci.yml', 'name: Accessibility (E2E)'],
      ['.github/workflows/ci.yml', 'name: Coverage'],
      ['.github/workflows/security.yml', 'name: Security Gate'],
      ['.github/workflows/security.yml', 'name: Secret Scanning (Gitleaks)'],
      ['.github/workflows/ci.yml', 'name: Visual Regression (E2E)'],
      ['.github/workflows/ci.yml', 'name: Drizzle Migrations'],
      ['.github/workflows/security.yml', 'name: CodeQL'],
      ['.github/workflows/security.yml', 'name: Dependency Review'],
      ['.github/workflows/no-submodules.yml', 'name: Submodule Audit'],
      ['.github/workflows/check-client-leaks.yml', 'name: Client / prospect name leak scan'],
      ['.github/workflows/security-review-gate.yml', 'name: Security review gate'],
      ['.github/workflows/docker.yml', 'name: Docker images'],
      ['.github/workflows/backflow-merge-method-guard.yml', 'name: Backflow merge-commit policy'],
      ['.github/workflows/promotion-gate.yml', 'name: promotion-gate'],
    ];
    for (const [file, marker] of owned) {
      expect(read(file)).toContain(marker);
    }
    const backflowCaller = read('.github/workflows/backflow-main-into-test.yml');
    expect(backflowCaller).toContain('\n  backflow:\n');
    expect(backflowCaller).toContain('backflow / backflow-current');
    const promotion = read('.github/workflows/promotion-gate.yml');
    expect(promotion).toContain('\n  promotion-gate:\n');
    expect(promotion).toContain('branches: [main]');
    expect(judge.includes('name: Quality')).toBe(false);
    expect(judge.includes('name: Unit Tests')).toBe(false);
  });

  it('keeps the required check names', () => {
    expect(ci).toContain('name: Detect expensive-suite paths');
    expect(ci).toContain('name: Unit Tests');
    expect(ci).toContain('name: Build');
    expect(ci).toContain('name: Drizzle Migrations');
    expect(ci).toContain('name: E2E Smoke');
    expect(ci).toContain('name: Coverage');
    expect(ci).toContain('name: Quality');
    expect(ds).toContain('name: Detect design-system paths');
    expect(backflow).toContain('name: Backflow merge-commit policy');
    expect(leaks).toContain('name: Client / prospect name leak scan');
    expect(archive).toContain('name: Archive Check');
    expect(review).toContain('name: Security review gate');
    expect(security).toContain('name: Security Gate');
    expect(docker).toContain('name: Docker images');
    expect(judge).toContain('name: Trusted gate judge');
  });

  it('classifies pull request files with the base expensive-suite copy', () => {
    expect(ci).toContain('path: trusted-classifier');
    expect(ci).toContain('github.event.pull_request.base.sha || github.sha');
    expect(ci).toContain('node trusted-classifier/scripts/ci/expensive-suite.mjs');
    expect(ci).toContain('node trusted-classifier/scripts/ci/expensive-suite.mjs --promotion-skip');
    expect(ci.includes('node scripts/ci/expensive-suite.mjs')).toBe(false);
    expect(ds).toContain('node trusted-classifier/scripts/ci/expensive-suite.mjs --ds');
    expect(ds.includes('node scripts/ci/expensive-suite.mjs')).toBe(false);
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
    expect(backflow.includes('github.event.pull_request.head.sha')).toBe(false);
    expect(backflow.includes('node scripts/validate/backflow-merge-method-guard.cjs')).toBe(false);
  });

  it('scans pull request changes with the base leak scanner', () => {
    expect(leaks).toContain('path: scan-tree');
    expect(leaks).toContain('path: trusted-scanner');
    expect(leaks).toContain('github.event.pull_request.base.sha || github.sha');
    expect(leaks).toContain('bash trusted-scanner/scripts/check-client-leaks.sh scan-tree');
    expect(leaks.includes('uses: RevealUIStudio/.github/.github/actions/check-client-leaks@')).toBe(
      false,
    );
  });

  it('scans pull request changes with the base archive gate and gates resolver', () => {
    expect(archive).toContain('name: Checkout trusted gate');
    expect(archive).toContain('github.event.pull_request.base.sha || github.sha');
    expect(archive).toContain('scripts/validate/gates-resolver.cjs');
    expect(archive).toContain('path: scan-tree');
    expect(archive).toContain('--root "$GITHUB_WORKSPACE/scan-tree"');
  });

  it('checks the security review gate out at the workflow commit', () => {
    const workflowRef = ['ref: ', '$', '{{ github.workflow_sha }}'].join('');
    const recordedBase = ['ref: ', '$', '{{ github.event.pull_request.base.sha }}'].join('');
    expect(review).toContain(workflowRef);
    expect(review.includes(recordedBase)).toBe(false);
    expect(review).toContain('echo "workflow_sha=');
    expect(review).toContain('scripts/validate/gates-resolver.cjs');
  });

  it('runs the security gate script from the base checkout', () => {
    expect(security).toContain('path: trusted-judge');
    expect(security).toContain('github.event.pull_request.base.sha || github.sha');
    expect(security).toContain(
      'cp -a trusted-judge/scripts/gates/security-gate.ts scripts/gates/security-gate.ts',
    );
    expect(security).toContain('pnpm exec tsx scripts/gates/security-gate.ts');
    expect(security.includes('pnpm gate:security')).toBe(false);
  });

  it('runs quality validators from the base checkout by file path', () => {
    expect(ci).toContain('# trusted-judge:begin');
    expect(ci).toContain('# trusted-judge:end');
    expect(ci).toContain('path: trusted-judge');
    expect(ci).toContain('scripts/validate/');
    expect(ci).toContain('node "$script"');
    const quality = ci.slice(ci.indexOf('\n  quality:\n'), ci.indexOf('\n  db-migrations:\n'));
    expect(quality.includes('\n        run: pnpm validate:')).toBe(false);
  });

  it('loads result decisions from the base script before any introducing copy', () => {
    const trustedAt = ci.indexOf('node trusted-result/scripts/ci/required-check-result.mjs');
    const headAt = ci.indexOf('node head-result/scripts/ci/required-check-result.mjs');
    expect(trustedAt).toBeGreaterThan(0);
    expect(headAt).toBeGreaterThan(trustedAt);
    expect(docker).toContain('CHECK: docker');
    expect(
      docker.indexOf('node trusted-result/scripts/ci/required-check-result.mjs'),
    ).toBeGreaterThan(0);
  });

  it('keeps the base-loaded judge on pull_request_target with read-only token', () => {
    expect(judge).toContain('pull_request_target:');
    expect(judge).toContain('contents: read');
    expect(judge).toContain('cancel-in-progress: false');
    expect(judge).toContain('persist-credentials: false');
    const workflowRef = ['ref: $', '{{ github.workflow_sha }}'].join('');
    const recordedBase = ['ref: $', '{{ github.event.pull_request.base.sha }}'].join('');
    const headRef = ['ref: $', '{{ github.event.pull_request.head.sha }}'].join('');
    const token = ['GH_TOKEN: $', '{{ secrets.GITHUB_TOKEN }}'].join('');
    expect(judge).toContain(workflowRef);
    expect(judge.includes(recordedBase)).toBe(false);
    expect(judge).toContain('actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0 # v7.0.0');
    expect(judge).toContain(token);
    expect(judge.includes(headRef)).toBe(false);
    expect(judge.includes('pull-requests: write')).toBe(false);
    expect(judge.includes('permissions:\n  contents: write')).toBe(false);
  });

  it('checks the trusted gate judge out at github.workflow_sha', () => {
    const workflowRef = ['ref: $', '{{ github.workflow_sha }}'].join('');
    const recordedBase = ['ref: $', '{{ github.event.pull_request.base.sha }}'].join('');
    const headRef = ['ref: $', '{{ github.event.pull_request.head.sha }}'].join('');
    expect(judge).toContain('name: Checkout base judge');
    expect(judge).toContain(workflowRef);
    expect(judge).toContain('echo "workflow_sha=');
    expect(judge).toContain('persist-credentials: false');
    expect(judge.includes(recordedBase)).toBe(false);
    expect(judge.includes(headRef)).toBe(false);
  });

  it('checks label-guard scripts out at the workflow commit except on review', () => {
    const guard = read('.github/workflows/sec-audit-label-guard.yml');
    const refLine = guard.split('\n').find((line) => line.includes('ref: $'));
    const reviewFallback = [
      "github.event_name == 'pull_request_review' && github.event.pull_request.base.sha || github.workflow_sha",
    ].join('');
    const headRef = ['github.event.pull_request.head.sha'].join('');
    expect(refLine).toContain('github.workflow_sha');
    expect(refLine).toContain(reviewFallback);
    expect(refLine?.includes(headRef)).toBe(false);
  });
});

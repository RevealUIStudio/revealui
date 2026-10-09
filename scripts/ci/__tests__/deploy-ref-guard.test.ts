import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

describe('production deploy ref guard', () => {
  const workflow = readFileSync(path.join(repoRoot, '.github/workflows/deploy.yml'), 'utf8');

  it('fails closed unless the ref is refs/heads/main', () => {
    expect(workflow).toContain('name: Production ref guard');
    expect(workflow).toContain(['[ "', '$', '{GITHUB_REF}" != "refs/heads/main" ]'].join(''));
    expect(workflow).toContain('Production deploy jobs run only when the ref is refs/heads/main.');
    expect(workflow).toContain('exit 1');
  });

  it('makes every production job wait for the ref guard', () => {
    for (const needs of [
      'needs: [production-ref, detect]',
      'needs: [production-ref, validate]',
      'needs: [production-ref]',
      'needs: [production-ref, validate, migrate, detect]',
      'needs: [production-ref, detect, deploy]',
    ]) {
      expect(workflow).toContain(needs);
    }
  });

  it('reads production secrets only from jobs in the production environment', () => {
    const envBlock = workflow.slice(workflow.indexOf('\nenv:\n'), workflow.indexOf('\njobs:\n'));
    expect(envBlock).not.toContain('VERCEL_TOKEN');
    expect(envBlock).not.toContain('PROD_POSTGRES_URL');
    expect(envBlock).not.toContain('VERCEL_ORG_ID');

    const turbo = ['TURBO_TOKEN: ', '$', '{{ secrets.TURBO_TOKEN || secrets.VERCEL_TOKEN }}'].join(
      '',
    );
    for (const [start, end] of [
      ['\n  validate:\n', '\n  migrate:\n'],
      ['\n  migrate:\n', '\n  detect:\n'],
      ['\n  deploy:\n', '\n  smoke-test:\n'],
    ] as const) {
      const block = sliceJob(workflow, start, end);
      expect(block).toContain(turbo);
    }

    for (const [start, end] of [
      ['\n  validate:\n', '\n  migrate:\n'],
      ['\n  migrate:\n', '\n  detect:\n'],
      ['\n  smoke-test:\n', '\n  design-verify:\n'],
    ] as const) {
      expect(sliceJob(workflow, start, end)).toContain('environment: production');
    }

    expect(sliceJob(workflow, '\n  deploy:\n', '\n  smoke-test:\n')).toContain('name: production');

    for (const [start, end] of [
      ['\n  production-ref:\n', '\n  validate:\n'],
      ['\n  detect:\n', '\n  deploy:\n'],
      ['\n  design-verify:\n', '\n  summary:\n'],
    ] as const) {
      expect(sliceJob(workflow, start, end)).not.toContain('environment:');
    }
    const summaryAt = workflow.indexOf('\n  summary:\n');
    expect(summaryAt).toBeGreaterThanOrEqual(0);
    expect(workflow.slice(summaryAt)).not.toContain('environment:');
  });
});

function sliceJob(workflow: string, startMarker: string, endMarker: string): string {
  const start = workflow.indexOf(startMarker);
  expect(start).toBeGreaterThanOrEqual(0);
  const end = workflow.indexOf(endMarker, start + startMarker.length);
  expect(end).toBeGreaterThan(start);
  return workflow.slice(start, end);
}

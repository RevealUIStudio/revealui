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
});

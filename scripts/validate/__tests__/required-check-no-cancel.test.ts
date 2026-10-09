import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

function concurrencyBlock(yml: string): string {
  const start = yml.indexOf('\nconcurrency:');
  expect(start).toBeGreaterThanOrEqual(0);
  const rest = yml.slice(start + 1);
  const next = rest.search(/\n[A-Za-z]/);
  return next === -1 ? rest : rest.slice(0, next);
}

describe('required-check workflows do not cancel in-flight runs', () => {
  it.each([
    '.github/workflows/security.yml',
    '.github/workflows/security-review-gate.yml',
    '.github/workflows/commit-signatures.yml',
  ])('%s sets cancel-in-progress: false', (rel) => {
    const yml = readFileSync(path.join(repoRoot, rel), 'utf8');
    const block = concurrencyBlock(yml);
    expect(block).toContain('cancel-in-progress: false');
    expect(block).not.toContain('cancel-in-progress: true');
  });
});

describe('required PR checks rerun after a base branch edit', () => {
  it.each([
    '.github/workflows/ci.yml',
    '.github/workflows/docker.yml',
    '.github/workflows/no-submodules.yml',
    '.github/workflows/check-client-leaks.yml',
    '.github/workflows/backflow-main-into-test.yml',
    '.github/workflows/commit-signatures.yml',
  ])('%s includes edited without dropping ordinary PR events', (rel) => {
    const yml = readFileSync(path.join(repoRoot, rel), 'utf8');
    const trigger = yml.match(/ {2}pull_request(?:_target)?:\n(?: {4}[^\n]+\n)+/g)?.[0];
    expect(trigger).toBeDefined();
    for (const event of ['opened', 'synchronize', 'reopened', 'edited']) {
      expect(trigger).toContain(event);
    }
  });
});

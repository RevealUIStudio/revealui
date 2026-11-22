import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import {
  compareLockedSurfaces,
  extractJob,
  extractRegion,
  LOCKED_FILES,
  LOCKED_JOBS,
  LOCKED_REGIONS,
} from '../trusted-gate-judge.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const temps: string[] = [];

function tempDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'trusted-gate-judge-'));
  temps.push(dir);
  return dir;
}

function lockedRels(): string[] {
  const rels = new Set<string>(LOCKED_FILES);
  for (const entry of LOCKED_JOBS) rels.add(entry.file);
  for (const region of LOCKED_REGIONS) rels.add(region.file);
  return [...rels];
}

function copyLocked(dest: string): void {
  for (const rel of lockedRels()) {
    const from = path.join(repoRoot, rel);
    const to = path.join(dest, rel);
    mkdirSync(path.dirname(to), { recursive: true });
    cpSync(from, to);
  }
}

afterEach(() => {
  for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('extractJob', () => {
  it('returns one job and stops before the next job key', () => {
    const text = ['jobs:', '  alpha:', '    name: Alpha', '  beta:', '    name: Beta', ''].join(
      '\n',
    );
    expect(extractJob(text, 'alpha')).toBe('  alpha:\n    name: Alpha');
    expect(extractJob(text, 'missing')).toBeNull();
  });
});

describe('extractRegion', () => {
  it('returns the marked block once', () => {
    const text = 'before\n# trusted-judge:begin\nstep\n# trusted-judge:end\nafter\n';
    expect(extractRegion(text, '# trusted-judge:begin', '# trusted-judge:end')).toBe(
      '# trusted-judge:begin\nstep\n# trusted-judge:end',
    );
    expect(extractRegion('no markers', '# trusted-judge:begin', '# trusted-judge:end')).toBeNull();
  });
});

describe('compareLockedSurfaces', () => {
  it('accepts the repository compared with itself', () => {
    const report = compareLockedSurfaces(repoRoot, repoRoot);
    expect(report.errors).toEqual([]);
    expect(report.ok).toBe(true);
  });

  it('rejects a head result job that no longer matches base', () => {
    const base = tempDir();
    const head = tempDir();
    copyLocked(base);
    copyLocked(head);
    const ciPath = path.join(head, '.github/workflows/ci.yml');
    const ci = readFileSync(ciPath, 'utf8');
    writeFileSync(ciPath, ci.replace('CHECK: unit', 'CHECK: unit-weakened'));
    const report = compareLockedSurfaces(base, head);
    expect(report.ok).toBe(false);
    expect(report.errors.some((error) => error.includes('job test-unit-result'))).toBe(true);
  });

  it('rejects a head classifier that no longer matches base', () => {
    const base = tempDir();
    const head = tempDir();
    copyLocked(base);
    copyLocked(head);
    const classifier = path.join(head, 'scripts/ci/expensive-suite.mjs');
    writeFileSync(
      classifier,
      `${readFileSync(classifier, 'utf8')}\nexport const weakened = true;\n`,
    );
    const report = compareLockedSurfaces(base, head);
    expect(report.ok).toBe(false);
    expect(report.errors.some((error) => error.includes('expensive-suite.mjs'))).toBe(true);
  });
});

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { computeCoverage } from '../messaging-coverage.ts';

describe('computeCoverage', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'msgcov-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function write(rel: string, content: string): string {
    const abs = path.join(tmpDir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content, 'utf8');
    return abs;
  }

  it('counts raw vs typed throws', () => {
    const a = write(
      'a.ts',
      `
      function f() {
        throw new Error('raw 1');
        throw new Error('raw 2');
        throw new ValidationError('typed 1');
      }
    `,
    );
    const b = write(
      'b.ts',
      `
      function g() {
        throw new AccessError('typed 2');
        throw new AccessError('typed 3');
      }
    `,
    );
    const result = computeCoverage([a, b]);
    expect(result.rawThrows).toBe(2);
    expect(result.typedThrows).toBe(3);
    expect(result.totalThrows).toBe(5);
    expect(result.coveragePercent).toBe(60);
  });

  it('does not confuse typed throws for raw throws', () => {
    const a = write('a.ts', `throw new SpecificError('x');`);
    const result = computeCoverage([a]);
    expect(result.rawThrows).toBe(0);
    expect(result.typedThrows).toBe(1);
  });

  it('reports 100% when there are no throws', () => {
    const a = write('a.ts', 'const x = 1;');
    const result = computeCoverage([a]);
    expect(result.totalThrows).toBe(0);
    expect(result.coveragePercent).toBe(100);
  });

  it('ranks files by raw-throw count', () => {
    const a = write('a.ts', `throw new Error('1');`);
    const b = write(
      'b.ts',
      `
      throw new Error('1');
      throw new Error('2');
      throw new Error('3');
    `,
    );
    const result = computeCoverage([a, b]);
    expect(result.topRawThrowFiles[0]?.file).toContain('b.ts');
    expect(result.topRawThrowFiles[0]?.count).toBe(3);
    expect(result.topRawThrowFiles[1]?.count).toBe(1);
  });

  it('captures typed-class histogram', () => {
    const a = write(
      'a.ts',
      `
      throw new ValidationError('1');
      throw new ValidationError('2');
      throw new AccessError('3');
    `,
    );
    const result = computeCoverage([a]);
    expect(result.typedClassHistogram[0]?.name).toBe('ValidationError');
    expect(result.typedClassHistogram[0]?.count).toBe(2);
    expect(result.typedClassHistogram[1]?.name).toBe('AccessError');
  });
});

describe('committed baseline snapshot', () => {
  it('exists and has the expected shape', () => {
    const snapshotPath = path.resolve(
      import.meta.dirname,
      '../../../docs/reference/messaging-coverage.snapshot.json',
    );
    expect(fs.existsSync(snapshotPath)).toBe(true);
    const snap = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
    expect(snap).toHaveProperty('totalThrows');
    expect(snap).toHaveProperty('rawThrows');
    expect(snap).toHaveProperty('typedThrows');
    expect(snap).toHaveProperty('coveragePercent');
    expect(typeof snap.coveragePercent).toBe('number');
  });
});

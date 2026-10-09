import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const source = path.join(repoRoot, 'scripts/validate/gates-resolver.cjs');
const temps: string[] = [];

function makeCheckout(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'gates-resolver-'));
  temps.push(dir);
  mkdirSync(path.join(dir, 'scripts/validate'), { recursive: true });
  mkdirSync(path.join(dir, 'packages/harnesses/dist/gates'), { recursive: true });
  writeFileSync(
    path.join(dir, 'scripts/validate/gates-resolver.cjs'),
    readFileSync(source, 'utf8'),
  );
  return dir;
}

function resolveMarker(dir: string): string {
  const script = path.join(dir, 'scripts/validate/gates-resolver.cjs');
  const env = { ...process.env };
  delete env.REVEALUI_HARNESSES_DIR;
  const result = spawnSync(
    process.execPath,
    [
      '-e',
      `const mod = require(${JSON.stringify(script)}).resolveGatesModule(); process.stdout.write(mod && mod.marker ? String(mod.marker) : 'null');`,
    ],
    { encoding: 'utf8', env },
  );
  expect(result.status).toBe(0);
  return result.stdout;
}

afterEach(() => {
  for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('isResolvedInside', () => {
  const { isResolvedInside } = require('../gates-resolver.cjs') as {
    isResolvedInside: (root: string, target: string) => boolean;
  };

  it('accepts the checkout root and a child path', () => {
    expect(isResolvedInside('/repo', '/repo')).toBe(true);
    expect(isResolvedInside('/repo', '/repo/packages/harnesses/dist/gates/index.cjs')).toBe(true);
  });

  it('rejects a sibling path that only shares a prefix', () => {
    expect(isResolvedInside('/repo', '/repo-evil/index.cjs')).toBe(false);
    expect(isResolvedInside('/repo', '/other/index.cjs')).toBe(false);
  });
});

describe('resolveGatesModule checkout confinement', () => {
  it('loads a bundle that lives inside the checkout', () => {
    const dir = makeCheckout();
    writeFileSync(
      path.join(dir, 'packages/harnesses/dist/gates/index.cjs'),
      "module.exports = { marker: 'trusted' };\n",
    );
    expect(resolveMarker(dir)).toBe('trusted');
  });

  it('ignores a bundle symlink that resolves outside the checkout', () => {
    const dir = makeCheckout();
    const outsideDir = mkdtempSync(path.join(tmpdir(), 'gates-outside-'));
    temps.push(outsideDir);
    const outside = path.join(outsideDir, 'index.cjs');
    writeFileSync(outside, "module.exports = { marker: 'escaped' };\n");
    symlinkSync(outside, path.join(dir, 'packages/harnesses/dist/gates/index.cjs'));
    expect(resolveMarker(dir)).toBe('null');
  });
});

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runCli } from '../cli';

describe('runCli', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'leakcli-'));
    mkdirSync(join(dir, 'src'), { recursive: true });
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('returns 0 + OK for a clean tree', () => {
    writeFileSync(join(dir, 'src', 'ok.ts'), 'all clean here\n');
    const r = runCli([dir], dir);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('OK');
  });

  it('returns 1 and reports a leak (text mode)', () => {
    writeFileSync(join(dir, 'src', 'bad.ts'), "const h = '/home/alice/x';\n");
    const r = runCli([dir], dir);
    expect(r.code).toBe(1);
    expect(r.stdout).toContain('abs-home-path');
    expect(r.stderr).toContain('FAIL');
  });

  it('returns 2 for a missing scan path', () => {
    const r = runCli([join(dir, 'does-not-exist')], dir);
    expect(r.code).toBe(2);
    expect(r.stderr).toContain('not found');
  });

  it('--json emits parseable output', () => {
    writeFileSync(join(dir, 'bad.ts'), 'team_ABCDEFGHIJKLMNOP12\n');
    const r = runCli([dir, '--json'], dir);
    expect(r.code).toBe(1);
    expect(JSON.parse(r.stdout).violations).toBeGreaterThan(0);
  });

  it('loads repo-local rules and flags a custom literal', () => {
    writeFileSync(
      join(dir, '.leakrules.json'),
      JSON.stringify([{ tag: 'cust', reason: 'customer', literal: 'Acme' }]),
    );
    writeFileSync(join(dir, 'doc.md'), 'we work with Acme\n');
    const r = runCli([dir], dir);
    expect(r.code).toBe(1);
    expect(r.stdout).toContain('cust');
  });

  it('returns 2 on malformed repo-local rules', () => {
    writeFileSync(join(dir, '.leakrules.json'), '{not valid');
    const r = runCli([dir], dir);
    expect(r.code).toBe(2);
  });

  it('honors .leakignore (path-glob + tag)', () => {
    writeFileSync(join(dir, 'bad.ts'), "const h = '/home/alice/x';\n");
    writeFileSync(join(dir, '.leakignore'), 'bad.ts abs-home-path\n');
    const r = runCli([dir], dir);
    expect(r.code).toBe(0);
  });

  it('--help returns 0 with usage', () => {
    const r = runCli(['--help'], dir);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('Usage:');
  });
});

import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadManifest, registerTmpscript, sweepTmpscript } from '../tmpscript/index.js';

const roots: string[] = [];
function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'tmpscript-hardening-'));
  roots.push(dir);
  const file = join(dir, 'helper');
  writeFileSync(file, 'keep me');
  return { file, controlPath: join(dir, 'manifest.json'), legacyPath: join(dir, 'legacy.json') };
}
afterEach(() => {
  for (const dir of roots.splice(0)) rmSync(dir, { recursive: true, force: true });
});
function oldEntry(path: string) {
  return {
    id: 'old',
    path,
    purpose: 'old',
    validate: null,
    session: '0',
    created: '2000-01-01T00:00:00.000Z',
    status: 'pending',
    confirmed: null,
  };
}
describe('temporary-artifact safety regressions', () => {
  it('inspection never imports or creates state', () => {
    const f = fixture();
    writeFileSync(f.legacyPath, JSON.stringify({ version: 1, entries: [oldEntry(f.file)] }));
    loadManifest(f);
    expect(existsSync(f.controlPath)).toBe(false);
  });
  it('corrupt state is an error, not an empty registry', () => {
    const f = fixture();
    writeFileSync(f.controlPath, '{broken');
    expect(() => loadManifest(f)).toThrow();
  });
  it('sweep is a proposal even for old work', () => {
    const f = fixture();
    writeFileSync(f.controlPath, JSON.stringify({ version: 1, entries: [oldEntry(f.file)] }));
    const before = readFileSync(f.controlPath, 'utf8');
    sweepTmpscript(f);
    expect(readFileSync(f.file, 'utf8')).toBe('keep me');
    expect(readFileSync(f.controlPath, 'utf8')).toBe(before);
  });
  it('rejects shell validation at registration', () => {
    const f = fixture();
    expect(() => registerTmpscript({ path: f.file, validate: 'touch unsafe' }, f)).toThrow();
  });
});

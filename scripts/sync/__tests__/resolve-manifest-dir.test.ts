import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { requireManifestPath, resolveManifestDir } from '../resolve-manifest-dir.js';

const PREV_DIR = process.env.REVEALUI_SYNC_MANIFEST_DIR;
const PREV_JV = process.env.JV_REPO;

afterEach(() => {
  if (PREV_DIR === undefined) delete process.env.REVEALUI_SYNC_MANIFEST_DIR;
  else process.env.REVEALUI_SYNC_MANIFEST_DIR = PREV_DIR;
  if (PREV_JV === undefined) delete process.env.JV_REPO;
  else process.env.JV_REPO = PREV_JV;
});

describe('resolveManifestDir', () => {
  it('prefers REVEALUI_SYNC_MANIFEST_DIR when the vercel toml is present', () => {
    const dir = join(tmpdir(), `rui-sync-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'revvault-vercel.toml'), '# test\n');
    process.env.REVEALUI_SYNC_MANIFEST_DIR = dir;
    expect(resolveManifestDir()).toBe(dir);
  });

  it('requireManifestPath names the missing file when the dir is unset', () => {
    process.env.REVEALUI_SYNC_MANIFEST_DIR = join(tmpdir(), 'rui-sync-missing-dir');
    process.env.JV_REPO = join(tmpdir(), 'rui-sync-missing-jv');
    expect(() => requireManifestPath('vercel')).toThrow(/Private sync manifest/);
  });
});

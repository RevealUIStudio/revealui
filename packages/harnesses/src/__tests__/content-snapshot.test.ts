import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  buildContentSnapshot,
  buildManifest,
  checkAllContentSnapshots,
  checkContentSnapshot,
  DEFAULT_CONTENT_GENERATOR_ID,
  getContentSnapshotsDir,
  hashContent,
  listGenerators,
  loadContentSnapshot,
  snapshotPathFor,
  writeContentSnapshot,
} from '../content/index.js';

describe('content snapshot (definition ↔ generator lock, GAP-406)', () => {
  const temps: string[] = [];

  afterEach(() => {
    for (const d of temps) {
      rmSync(d, { recursive: true, force: true });
    }
    temps.length = 0;
  });

  it('buildContentSnapshot is deterministic for the default generator', () => {
    const a = buildContentSnapshot(DEFAULT_CONTENT_GENERATOR_ID);
    const b = buildContentSnapshot(DEFAULT_CONTENT_GENERATOR_ID);
    expect(a).toEqual(b);
    expect(a.files.length).toBeGreaterThan(0);
    expect(a.generatorId).toBe(DEFAULT_CONTENT_GENERATOR_ID);
    expect(a.files[0]?.sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it('hashContent is stable for a fixed string', () => {
    expect(hashContent('hello\n')).toBe(hashContent('hello\n'));
    expect(hashContent('hello\n')).not.toBe(hashContent('hello'));
  });

  it('checkContentSnapshot reports hash-mismatch and missing paths', () => {
    const live = buildContentSnapshot(DEFAULT_CONTENT_GENERATOR_ID);
    const broken = {
      ...live,
      files: live.files.map((f, i) => (i === 0 ? { ...f, sha256: '0'.repeat(64) } : f)),
    };
    const mismatch = checkContentSnapshot(broken);
    expect(mismatch.ok).toBe(false);
    expect(mismatch.drifts.some((d) => d.kind === 'hash-mismatch')).toBe(true);

    const missingGenerate = {
      ...live,
      files: [
        ...live.files,
        { relativePath: '.revealui/content/rules/does-not-exist.md', sha256: 'a'.repeat(64) },
      ],
    };
    const missing = checkContentSnapshot(missingGenerate);
    expect(missing.ok).toBe(false);
    expect(missing.drifts.some((d) => d.kind === 'missing-in-generate')).toBe(true);
  });

  it('write + load round-trips a snapshot on disk', () => {
    const dir = mkdtempSync(join(tmpdir(), 'content-snap-'));
    temps.push(dir);
    const snap = buildContentSnapshot('cursor');
    const path = join(dir, 'cursor.json');
    writeContentSnapshot(path, snap);
    const loaded = loadContentSnapshot(path);
    expect(loaded).toEqual(snap);
    expect(checkContentSnapshot(loaded).ok).toBe(true);
  });

  it('committed snapshots cover every registered generator (CI lock)', () => {
    const dir = getContentSnapshotsDir();
    const all = checkAllContentSnapshots({ snapshotsDir: dir });
    if (!all.ok) {
      const detail = [
        ...all.errors,
        ...all.results
          .filter((r) => !r.ok)
          .flatMap((r) =>
            r.drifts.slice(0, 10).map((d) => `${r.generatorId}: ${d.kind} ${d.relativePath}`),
          ),
      ].join('\n');
      throw new Error(
        `Content snapshot drift. Run: pnpm --filter @revealui/harnesses content:snapshot:write\n${detail}`,
      );
    }
    expect(all.results.map((r) => r.generatorId).sort()).toEqual(listGenerators().sort());
    for (const r of all.results) {
      expect(r.fileCount).toBeGreaterThan(0);
      expect(snapshotPathFor(r.generatorId, dir)).toContain(r.generatorId);
    }
  });

  it('snapshot file count tracks manifest for claude-code rules+cmds+agents+skills', () => {
    const manifest = buildManifest();
    const snap = buildContentSnapshot(DEFAULT_CONTENT_GENERATOR_ID, { manifest });
    const expected =
      manifest.rules.length +
      manifest.commands.length +
      manifest.agents.length +
      manifest.skills.length;
    expect(snap.files.length).toBe(expected);
  });
});

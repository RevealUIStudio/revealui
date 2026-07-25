import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  loadManifest,
  pendingEntries,
  promoteHotfix,
  registerHotfix,
  resolveHotfix,
  sweepResolved,
} from '../hotfix/index.js';

const dirs: string[] = [];

function tempStore(): { controlPath: string; legacyPath: string } {
  const dir = mkdtempSync(join(tmpdir(), 'rvui-hotfix-'));
  dirs.push(dir);
  return {
    controlPath: join(dir, 'manifest.json'),
    legacyPath: join(dir, 'legacy-manifest.json'),
  };
}

afterEach(() => {
  // temp dirs left for OS cleanup; no global env pollution
});

describe('hotfix control-layer registry', () => {
  it('registers pending debt and lists it', () => {
    const paths = tempStore();
    const e = registerHotfix(
      {
        title: 'seed env bypass',
        symptom: 'seed fails under direnv',
        temporary: 'env -u POSTGRES_URL',
        durable: 'demote incomplete URLs in seed-env',
        paths: ['scripts/seed-env.ts'],
        gap: 'GAP-405',
      },
      paths,
    );
    expect(e.status).toBe('pending');
    expect(e.id).toMatch(/^seed-env-bypass-/);
    const pending = pendingEntries(loadManifest(paths));
    expect(pending).toHaveLength(1);
    expect(pending[0]?.durable).toContain('seed-env');
  });

  it('resolves with pr and clears pending', () => {
    const paths = tempStore();
    const e = registerHotfix(
      {
        title: 't',
        symptom: 's',
        temporary: 'tmp',
        durable: 'fix root',
      },
      paths,
    );
    resolveHotfix(e.id, { pr: 'https://github.com/org/repo/pull/1' }, paths);
    expect(pendingEntries(loadManifest(paths))).toHaveLength(0);
    const again = loadManifest(paths).entries[0];
    expect(again?.status).toBe('resolved');
    expect(again?.pr).toContain('/pull/1');
  });

  it('promotes gap without resolving', () => {
    const paths = tempStore();
    const e = registerHotfix(
      {
        title: 'x',
        symptom: 's',
        temporary: 't',
        durable: 'd',
      },
      paths,
    );
    promoteHotfix(e.id, 'GAP-999', paths);
    const m = loadManifest(paths);
    expect(m.entries[0]?.gap).toBe('GAP-999');
    expect(m.entries[0]?.status).toBe('pending');
  });

  it('migrates legacy claude store once into control path', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rvui-hotfix-mig-'));
    dirs.push(dir);
    const controlPath = join(dir, 'control.json');
    const legacyPath = join(dir, 'legacy.json');
    writeFileSync(
      legacyPath,
      JSON.stringify({
        version: 1,
        entries: [
          {
            id: 'legacy-1',
            title: 'old',
            symptom: 's',
            temporary: 't',
            durable: 'd',
            paths: [],
            repo: null,
            gap: null,
            pr: null,
            session: '0',
            created: new Date().toISOString(),
            status: 'pending',
            resolved: null,
            resolveNote: null,
          },
        ],
      }),
      'utf8',
    );
    const m = loadManifest({ controlPath, legacyPath, migrate: true });
    expect(m.entries).toHaveLength(1);
    expect(m.entries[0]?.id).toBe('legacy-1');
    // second load from control path without re-import
    const m2 = loadManifest({ controlPath, legacyPath: join(dir, 'missing.json'), migrate: true });
    expect(m2.entries[0]?.id).toBe('legacy-1');
  });

  it('sweep keeps pending and recent resolved', () => {
    const paths = tempStore();
    const e = registerHotfix(
      {
        title: 'keep',
        symptom: 's',
        temporary: 't',
        durable: 'd',
      },
      paths,
    );
    resolveHotfix(e.id, { note: 'fixed' }, paths);
    const r = sweepResolved(paths);
    expect(r.remaining).toBe(1);
  });
});

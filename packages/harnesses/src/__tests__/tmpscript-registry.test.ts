import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  confirmTmpscript,
  loadManifest,
  pendingEntries,
  registerTmpscript,
  sweepTmpscript,
} from '../tmpscript/index.js';

function tempStore(): {
  controlPath: string;
  legacyPath: string;
  dir: string;
  filePath: string;
} {
  const dir = mkdtempSync(join(tmpdir(), 'rvui-tmpscript-'));
  const filePath = join(dir, 'helper.sh');
  writeFileSync(filePath, '#!/bin/sh\necho ok\n', 'utf8');
  return {
    dir,
    filePath,
    controlPath: join(dir, 'manifest.json'),
    legacyPath: join(dir, 'legacy-manifest.json'),
  };
}

describe('tmpscript control-layer registry (GAP-295)', () => {
  it('registers pending and lists it', () => {
    const paths = tempStore();
    const e = registerTmpscript(
      {
        path: paths.filePath,
        purpose: 'owner installer',
        validate: 'true',
      },
      paths,
    );
    expect(e.status).toBe('pending');
    expect(e.path).toBe(paths.filePath);
    const pending = pendingEntries(loadManifest(paths));
    expect(pending).toHaveLength(1);
    expect(pending[0]?.purpose).toBe('owner installer');
  });

  it('confirm validates then deletes and clears pending', () => {
    const paths = tempStore();
    const e = registerTmpscript(
      {
        path: paths.filePath,
        purpose: 'verify',
        validate: 'exit 0',
      },
      paths,
    );
    let ran = false;
    confirmTmpscript(e.id, {
      ...paths,
      runValidate: () => {
        ran = true;
      },
      unlinkPath: () => {
        /* no-op */
      },
      pathExists: () => true,
    });
    expect(ran).toBe(true);
    expect(pendingEntries(loadManifest(paths))).toHaveLength(0);
    expect(loadManifest(paths).entries[0]?.status).toBe('confirmed');
  });

  it('confirm leaves pending when validate fails', () => {
    const paths = tempStore();
    const e = registerTmpscript(
      {
        path: paths.filePath,
        purpose: 'bad',
        validate: 'false',
      },
      paths,
    );
    expect(() =>
      confirmTmpscript(e.id, {
        ...paths,
        runValidate: () => {
          throw new Error('fail');
        },
      }),
    ).toThrow(/validation FAILED/);
    expect(pendingEntries(loadManifest(paths))).toHaveLength(1);
  });

  it('migrates legacy claude store once into control path', () => {
    const paths = tempStore();
    writeFileSync(
      paths.legacyPath,
      JSON.stringify({
        version: 1,
        entries: [
          {
            id: 'legacy-helper-1',
            path: paths.filePath,
            purpose: 'old adapter entry',
            validate: null,
            session: '0',
            created: new Date().toISOString(),
            status: 'pending',
            confirmed: null,
          },
        ],
      }),
      'utf8',
    );
    const m = loadManifest({
      controlPath: paths.controlPath,
      legacyPath: paths.legacyPath,
      migrate: true,
    });
    expect(m.entries).toHaveLength(1);
    expect(m.entries[0]?.id).toBe('legacy-helper-1');
    const m2 = loadManifest({
      controlPath: paths.controlPath,
      legacyPath: join(paths.dir, 'missing.json'),
      migrate: true,
    });
    expect(m2.entries[0]?.id).toBe('legacy-helper-1');
  });

  it('sweep prunes old confirmed entries', () => {
    const paths = tempStore();
    const e = registerTmpscript(
      {
        path: paths.filePath,
        purpose: 'keep briefly',
      },
      paths,
    );
    confirmTmpscript(e.id, {
      ...paths,
      pathExists: () => false,
      unlinkPath: () => {
        /* none */
      },
    });
    const r = sweepTmpscript({
      ...paths,
      pathExists: () => false,
    });
    expect(r.remaining).toBe(1);
  });
});

import { mkdtemp, open, readFile, rm, stat, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../index.js', () => ({
  createLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
  }),
  getProjectRoot: async () => '.',
}));

import { publication } from '../database/backup-manager.js';

describe('verified backup publication', () => {
  let directory: string | undefined;

  afterEach(async () => {
    if (directory) await rm(directory, { recursive: true, force: true });
    directory = undefined;
  });

  it('hard-links the open inode', async () => {
    directory = await mkdtemp(join(tmpdir(), 'revealui-publish-'));
    const stage = join(directory, '.backup-stage');
    const destination = join(directory, 'backup-out.json');
    const handle = await open(stage, 'wx+', 0o600);
    try {
      await handle.writeFile('verified');
      await handle.sync();
      await publication.publishVerified(handle, stage, destination);
      expect(await readFile(destination, 'utf8')).toBe('verified');
      if (process.platform === 'linux') {
        expect((await stat(destination)).ino).toBe((await handle.stat()).ino);
      }
    } finally {
      await handle.close();
    }
  });

  it('does not publish bytes written to a replaced staging name', async () => {
    directory = await mkdtemp(join(tmpdir(), 'revealui-publish-'));
    const stage = join(directory, '.backup-stage');
    const destination = join(directory, 'backup-out.json');
    const handle = await open(stage, 'wx+', 0o600);
    try {
      await handle.writeFile('verified');
      await handle.sync();
      await unlink(stage);
      await writeFile(stage, 'replaced');
      if (process.platform === 'linux') {
        await expect(publication.publishVerified(handle, stage, destination)).rejects.toThrow();
        await expect(stat(destination)).rejects.toThrow();
        return;
      }
      await publication.publishVerified(handle, stage, destination);
      expect(await readFile(destination, 'utf8')).toBe('replaced');
    } finally {
      await handle.close();
    }
  });
});

import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { ChainProvider } from '../chain-provider.js';
import { EnvProvider } from '../env-provider.js';
import { FileProvider } from '../file-provider.js';
import { RevvaultProvider } from '../revvault-provider.js';
import { SecretNotFoundError } from '../types.js';

describe('EnvProvider', () => {
  it('returns a present env value', async () => {
    const env = new EnvProvider();
    await expect(env.get('FOO', { source: { FOO: 'bar' } })).resolves.toBe('bar');
  });

  it('throws when missing', async () => {
    const env = new EnvProvider();
    await expect(env.get('MISSING', { source: {} })).rejects.toBeInstanceOf(SecretNotFoundError);
  });
});

describe('FileProvider', () => {
  it('reads a named file from the directory', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'secrets-'));
    await writeFile(join(dir, 'REVEALUI_LICENSE_KEY'), 'jwt-here\n', 'utf8');
    const files = new FileProvider({ directory: dir });
    await expect(files.get('REVEALUI_LICENSE_KEY')).resolves.toBe('jwt-here');
  });

  it('reads a path from an env var', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'secrets-'));
    const path = join(dir, 'key.jwt');
    await writeFile(path, 'from-file', 'utf8');
    const files = new FileProvider({ pathEnvVar: 'REVEALUI_LICENSE_KEY_FILE' });
    await expect(
      files.get('REVEALUI_LICENSE_KEY', { source: { REVEALUI_LICENSE_KEY_FILE: path } }),
    ).resolves.toBe('from-file');
  });
});

describe('RevvaultProvider', () => {
  it('returns stdout from revvault get --full', async () => {
    const exec = vi.fn().mockResolvedValue({ stdout: 'vaulted\n', stderr: '' });
    const vault = new RevvaultProvider({ exec });
    await expect(vault.get('revealui/prod/x')).resolves.toBe('vaulted');
    expect(exec).toHaveBeenCalledWith(
      'revvault',
      ['get', '--full', 'revealui/prod/x'],
      expect.objectContaining({ encoding: 'utf8' }),
    );
  });
});

describe('ChainProvider', () => {
  it('returns the first hit', async () => {
    const env = new EnvProvider();
    const chain = new ChainProvider([env]);
    await expect(chain.get('A', { source: { A: 'one' } })).resolves.toBe('one');
  });

  it('falls through SecretNotFoundError', async () => {
    const empty = new EnvProvider();
    const filled = {
      id: 'stub',
      get: async () => 'from-stub',
    };
    const chain = new ChainProvider([empty, filled]);
    await expect(chain.get('A', { source: {} })).resolves.toBe('from-stub');
  });
});

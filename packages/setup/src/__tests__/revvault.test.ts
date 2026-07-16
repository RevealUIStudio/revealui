import { EventEmitter } from 'node:events';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const spawnSyncMock = vi.fn();
const spawnMock = vi.fn();

vi.mock('node:child_process', () => ({
  spawnSync: (...args: unknown[]) => spawnSyncMock(...args),
  spawn: (...args: unknown[]) => spawnMock(...args),
}));

import {
  assertSafePath,
  assertSafePrefix,
  createMemoryVault,
  createRevvaultVault,
  RevvaultError,
  readRevvaultSecret,
  requireRevvaultSecret,
  revvaultSecretExists,
  writeRevvaultSecret,
} from '../revvault/index.js';

function fakeSpawnSyncResult(overrides: {
  status?: number | null;
  stdout?: string;
  stderr?: string;
  error?: Error;
}): {
  status: number | null;
  stdout: string;
  stderr: string;
  error?: Error;
} {
  return {
    status: overrides.status ?? 0,
    stdout: overrides.stdout ?? '',
    stderr: overrides.stderr ?? '',
    error: overrides.error,
  };
}

/** Minimal stand-in for a Readable stream: just enough for `spawn`'s usage. */
class FakeReadable extends EventEmitter {
  setEncoding = vi.fn();
}

class FakeChildProcess extends EventEmitter {
  stdout = new FakeReadable();
  stderr = new FakeReadable();
  stdin = { end: vi.fn() };

  emitStdout(chunk: string): void {
    this.stdout.emit('data', chunk);
  }

  emitStderr(chunk: string): void {
    this.stderr.emit('data', chunk);
  }

  close(code: number | null): void {
    this.emit('close', code);
  }
}

beforeEach(() => {
  spawnSyncMock.mockReset();
  spawnMock.mockReset();
});

describe('assertSafePath / assertSafePrefix', () => {
  it('accepts well-formed slash-delimited paths', () => {
    expect(() => assertSafePath('mcp/acme/linear/tokens')).not.toThrow();
    expect(() => assertSafePrefix('mcp/acme/')).not.toThrow();
  });

  it('rejects disallowed characters', () => {
    expect(() => assertSafePath('mcp/acme/$(rm -rf)')).toThrow(RevvaultError);
    expect(() => assertSafePath('mcp/acme; ls')).toThrow(RevvaultError);
  });

  it('rejects traversal and leading/trailing slashes', () => {
    expect(() => assertSafePath('mcp/../etc/passwd')).toThrow(RevvaultError);
    expect(() => assertSafePath('/mcp/acme')).toThrow(RevvaultError);
    expect(() => assertSafePath('mcp/acme/')).toThrow(RevvaultError);
  });

  it('assertSafePrefix allows a trailing slash', () => {
    expect(() => assertSafePrefix('mcp/acme/')).not.toThrow();
    expect(() => assertSafePrefix('/mcp/acme')).toThrow(RevvaultError);
  });

  it('rejects empty strings (the pre-extraction anchored pattern required 1+ chars; an empty prefix would list the whole vault)', () => {
    expect(() => assertSafePath('')).toThrow(RevvaultError);
    expect(() => assertSafePrefix('')).toThrow(RevvaultError);
  });
});

describe('readRevvaultSecret', () => {
  it('returns the value on success, stripping one trailing newline', () => {
    spawnSyncMock.mockReturnValue(fakeSpawnSyncResult({ status: 0, stdout: 'sekret\n' }));
    expect(readRevvaultSecret('revealui/dev/foo')).toBe('sekret');
  });

  it('returns undefined on nonzero exit', () => {
    spawnSyncMock.mockReturnValue(fakeSpawnSyncResult({ status: 1, stderr: 'not found' }));
    expect(readRevvaultSecret('revealui/dev/missing')).toBeUndefined();
  });

  it('returns undefined on empty output', () => {
    spawnSyncMock.mockReturnValue(fakeSpawnSyncResult({ status: 0, stdout: '   \n' }));
    expect(readRevvaultSecret('revealui/dev/empty')).toBeUndefined();
  });

  it('returns undefined when the binary itself fails to spawn', () => {
    spawnSyncMock.mockReturnValue(
      fakeSpawnSyncResult({ status: null, error: new Error('ENOENT') }),
    );
    expect(readRevvaultSecret('revealui/dev/foo')).toBeUndefined();
  });
});

describe('requireRevvaultSecret', () => {
  it('returns the value on success', () => {
    spawnSyncMock.mockReturnValue(fakeSpawnSyncResult({ status: 0, stdout: 'sekret\n' }));
    expect(requireRevvaultSecret('revealui/prod/foo')).toBe('sekret');
  });

  it('throws a RevvaultError naming the exact path when missing', () => {
    spawnSyncMock.mockReturnValue(fakeSpawnSyncResult({ status: 1, stderr: 'not found' }));
    expect(() => requireRevvaultSecret('revealui/prod/missing-thing')).toThrow(RevvaultError);
    try {
      requireRevvaultSecret('revealui/prod/missing-thing');
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(RevvaultError);
      expect((err as Error).message).toContain('revealui/prod/missing-thing');
      expect((err as Error).message).toContain('revvault set revealui/prod/missing-thing');
    }
  });
});

describe('writeRevvaultSecret', () => {
  it('succeeds on exit code 0', () => {
    spawnSyncMock.mockReturnValue(fakeSpawnSyncResult({ status: 0 }));
    expect(() => writeRevvaultSecret('revealui/prod/foo', 'value')).not.toThrow();
  });

  it('throws RevvaultError on nonzero exit', () => {
    spawnSyncMock.mockReturnValue(fakeSpawnSyncResult({ status: 1, stderr: 'locked store' }));
    expect(() => writeRevvaultSecret('revealui/prod/foo', 'value')).toThrow(RevvaultError);
  });
});

describe('revvaultSecretExists', () => {
  it('is true on exit code 0, false otherwise', () => {
    spawnSyncMock.mockReturnValue(fakeSpawnSyncResult({ status: 0 }));
    expect(revvaultSecretExists('revealui/staging/kek')).toBe(true);

    spawnSyncMock.mockReturnValue(fakeSpawnSyncResult({ status: 1 }));
    expect(revvaultSecretExists('revealui/staging/kek')).toBe(false);
  });

  it('calls `get` without `--full`, matching the existence-check convention', () => {
    spawnSyncMock.mockReturnValue(fakeSpawnSyncResult({ status: 0 }));
    revvaultSecretExists('revealui/staging/kek');
    const [, args] = spawnSyncMock.mock.calls[0] as [string, string[]];
    expect(args).toEqual(['get', 'revealui/staging/kek']);
  });
});

describe('createRevvaultVault', () => {
  function nextChild(): FakeChildProcess {
    const child = new FakeChildProcess();
    spawnMock.mockReturnValueOnce(child);
    return child;
  }

  it('get() returns the stored value', async () => {
    const vault = createRevvaultVault();
    const child = nextChild();
    const promise = vault.get('mcp/acme/linear/tokens');
    child.emitStdout('{"access":"tok"}\n');
    child.close(0);
    await expect(promise).resolves.toBe('{"access":"tok"}');
  });

  it('get() returns undefined when revvault reports not found (exit 0, empty stdout)', async () => {
    const vault = createRevvaultVault();
    const child = nextChild();
    const promise = vault.get('mcp/acme/linear/tokens');
    child.emitStderr('secret not found');
    child.close(0);
    await expect(promise).resolves.toBeUndefined();
  });

  it('set() rejects on nonzero exit', async () => {
    const vault = createRevvaultVault();
    const child = nextChild();
    const promise = vault.set('mcp/acme/linear/tokens', 'value');
    child.emitStderr('locked');
    child.close(1);
    await expect(promise).rejects.toThrow(RevvaultError);
  });

  it('rejects an unsafe path before ever spawning', async () => {
    const vault = createRevvaultVault();
    await expect(vault.get('../etc/passwd')).rejects.toThrow(RevvaultError);
    expect(spawnMock).not.toHaveBeenCalled();
  });
});

describe('createMemoryVault', () => {
  it('supports get/set/delete/list round-trip', async () => {
    const vault = createMemoryVault({ 'mcp/acme/linear/tokens': 'seed' });
    expect(await vault.get('mcp/acme/linear/tokens')).toBe('seed');
    await vault.set('mcp/acme/linear/client', 'client-info');
    expect(await vault.list('mcp/acme/linear/')).toEqual(
      expect.arrayContaining(['mcp/acme/linear/tokens', 'mcp/acme/linear/client']),
    );
    await vault.delete('mcp/acme/linear/tokens');
    expect(await vault.get('mcp/acme/linear/tokens')).toBeUndefined();
  });
});

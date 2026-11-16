import { spawn } from 'node:child_process';
import {
  closeSync,
  existsSync,
  linkSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  confirmTmpscript,
  controlManifestPath,
  importManifest,
  loadManifest,
  preserveTmpscript,
  registerTmpscript,
  runTmpscriptCli,
  saveManifest,
  sweepTmpscript,
} from '../tmpscript/index.js';

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {
    ...actual,
    renameSync: vi.fn(actual.renameSync),
    fsyncSync: vi.fn(actual.fsyncSync),
    unlinkSync: vi.fn(actual.unlinkSync),
  };
});
vi.mock('../tmpscript/files.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../tmpscript/files.js')>();
  return { ...actual, readCheckedFile: vi.fn(actual.readCheckedFile) };
});
const roots: string[] = [];
function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'tmpscript-contract-'));
  roots.push(dir);
  const filePath = join(dir, 'helper');
  writeFileSync(filePath, 'original helper');
  return {
    dir,
    filePath,
    controlPath: join(dir, 'state', 'manifest.json'),
    legacyPath: join(dir, 'legacy.json'),
  };
}
function legacy(path: string, validate: string | null = null) {
  return {
    version: 1,
    entries: [
      {
        id: 'legacy',
        path,
        purpose: 'historical helper',
        validate,
        session: '0',
        created: '2000-01-01T00:00:00.000Z',
        status: 'pending',
        confirmed: null,
      },
    ],
  };
}
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  for (const d of roots.splice(0)) rmSync(d, { recursive: true, force: true });
});
describe('temporary-artifact registry', () => {
  it('registers identity and retains unknown consumer/lease state', () => {
    const f = fixture();
    const e = registerTmpscript({ path: f.filePath, purpose: 'installer' }, f);
    expect(e.identity?.sha256).toHaveLength(64);
    expect(e.lease).toBe('unknown');
    expect(e.consumers[0]?.state).toBe('unknown');
    expect(e.disposition).toBe('retain');
    expect(statSync(f.controlPath).mode & 0o777).toBe(0o600);
    expect(statSync(dirname(f.controlPath)).mode & 0o777).toBe(0o700);
  });
  it.each([true, false])('imports v2 consumers as unreviewed (references: %s)', (hasReferences) => {
    const source = fixture();
    const target = fixture();
    const consumers = hasReferences
      ? [
          { reference: 'producer', state: 'active' as const },
          { reference: 'former-reader', state: 'released' as const },
          { reference: 'unreviewed-reader', state: 'unknown' as const },
        ]
      : [];
    registerTmpscript({ path: source.filePath, consumers }, source);
    const original = readFileSync(source.controlPath);
    const artifact = readFileSync(source.filePath);
    const imported = importManifest(source.controlPath, target);
    const expected = hasReferences
      ? consumers.map(({ reference }) => ({ reference, state: 'unknown' }))
      : [{ reference: 'imported consumers not reviewed', state: 'unknown' }];
    expect(imported.entries[0]?.consumers).toEqual(expected);
    expect(imported.entries[0]?.status).toBe('held');
    expect(loadManifest(target).entries[0]?.consumers).toEqual(expected);
    expect(readFileSync(source.controlPath)).toEqual(original);
    expect(readFileSync(source.filePath)).toEqual(artifact);
  });
  it('records completion without executing or deleting a file', () => {
    const f = fixture();
    const e = registerTmpscript({ path: f.filePath }, f);
    expect(() => confirmTmpscript(e.id, f)).toThrow('completion evidence');
    const complete = confirmTmpscript(e.id, {
      ...f,
      expectedSha256: e.identity?.sha256,
      evidence: 'owner verified operation receipt',
    });
    expect(complete.status).toBe('confirmed');
    expect(readFileSync(f.filePath, 'utf8')).toBe('original helper');
    expect(loadManifest(f).entries[0]?.completion?.sha256).toBe(e.identity?.sha256);
    expect(
      confirmTmpscript(e.id, { ...f, expectedSha256: e.identity?.sha256, evidence: 'repeat' })
        .completion,
    ).toEqual(complete.completion);
  });
  it('never marks missing or changed artifacts complete', () => {
    const f = fixture();
    const e = registerTmpscript({ path: f.filePath }, f);
    const before = readFileSync(f.controlPath, 'utf8');
    writeFileSync(f.filePath, 'changed');
    expect(() =>
      confirmTmpscript(e.id, { ...f, expectedSha256: e.identity?.sha256, evidence: 'receipt' }),
    ).toThrow('changed');
    expect(readFileSync(f.controlPath, 'utf8')).toBe(before);
    unlinkSync(f.filePath);
    expect(() =>
      confirmTmpscript(e.id, { ...f, expectedSha256: e.identity?.sha256, evidence: 'receipt' }),
    ).toThrow();
    expect(readFileSync(f.controlPath, 'utf8')).toBe(before);
  });
  it('rejects replacement with identical bytes but different identity', () => {
    const f = fixture();
    const e = registerTmpscript({ path: f.filePath }, f);
    const fd = openSync(f.filePath, 'r');
    try {
      unlinkSync(f.filePath);
      writeFileSync(f.filePath, 'original helper');
      expect(() =>
        confirmTmpscript(e.id, { ...f, expectedSha256: e.identity?.sha256, evidence: 'receipt' }),
      ).toThrow('changed');
    } finally {
      closeSync(fd);
    }
  });
  it('rejects symlinks, hardlinks, directories and symlinked ancestors', () => {
    const f = fixture();
    const link = join(f.dir, 'link');
    symlinkSync(f.filePath, link);
    expect(() => registerTmpscript({ path: link }, f)).toThrow();
    unlinkSync(link);
    linkSync(f.filePath, link);
    expect(() => registerTmpscript({ path: link }, f)).toThrow('single-link');
    expect(() => registerTmpscript({ path: f.dir }, f)).toThrow();
    const alias = join(f.dir, 'alias');
    symlinkSync(f.dir, alias);
    expect(() => registerTmpscript({ path: join(alias, 'helper') }, f)).toThrow('parent');
  });
  it('rejects shell commands rather than executing historical validation', () => {
    const f = fixture();
    const sentinel = join(f.dir, 'executed');
    expect(() => registerTmpscript({ path: f.filePath, validate: `touch ${sentinel}` }, f)).toThrow(
      'shell validation',
    );
    writeFileSync(f.legacyPath, JSON.stringify(legacy(f.filePath, `touch ${sentinel}`)));
    importManifest(f.legacyPath, f);
    expect(() =>
      confirmTmpscript('legacy', { ...f, expectedSha256: '0'.repeat(64), evidence: 'receipt' }),
    ).toThrow('held');
    expect(existsSync(sentinel)).toBe(false);
    expect(existsSync(f.filePath)).toBe(true);
  });
  it('requires explicit import and preserves legacy originals', () => {
    const f = fixture();
    const bytes = JSON.stringify(legacy(f.filePath));
    writeFileSync(f.legacyPath, bytes);
    expect(loadManifest(f).importRequired?.path).toBe(f.legacyPath);
    expect(existsSync(dirname(f.controlPath))).toBe(false);
    expect(() => registerTmpscript({ path: f.filePath }, f)).toThrow('import required');
    const m = importManifest(f.legacyPath, f);
    expect(m.entries[0]?.status).toBe('held');
    expect(readFileSync(f.legacyPath, 'utf8')).toBe(bytes);
    expect(() => importManifest(f.legacyPath, f)).toThrow('destination exists');
  });
  it('in-place v1 import preserves exact rollback bytes', () => {
    const f = fixture();
    mkdirSync(dirname(f.controlPath));
    const bytes = JSON.stringify(legacy(f.filePath));
    writeFileSync(f.controlPath, bytes);
    importManifest(f.controlPath, f);
    const backups = readdirSync(dirname(f.controlPath)).filter((n) =>
      n.startsWith('manifest.json.v1-'),
    );
    expect(backups).toHaveLength(1);
    expect(readFileSync(join(dirname(f.controlPath), backups[0] ?? ''), 'utf8')).toBe(bytes);
    expect(loadManifest(f).version).toBe(2);
  });
  it('fails closed on malformed versions, duplicate identities and invalid timestamps', () => {
    const f = fixture();
    mkdirSync(dirname(f.controlPath));
    const old = legacy(f.filePath);
    for (const data of [
      { ...old, version: 99 },
      { ...old, entries: [old.entries[0], old.entries[0]] },
      { ...old, entries: [{ ...old.entries[0], created: 'not-a-date' }] },
    ]) {
      const bytes = JSON.stringify(data);
      writeFileSync(f.controlPath, bytes);
      expect(() => loadManifest(f)).toThrow();
      expect(() => registerTmpscript({ path: f.filePath }, f)).toThrow();
      expect(readFileSync(f.controlPath, 'utf8')).toBe(bytes);
    }
  });
  it('rejects competing legacy stores until a source is selected explicitly', () => {
    const f = fixture();
    const previousPath = join(f.dir, 'previous.json');
    writeFileSync(f.legacyPath, JSON.stringify(legacy(f.filePath)));
    writeFileSync(previousPath, JSON.stringify(legacy(f.filePath)));
    expect(() => loadManifest({ ...f, previousPath })).toThrow('multiple legacy');
    expect(importManifest(previousPath, f).entries).toHaveLength(1);
  });
  it('does not overwrite concurrent updates from an old manifest snapshot', () => {
    const f = fixture();
    const old = loadManifest(f);
    registerTmpscript({ path: f.filePath }, f);
    expect(() => saveManifest(old, f)).toThrow('revision conflict');
    expect(loadManifest(f).entries).toHaveLength(1);
  });
  it('does not steal a lock, even one whose PID could be stale', () => {
    const f = fixture();
    mkdirSync(dirname(f.controlPath));
    writeFileSync(`${f.controlPath}.lock`, 'unverified old lock');
    expect(() => registerTmpscript({ path: f.filePath }, f)).toThrow('locked');
    expect(readFileSync(`${f.controlPath}.lock`, 'utf8')).toBe('unverified old lock');
    expect(existsSync(f.controlPath)).toBe(false);
  });
  it('rejects writes when another process holds the lock', async () => {
    const f = fixture();
    mkdirSync(dirname(f.controlPath));
    const child = spawn(
      process.execPath,
      [
        '-e',
        'const fs=require("node:fs");const fd=fs.openSync(process.argv[1],"wx",384);process.stdout.write("locked");process.stdin.resume();process.stdin.on("end",()=>{fs.closeSync(fd);fs.unlinkSync(process.argv[1]);});',
        `${f.controlPath}.lock`,
      ],
      { stdio: ['pipe', 'pipe', 'pipe'] },
    );
    const exited = new Promise<number | null>((resolve) => child.once('close', resolve));
    try {
      await new Promise<void>((resolve, reject) => {
        const onExit = (code: number | null) => {
          clearTimeout(timer);
          reject(new Error(`lock child exited before readiness: ${code}`));
        };
        const timer = setTimeout(() => {
          child.kill();
          reject(new Error('lock child did not report readiness within 30 seconds'));
        }, 30_000);
        child.once('exit', onExit);
        child.once('error', (error) => {
          clearTimeout(timer);
          reject(error);
        });
        child.stdout.once('data', () => {
          clearTimeout(timer);
          child.removeListener('exit', onExit);
          resolve();
        });
      });
      expect(() => registerTmpscript({ path: f.filePath }, f)).toThrow('locked');
    } finally {
      child.stdin.end();
      expect(await exited).toBe(0);
    }
    expect(registerTmpscript({ path: f.filePath }, f).status).toBe('pending');
  });
  it('sweep retains active, unknown and completed artifacts and all receipts', () => {
    const f = fixture();
    const e = registerTmpscript(
      { path: f.filePath, consumers: [{ reference: 'service:test', state: 'active' }] },
      f,
    );
    const m = loadManifest(f);
    const item = m.entries[0];
    if (!item) throw new Error('missing fixture');
    item.created = '2000-01-01T00:00:00.000Z';
    item.lease = 'active';
    saveManifest(m, f);
    const before = readFileSync(f.controlPath, 'utf8');
    expect(sweepTmpscript(f)).toMatchObject({ removedFiles: 0, prunedEntries: 0, remaining: 1 });
    expect(readFileSync(f.controlPath, 'utf8')).toBe(before);
    expect(existsSync(e.path)).toBe(true);
  });
  it('records only a verified separate preservation copy for public artifacts', () => {
    const f = fixture();
    const e = registerTmpscript({ path: f.filePath, sensitivity: 'public' }, f);
    const copy = join(f.dir, 'preserved');
    writeFileSync(copy, 'wrong');
    expect(() => preserveTmpscript(e.id, copy, f)).toThrow('does not match');
    expect(() => preserveTmpscript(e.id, f.filePath, f)).toThrow('separate');
    writeFileSync(copy, readFileSync(f.filePath));
    expect(preserveTmpscript(e.id, copy, f).preservation?.sourceSha256).toBe(e.identity?.sha256);
    expect(existsSync(f.filePath)).toBe(true);
  });
  it('holds confidential artifacts for their encrypted preservation owner', () => {
    const f = fixture();
    const e = registerTmpscript({ path: f.filePath, sensitivity: 'confidential' }, f);
    expect(() => preserveTmpscript(e.id, f.filePath, f)).toThrow('encrypted preservation');
  });
  it('all inspection commands leave legacy bytes and the filesystem unchanged', () => {
    const f = fixture();
    writeFileSync(f.legacyPath, JSON.stringify(legacy(f.filePath, 'DO_NOT_PRINT_OR_RUN')));
    const output: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((s) => {
      output.push(String(s));
      return true;
    });
    const before = readdirSync(f.dir);
    for (const command of ['list', 'check', 'sweep', 'store'])
      expect(runTmpscriptCli([command], f)).toBe(0);
    expect(readdirSync(f.dir)).toEqual(before);
    expect(output.join('')).not.toContain('DO_NOT_PRINT_OR_RUN');
    expect(
      output
        .join('')
        .split('\n')
        .some((line) => line.trim().split(' ')[0] === 'pending'),
    ).toBe(true);
  });
  it('CLI rejects ambiguous flags and the former unguarded confirm', () => {
    const f = fixture();
    vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    expect(runTmpscriptCli(['confirm', 'anything'], f)).toBe(1);
    expect(runTmpscriptCli(['register', f.filePath, '--validate', 'true'], f)).toBe(1);
    expect(runTmpscriptCli(['register', f.filePath, '--purpose'], f)).toBe(1);
    expect(runTmpscriptCli(['sweep', '--force'], f)).toBe(1);
    expect(existsSync(f.controlPath)).toBe(false);
  });
  it('validates XDG state override without creating directories', () => {
    const f = fixture();
    vi.stubEnv('XDG_STATE_HOME', join(f.dir, 'xdg'));
    expect(controlManifestPath()).toBe(
      join(f.dir, 'xdg', 'revealui', 'tmp-scripts', 'manifest.json'),
    );
    expect(existsSync(join(f.dir, 'xdg'))).toBe(false);
    vi.stubEnv('XDG_STATE_HOME', 'relative');
    expect(() => controlManifestPath()).toThrow('absolute');
  });
});

describe('transaction failure boundaries', () => {
  it('retains the old manifest when atomic replacement fails', async () => {
    const fs = await import('node:fs');
    const f = fixture();
    registerTmpscript({ path: f.filePath }, f);
    const before = readFileSync(f.controlPath, 'utf8');
    const second = join(f.dir, 'second');
    writeFileSync(second, 'another helper');
    vi.mocked(fs.renameSync).mockImplementationOnce(() => {
      throw new Error('injected rename failure');
    });
    expect(() => registerTmpscript({ path: second }, f)).toThrow('injected rename failure');
    expect(readFileSync(f.controlPath, 'utf8')).toBe(before);
    expect(readdirSync(dirname(f.controlPath))).toEqual(['manifest.json']);
    expect(readFileSync(second, 'utf8')).toBe('another helper');
  });
  it('refuses a symlinked manifest without modifying its target', () => {
    const f = fixture();
    mkdirSync(dirname(f.controlPath));
    symlinkSync(f.filePath, f.controlPath);
    expect(() => loadManifest(f)).toThrow();
    expect(() => registerTmpscript({ path: f.filePath }, f)).toThrow();
    expect(readFileSync(f.filePath, 'utf8')).toBe('original helper');
  });
  it('refuses invalid completion state supplied through the store API', () => {
    const f = fixture();
    registerTmpscript({ path: f.filePath }, f);
    const m = loadManifest(f);
    const e = m.entries[0];
    if (!e) throw new Error('fixture absent');
    e.status = 'confirmed';
    expect(() => saveManifest(m, f)).toThrow();
    expect(loadManifest(f).entries[0]?.status).toBe('pending');
  });
});

describe('peer review regressions', () => {
  it('rejects oversized UTF-8 updates before replacing a readable manifest', () => {
    const f = fixture();
    registerTmpscript({ path: f.filePath }, f);
    const before = readFileSync(f.controlPath, 'utf8');
    const m = loadManifest(f);
    const e = m.entries[0];
    if (!e) throw new Error('fixture absent');
    e.purpose = 'é'.repeat(9 * 1024 * 1024);
    expect(() => saveManifest(m, f)).toThrow('limit');
    expect(readFileSync(f.controlPath, 'utf8')).toBe(before);
    expect(loadManifest(f).revision).toBe(1);
  });
  it('derives inspection entries and digest from one checked snapshot', async () => {
    const files = await import('../tmpscript/files.js');
    const actual =
      await vi.importActual<typeof import('../tmpscript/files.js')>('../tmpscript/files.js');
    const f = fixture();
    const original = JSON.stringify(legacy(f.filePath));
    writeFileSync(f.legacyPath, original);
    const digest = actual.readCheckedFile(f.legacyPath).identity.sha256;
    let replaced = false;
    vi.mocked(files.readCheckedFile).mockImplementation((path, limit) => {
      const snapshot = actual.readCheckedFile(path, limit);
      if (path === f.legacyPath && !replaced) {
        replaced = true;
        writeFileSync(path, JSON.stringify({ ...legacy(f.filePath), entries: [] }));
      }
      return snapshot;
    });
    try {
      const m = loadManifest(f);
      expect(m.entries[0]?.id).toBe('legacy');
      expect(m.importRequired?.sha256).toBe(digest);
    } finally {
      vi.mocked(files.readCheckedFile).mockImplementation(actual.readCheckedFile);
    }
  });
  it('refuses an import when the source is replaced between snapshot and commit', async () => {
    const files = await import('../tmpscript/files.js');
    const actual =
      await vi.importActual<typeof import('../tmpscript/files.js')>('../tmpscript/files.js');
    const f = fixture();
    const original = JSON.stringify(legacy(f.filePath));
    writeFileSync(f.legacyPath, original);
    let reads = 0;
    vi.mocked(files.readCheckedFile).mockImplementation((path, limit) => {
      if (path === f.legacyPath && ++reads === 2) {
        writeFileSync(path, JSON.stringify({ ...legacy(f.filePath), entries: [] }));
        const replacement = actual.readCheckedFile(path, limit);
        writeFileSync(path, original);
        return replacement;
      }
      return actual.readCheckedFile(path, limit);
    });
    try {
      expect(() => importManifest(f.legacyPath, f)).toThrow('source changed');
      expect(existsSync(f.controlPath)).toBe(false);
    } finally {
      vi.mocked(files.readCheckedFile).mockImplementation(actual.readCheckedFile);
    }
  });
  it('reports a published revision with uncertain durability after directory sync fails', async () => {
    const fs = await import('node:fs');
    const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
    const f = fixture();
    registerTmpscript({ path: f.filePath }, f);
    const second = join(f.dir, 'second');
    writeFileSync(second, 'second helper');
    vi.mocked(fs.fsyncSync).mockImplementation((fd) => {
      if (actual.fstatSync(fd).isDirectory()) throw new Error('injected directory sync failure');
      actual.fsyncSync(fd);
    });
    try {
      let outcome: unknown;
      try {
        registerTmpscript({ path: second }, f);
      } catch (error) {
        outcome = error;
      }
      expect(outcome).toMatchObject({
        code: 'TMPSCRIPT_PUBLISHED_DURABILITY_UNCONFIRMED',
        published: true,
        revision: 2,
      });
      expect(String(outcome)).toContain('reread before retrying');
      expect(loadManifest(f).revision).toBe(2);
      expect(loadManifest(f).entries).toHaveLength(2);
    } finally {
      vi.mocked(fs.fsyncSync).mockImplementation(actual.fsyncSync);
    }
  });
});

describe('state namespace protection', () => {
  it('does not register state that subsequent registry writes would replace', () => {
    const f = fixture();
    registerTmpscript({ path: f.filePath }, f);
    const before = readFileSync(f.controlPath, 'utf8');
    expect(() => registerTmpscript({ path: f.controlPath }, f)).toThrow('registry state');
    expect(readFileSync(f.controlPath, 'utf8')).toBe(before);
  });
  it('rejects invalid UTF-8 without converting or overwriting it', () => {
    const f = fixture();
    mkdirSync(dirname(f.controlPath));
    const bytes = Buffer.concat([
      Buffer.from('{"version":1,"entries":[],"store":"'),
      Buffer.from([255]),
      Buffer.from('"}'),
    ]);
    writeFileSync(f.controlPath, bytes);
    expect(() => importManifest(f.controlPath, f)).toThrow('malformed manifest');
    expect(readFileSync(f.controlPath)).toEqual(bytes);
  });
});

describe('lock cleanup outcome', () => {
  it('preserves the publication outcome when lock release also fails', async () => {
    const fs = await import('node:fs');
    const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
    const f = fixture();
    vi.mocked(fs.fsyncSync).mockImplementation((fd) => {
      if (actual.fstatSync(fd).isDirectory()) throw new Error('directory sync failed');
      actual.fsyncSync(fd);
    });
    vi.mocked(fs.unlinkSync).mockImplementation((path) => {
      if (path === `${f.controlPath}.lock`) throw new Error('lock unlink failed');
      actual.unlinkSync(path);
    });
    try {
      let outcome: unknown;
      try {
        registerTmpscript({ path: f.filePath }, f);
      } catch (error) {
        outcome = error;
      }
      expect(outcome).toMatchObject({
        code: 'TMPSCRIPT_PUBLISHED_DURABILITY_UNCONFIRMED',
        published: true,
        revision: 1,
        cleanupErrors: [expect.objectContaining({ message: 'lock unlink failed' })],
      });
      expect(loadManifest(f).revision).toBe(1);
      expect(existsSync(`${f.controlPath}.lock`)).toBe(true);
    } finally {
      vi.mocked(fs.fsyncSync).mockImplementation(actual.fsyncSync);
      vi.mocked(fs.unlinkSync).mockImplementation(actual.unlinkSync);
    }
  });
  it('instructs reread if the operation succeeds but lock cleanup fails', async () => {
    const fs = await import('node:fs');
    const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
    const f = fixture();
    vi.mocked(fs.unlinkSync).mockImplementation((path) => {
      if (path === `${f.controlPath}.lock`) throw new Error('lock unlink failed');
      actual.unlinkSync(path);
    });
    try {
      expect(() => registerTmpscript({ path: f.filePath }, f)).toThrow('reread before retrying');
      expect(loadManifest(f).entries).toHaveLength(1);
    } finally {
      vi.mocked(fs.unlinkSync).mockImplementation(actual.unlinkSync);
    }
  });
});

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { runSignedOverrideCli } from '../cli.js';
import { buildOwnerOverridePayload } from '../signed-override.js';

vi.mock('node:child_process', () => ({ execFileSync: vi.fn() }));
const head = 'a'.repeat(40);
let directory: string;
afterEach(() => {
  if (directory) rmSync(directory, { recursive: true, force: true });
  vi.restoreAllMocks();
  vi.clearAllMocks();
});
describe('owner override preparation helper', () => {
  it('prepares exact current-head payload and never invokes signing', () => {
    directory = mkdtempSync(join(tmpdir(), 'override-cli-fixture-'));
    vi.mocked(execFileSync).mockReturnValue(`${head}\n`);
    const out = join(directory, 'payload');
    expect(
      runSignedOverrideCli([
        'prepare',
        '--repo',
        'RevealUIStudio/revdev',
        '--pr',
        '270',
        '--gate',
        'prove-red',
        '--expires',
        '2099-01-01',
        '--out',
        out,
      ]),
    ).toBe(0);
    expect(readFileSync(out, 'utf8')).toBe(
      buildOwnerOverridePayload(
        { repo: 'RevealUIStudio/revdev', pr: 270, head, gate: 'prove-red' },
        '2099-01-01',
      ),
    );
    expect(vi.mocked(execFileSync).mock.calls.every(([program]) => program === 'gh')).toBe(true);
  });
  it.each(['sign', 'keygen', 'verify'])(
    'retires unsupported %s command without subprocesses',
    (command) => {
      vi.mocked(execFileSync).mockClear();
      expect(runSignedOverrideCli([command])).toBe(1);
      expect(execFileSync).not.toHaveBeenCalled();
    },
  );
  it('rejects stale prepared head before posting', () => {
    directory = mkdtempSync(join(tmpdir(), 'override-cli-fixture-'));
    const payload = join(directory, 'payload');
    writeFileSync(
      payload,
      buildOwnerOverridePayload(
        { repo: 'RevealUIStudio/revdev', pr: 270, head: 'b'.repeat(40), gate: 'prove-red' },
        '2099-01-01',
      ),
    );
    vi.mocked(execFileSync).mockReturnValue(`${head}\n`);
    vi.mocked(execFileSync).mockClear();
    expect(
      runSignedOverrideCli([
        'post',
        '--repo',
        'RevealUIStudio/revdev',
        '--pr',
        '270',
        '--gate',
        'prove-red',
        '--payload-file',
        payload,
        '--signature-file',
        join(directory, 'sig'),
      ]),
    ).toBe(1);
    expect(execFileSync).toHaveBeenCalledTimes(1);
  });
  it('posts only the externally supplied envelope for the current head through stdin', () => {
    directory = mkdtempSync(join(tmpdir(), 'override-cli-fixture-'));
    const payload = join(directory, 'payload');
    const signature = join(directory, 'signature');
    writeFileSync(
      payload,
      buildOwnerOverridePayload(
        { repo: 'RevealUIStudio/revdev', pr: 270, head, gate: 'prove-red' },
        '2099-01-01',
      ),
    );
    writeFileSync(
      signature,
      '-----BEGIN SSH SIGNATURE-----\nsynthetic-transport-only\n-----END SSH SIGNATURE-----\n',
    );
    vi.mocked(execFileSync).mockReturnValue(`${head}\n`);
    expect(
      runSignedOverrideCli([
        'post',
        '--repo',
        'RevealUIStudio/revdev',
        '--pr',
        '270',
        '--gate',
        'prove-red',
        '--payload-file',
        payload,
        '--signature-file',
        signature,
      ]),
    ).toBe(0);
    expect(execFileSync).toHaveBeenCalledTimes(2);
    expect(vi.mocked(execFileSync).mock.calls[1]?.[1]).toEqual([
      'pr',
      'comment',
      '270',
      '--repo',
      'RevealUIStudio/revdev',
      '--body-file',
      '-',
    ]);
    expect(vi.mocked(execFileSync).mock.calls[1]?.[2]).toMatchObject({
      input: expect.stringContaining('REVEALFLEET-OVERRIDE-BEGIN'),
    });
  });
  it('rejects passphrase flags instead of creating a new signing path', () => {
    expect(runSignedOverrideCli(['prepare', '--passphrase-file', '/unread-secret'])).toBe(1);
    expect(execFileSync).not.toHaveBeenCalled();
  });
});

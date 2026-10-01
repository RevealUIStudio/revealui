import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { runSignedOverrideCli } from '../cli.js';
import { buildOwnerOverridePayload, verifyOwnerOverrideComments } from '../signed-override.js';

vi.mock('node:child_process', async (importOriginal) => ({
  ...(await importOriginal<typeof import('node:child_process')>()),
  execFileSync: vi.fn(),
}));
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

it('prepares and posts an externally signed real SSHSIG that the shared gate accepts', async () => {
  const realProcess =
    await vi.importActual<typeof import('node:child_process')>('node:child_process');
  directory = mkdtempSync(join(tmpdir(), 'owner-helper-roundtrip-'));
  const key = join(directory, 'owner');
  realProcess.execFileSync('ssh-keygen', ['-t', 'ed25519', '-N', '', '-f', key], { stdio: 'pipe' });
  const payload = join(directory, 'payload');
  const expires = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  vi.mocked(execFileSync).mockReturnValue(`${head}\n`);
  vi.mocked(execFileSync).mockClear();
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
      expires,
      '--out',
      payload,
    ]),
  ).toBe(0);
  // Only this explicit synthetic fixture signs; production helper has no signing command.
  realProcess.execFileSync(
    'ssh-keygen',
    ['-Y', 'sign', '-f', key, '-n', 'revealfleet-override', payload],
    { stdio: 'pipe' },
  );
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
      `${payload}.sig`,
    ]),
  ).toBe(0);
  const posted = vi.mocked(execFileSync).mock.calls.at(-1)?.[2] as { input: string };
  const comment = posted.input;
  expect(comment).toContain(readFileSync(`${payload}.sig`, 'utf8').trim());
  expect(comment).toContain(readFileSync(payload, 'utf8'));
  expect(
    verifyOwnerOverrideComments({
      comments: [{ body: comment }],
      allowedSigners: `owner@revealui.com ${readFileSync(`${key}.pub`, 'utf8')}`,
      expected: { repo: 'RevealUIStudio/revdev', pr: 270, head, gate: 'prove-red' },
    }).ok,
  ).toBe(true);
});

import { createPrivateKey, createPublicKey, verify } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { runSignedOverrideCli } from '../cli.js';
import {
  canonicalOverridePayload,
  generateEncryptedKeypair,
  isPathInside,
  type OverridePayload,
  overrideAllowed,
  PRIVATE_KEY_FILENAME,
  PUBLIC_KEY_FILENAME,
  SignedOverrideError,
  signOverride,
  type Verification,
  verifyOverride,
  writeEncryptedKeypair,
} from '../signed-override.js';

const SHA_A = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const SHA_B = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const PASSPHRASE = 'test-passphrase-gap-313';
const NOW = new Date('2026-09-23T12:00:00.000Z');
const FUTURE = '2026-09-23T13:00:00.000Z';
const CLI_EXPIRES = '2099-01-01T00:00:00.000Z';
const PAST = '2026-09-23T11:00:00.000Z';
const REPO_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));

const tempDirs: string[] = [];

function freshDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'signed-override-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
  tempDirs.length = 0;
});

function payload(overrides: Partial<OverridePayload> = {}): OverridePayload {
  return {
    repo: 'RevealUIStudio/revealui',
    pr_number: 313,
    head_sha: SHA_A,
    gate_name: 'Security review',
    expires_at: FUTURE,
    ...overrides,
  };
}

function expectedFrom(body: OverridePayload) {
  return {
    repo: body.repo,
    pr_number: body.pr_number,
    head_sha: body.head_sha,
    gate_name: body.gate_name,
  };
}

describe('canonical payload', () => {
  it('sorts keys and emits no extra whitespace', () => {
    const body = payload();
    const canonical = canonicalOverridePayload(body);
    expect(canonical).toBe(
      `{"expires_at":"${FUTURE}","gate_name":"Security review","head_sha":"${SHA_A}","pr_number":313,"repo":"RevealUIStudio/revealui"}`,
    );
    expect(canonical.includes(': ')).toBe(false);
    expect(canonical.includes(', ')).toBe(false);
  });
});

describe('keygen', () => {
  it('writes an encrypted private key and a public key only under a temp dir', () => {
    const dir = freshDir();
    const paths = writeEncryptedKeypair(dir, PASSPHRASE);
    expect(paths.privateKeyPath.startsWith(dir)).toBe(true);
    expect(paths.publicKeyPath.startsWith(dir)).toBe(true);
    expect(isPathInside(REPO_ROOT, paths.privateKeyPath)).toBe(false);

    const privatePem = readFileSync(paths.privateKeyPath, 'utf8');
    const publicPem = readFileSync(paths.publicKeyPath, 'utf8');
    expect(privatePem.includes('BEGIN ENCRYPTED PRIVATE KEY')).toBe(true);
    expect(privatePem.includes('BEGIN PRIVATE KEY')).toBe(false);
    expect(publicPem.includes('BEGIN PUBLIC KEY')).toBe(true);
    expect(() => createPrivateKey(privatePem)).toThrow();
    expect(existsSync(join(REPO_ROOT, 'scripts/gates/signed-override', PRIVATE_KEY_FILENAME))).toBe(
      false,
    );
    expect(existsSync(join(REPO_ROOT, 'scripts/gates/signed-override', PUBLIC_KEY_FILENAME))).toBe(
      false,
    );
  });

  it('refuses keygen output inside the repository', () => {
    const stderr: string[] = [];
    const code = runSignedOverrideCli(['keygen', '--out-dir', 'scripts/gates/signed-override'], {
      cwd: REPO_ROOT,
      env: { SIGNED_OVERRIDE_PASSPHRASE: PASSPHRASE },
      stderr: (chunk) => {
        stderr.push(chunk);
      },
      stdout: () => undefined,
    });
    expect(code).toBe(2);
    expect(stderr.join('')).toContain('refusing to write key material');
    expect(existsSync(join(REPO_ROOT, 'scripts/gates/signed-override', PRIVATE_KEY_FILENAME))).toBe(
      false,
    );
  });
});

describe('sign and verify', () => {
  it('accepts a matching unexpired payload', () => {
    const { privateKeyPem, publicKeyPem } = generateEncryptedKeypair(PASSPHRASE);
    const body = payload();
    const blob = signOverride(body, privateKeyPem, PASSPHRASE);
    const canonical = canonicalOverridePayload(blob.payload);
    const cryptoOk = verify(
      null,
      Buffer.from(canonical, 'utf8'),
      createPublicKey(publicKeyPem),
      Buffer.from(blob.signature, 'base64'),
    );
    expect(cryptoOk).toBe(true);
    const verification = verifyOverride({
      blob,
      publicKeyPem,
      expected: expectedFrom(body),
      now: NOW,
    });
    expect(verification).toEqual({ ok: true });
  });

  it('rejects a wrong head SHA even when the signature matches the signed payload', () => {
    const { privateKeyPem, publicKeyPem } = generateEncryptedKeypair(PASSPHRASE);
    const body = payload();
    const blob = signOverride(body, privateKeyPem, PASSPHRASE);
    const verification = verifyOverride({
      blob,
      publicKeyPem,
      expected: expectedFrom(payload({ head_sha: SHA_B })),
      now: NOW,
    });
    expect(verification.ok).toBe(false);
    expect(verification.reason).toBe('wrong-sha');
  });

  it('rejects a payload whose head SHA was swapped after signing', () => {
    const { privateKeyPem, publicKeyPem } = generateEncryptedKeypair(PASSPHRASE);
    const blob = signOverride(payload(), privateKeyPem, PASSPHRASE);
    const swapped = { ...blob, payload: { ...blob.payload, head_sha: SHA_B } };
    const verification = verifyOverride({
      blob: swapped,
      publicKeyPem,
      expected: expectedFrom(payload({ head_sha: SHA_B })),
      now: NOW,
    });
    expect(verification.ok).toBe(false);
    expect(verification.reason).toBe('bad-signature');
  });

  it('rejects a wrong gate', () => {
    const { privateKeyPem, publicKeyPem } = generateEncryptedKeypair(PASSPHRASE);
    const blob = signOverride(payload(), privateKeyPem, PASSPHRASE);
    const verification = verifyOverride({
      blob,
      publicKeyPem,
      expected: expectedFrom(payload({ gate_name: 'Other gate' })),
      now: NOW,
    });
    expect(verification).toEqual({ ok: false, reason: 'wrong-gate' });
  });

  it('rejects a wrong repo', () => {
    const { privateKeyPem, publicKeyPem } = generateEncryptedKeypair(PASSPHRASE);
    const blob = signOverride(payload(), privateKeyPem, PASSPHRASE);
    const verification = verifyOverride({
      blob,
      publicKeyPem,
      expected: expectedFrom(payload({ repo: 'RevealUIStudio/other' })),
      now: NOW,
    });
    expect(verification).toEqual({ ok: false, reason: 'wrong-repo' });
  });

  it('rejects a wrong PR', () => {
    const { privateKeyPem, publicKeyPem } = generateEncryptedKeypair(PASSPHRASE);
    const blob = signOverride(payload(), privateKeyPem, PASSPHRASE);
    const verification = verifyOverride({
      blob,
      publicKeyPem,
      expected: expectedFrom(payload({ pr_number: 314 })),
      now: NOW,
    });
    expect(verification).toEqual({ ok: false, reason: 'wrong-pr' });
  });

  it('rejects an expired payload', () => {
    const { privateKeyPem, publicKeyPem } = generateEncryptedKeypair(PASSPHRASE);
    const body = payload({ expires_at: PAST });
    const blob = signOverride(body, privateKeyPem, PASSPHRASE);
    const verification = verifyOverride({
      blob,
      publicKeyPem,
      expected: expectedFrom(body),
      now: NOW,
    });
    expect(verification).toEqual({ ok: false, reason: 'expired' });
  });

  it('rejects a payload that expires at the current instant', () => {
    const { privateKeyPem, publicKeyPem } = generateEncryptedKeypair(PASSPHRASE);
    const body = payload({ expires_at: NOW.toISOString() });
    const blob = signOverride(body, privateKeyPem, PASSPHRASE);
    const verification = verifyOverride({
      blob,
      publicKeyPem,
      expected: expectedFrom(body),
      now: NOW,
    });
    expect(verification).toEqual({ ok: false, reason: 'expired' });
  });

  it('rejects a bad passphrase and does not produce a signature', () => {
    const { privateKeyPem } = generateEncryptedKeypair(PASSPHRASE);
    let caught: unknown;
    try {
      signOverride(payload(), privateKeyPem, 'wrong-passphrase');
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(SignedOverrideError);
    if (!(caught instanceof SignedOverrideError)) {
      throw new Error('expected SignedOverrideError');
    }
    expect(caught.code).toBe('bad-passphrase');
  });

  it('rejects a tampered signature', () => {
    const { privateKeyPem, publicKeyPem } = generateEncryptedKeypair(PASSPHRASE);
    const body = payload();
    const blob = signOverride(body, privateKeyPem, PASSPHRASE);
    const flipped = blob.signature[0] === 'A' ? 'B' : 'A';
    const tampered = { ...blob, signature: `${flipped}${blob.signature.slice(1)}` };
    const verification = verifyOverride({
      blob: tampered,
      publicKeyPem,
      expected: expectedFrom(body),
      now: NOW,
    });
    expect(verification.ok).toBe(false);
    expect(verification.reason).toBe('bad-signature');
  });

  it('rejects an unsigned artifact', () => {
    const { publicKeyPem } = generateEncryptedKeypair(PASSPHRASE);
    const body = payload();
    const verification = verifyOverride({
      blob: { v: 1, alg: 'Ed25519', payload: body, signature: '' },
      publicKeyPem,
      expected: expectedFrom(body),
      now: NOW,
    });
    expect(verification.ok).toBe(false);
    expect(verification.reason).toBe('bad-signature');
  });
});

describe('overrideAllowed', () => {
  const ok: Verification = { ok: true };
  const rejected: Verification = { ok: false, reason: 'bad-artifact' };

  it('is false for a label alone', () => {
    expect(overrideAllowed({ labelPresent: true, verification: rejected })).toBe(false);
  });

  it('is false for a valid signature without the label', () => {
    expect(overrideAllowed({ labelPresent: false, verification: ok })).toBe(false);
  });

  it('is true only when the label and verification.ok are both present', () => {
    expect(overrideAllowed({ labelPresent: true, verification: ok })).toBe(true);
  });

  it('is false when neither the label nor verification is present', () => {
    expect(overrideAllowed({ labelPresent: false, verification: rejected })).toBe(false);
  });
});

describe('cli roundtrip', () => {
  it('signs and verifies an artifact from a temp key directory', () => {
    const dir = freshDir();
    const stdout: string[] = [];
    const stderr: string[] = [];
    const io = {
      cwd: REPO_ROOT,
      env: { SIGNED_OVERRIDE_PASSPHRASE: PASSPHRASE },
      stdout: (chunk: string) => {
        stdout.push(chunk);
      },
      stderr: (chunk: string) => {
        stderr.push(chunk);
      },
    };
    expect(runSignedOverrideCli(['keygen', '--out-dir', dir], io)).toBe(0);
    const signed = join(dir, 'signed-override.json');
    expect(
      runSignedOverrideCli(
        [
          'sign',
          '--private-key',
          join(dir, PRIVATE_KEY_FILENAME),
          '--repo',
          'RevealUIStudio/revealui',
          '--pr',
          '313',
          '--head-sha',
          SHA_A,
          '--gate',
          'Security review',
          '--expires',
          CLI_EXPIRES,
          '--out',
          signed,
        ],
        io,
      ),
    ).toBe(0);
    expect(existsSync(signed)).toBe(true);
    const verifyOut: string[] = [];
    const code = runSignedOverrideCli(
      [
        'verify',
        '--public-key',
        join(dir, PUBLIC_KEY_FILENAME),
        '--artifact',
        signed,
        '--repo',
        'RevealUIStudio/revealui',
        '--pr',
        '313',
        '--head-sha',
        SHA_A,
        '--gate',
        'Security review',
      ],
      {
        ...io,
        stdout: (chunk: string) => {
          verifyOut.push(chunk);
        },
      },
    );
    expect(stderr.join('')).toBe('');
    expect(code).toBe(0);
    expect(verifyOut.join('')).toBe('ok\n');
    expect(readFileSync(join(dir, PRIVATE_KEY_FILENAME), 'utf8')).toContain(
      'BEGIN ENCRYPTED PRIVATE KEY',
    );
  });

  it('rejects a bad passphrase file while signing', () => {
    const dir = freshDir();
    writeEncryptedKeypair(dir, PASSPHRASE);
    const passFile = join(dir, 'passphrase');
    writeFileSync(passFile, 'not-the-passphrase\n', { mode: 0o600 });
    const stderr: string[] = [];
    const code = runSignedOverrideCli(
      [
        'sign',
        '--private-key',
        join(dir, PRIVATE_KEY_FILENAME),
        '--passphrase-file',
        passFile,
        '--repo',
        'RevealUIStudio/revealui',
        '--pr',
        '313',
        '--head-sha',
        SHA_A,
        '--gate',
        'Security review',
        '--expires',
        FUTURE,
        '--out',
        join(dir, 'signed-override.json'),
      ],
      {
        cwd: dir,
        env: {},
        stderr: (chunk) => {
          stderr.push(chunk);
        },
        stdout: () => undefined,
      },
    );
    expect(code).toBe(1);
    expect(stderr.join('')).toContain('could not decrypt private key');
    expect(existsSync(join(dir, 'signed-override.json'))).toBe(false);
  });
});

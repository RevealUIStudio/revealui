import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  buildOwnerOverrideComment,
  buildOwnerOverridePayload,
  OWNER_OVERRIDE_IDENTITY,
  OWNER_OVERRIDE_NAMESPACE,
  verifyOwnerOverrideComments,
} from '../signed-override.js';

const expected = {
  repo: 'RevealUIStudio/revdev',
  pr: 270,
  head: 'a'.repeat(40),
  gate: 'prove-red',
};
const now = new Date('2026-09-30T12:00:00Z');
let directory: string;
let allowedSigners: string;
function signed(
  context = expected,
  expires = '2026-10-07',
  namespace = OWNER_OVERRIDE_NAMESPACE,
  key = 'owner',
) {
  const payload = buildOwnerOverridePayload(context, expires);
  const file = join(directory, `payload-${Math.random().toString(16).slice(2)}`);
  writeFileSync(file, payload);
  execFileSync('ssh-keygen', ['-Y', 'sign', '-f', join(directory, key), '-n', namespace, file], {
    stdio: 'pipe',
  });
  return buildOwnerOverrideComment(payload, readFileSync(`${file}.sig`, 'utf8'));
}
function verify(body: string, anchor = allowedSigners) {
  return verifyOwnerOverrideComments({
    comments: [{ body, url: 'https://github.example/comment/1' }],
    allowedSigners: anchor,
    expected,
    now,
  });
}
beforeAll(() => {
  directory = mkdtempSync(join(tmpdir(), 'owner-override-fixture-'));
  for (const key of ['owner', 'forger'])
    execFileSync('ssh-keygen', ['-t', 'ed25519', '-N', '', '-f', join(directory, key)], {
      stdio: 'pipe',
    });
  allowedSigners = `${OWNER_OVERRIDE_IDENTITY} ${readFileSync(join(directory, 'owner.pub'), 'utf8')}`;
});
afterAll(() => rmSync(directory, { recursive: true, force: true }));
describe('owner SSHSIG override', () => {
  it('binds canonical bytes and reports the untrusted transport URL after real verification', () => {
    expect(buildOwnerOverridePayload(expected, '2026-10-07')).toBe(
      `revealfleet-override v1 repo=RevealUIStudio/revdev pr=270 head=${'a'.repeat(40)} gate=prove-red expires=2026-10-07\n`,
    );
    expect(verify(signed())).toEqual({ ok: true, url: 'https://github.example/comment/1' });
  });
  it.each(['repo', 'pr', 'head', 'gate'] as const)('rejects a signed but wrong %s', (field) => {
    const context = {
      ...expected,
      [field]:
        field === 'pr'
          ? 271
          : field === 'head'
            ? 'b'.repeat(40)
            : field === 'repo'
              ? 'RevealUIStudio/revealui'
              : 'sec-review',
    };
    expect(verify(signed(context))).toMatchObject({ ok: false, reason: 'wrong-context' });
  });
  it('rejects a signature forged by another real SSH key', () =>
    expect(
      verify(signed(expected, '2026-10-07', OWNER_OVERRIDE_NAMESPACE, 'forger')),
    ).toMatchObject({ ok: false, reason: 'bad-owner-signature' }));
  it('rejects replay from another SSHSIG namespace', () =>
    expect(verify(signed(expected, '2026-10-07', 'git'))).toMatchObject({
      ok: false,
      reason: 'bad-owner-signature',
    }));
  it('rejects a changed payload even when it now matches the requested context', () => {
    const original = signed({ ...expected, head: 'b'.repeat(40) });
    expect(verify(original.replace('b'.repeat(40), 'a'.repeat(40)))).toMatchObject({
      ok: false,
      reason: 'bad-owner-signature',
    });
  });
  it.each(['2026-09-29', '2026-09-30'])('rejects expired date %s', (date) =>
    expect(verify(signed(expected, date))).toMatchObject({ ok: false, reason: 'expired' }),
  );
  it('rejects absent anchor without trusting an artifact key', () =>
    expect(verify(signed(), '')).toMatchObject({ ok: false, reason: 'missing-owner-anchor' }));
  it('requires the fixed owner identity', () =>
    expect(
      verify(signed(), allowedSigners.replace(OWNER_OVERRIDE_IDENTITY, 'agent@example.com')),
    ).toMatchObject({ ok: false, reason: 'bad-owner-signature' }));
  it('rejects a label without a signature', () =>
    expect(verify('sec-review:approved\nverify:no-behavior-change')).toMatchObject({
      ok: false,
      reason: 'missing-owner-signature',
    }));
  it('bounds untrusted comment input without falling back to another anchor', () => {
    expect(
      verifyOwnerOverrideComments({
        comments: Array.from({ length: 1001 }, () => ({ body: '' })),
        allowedSigners,
        expected,
        now,
      }),
    ).toMatchObject({ ok: false, reason: 'owner-comment-limit' });
    expect(verify('x'.repeat(65537))).toMatchObject({ ok: false });
  });
  it('rejects old JSON artifacts and malformed envelopes', () => {
    expect(verify('{"alg":"Ed25519","signature":"anything"}')).toMatchObject({ ok: false });
    expect(verify(signed().replace('-----END SSH SIGNATURE-----', 'broken'))).toMatchObject({
      ok: false,
    });
  });
  it('accepts CRLF transport without changing the signed payload bytes', () =>
    expect(verify(signed().replaceAll('\n', '\r\n')).ok).toBe(true));
  it('scans newest comments first but requires valid signatures', () => {
    const result = verifyOwnerOverrideComments({
      comments: [
        { body: signed(), url: 'valid' },
        { body: signed(expected, '2026-10-07', OWNER_OVERRIDE_NAMESPACE, 'forger'), url: 'forged' },
      ],
      allowedSigners,
      expected,
      now,
    });
    expect(result).toEqual({ ok: true, url: 'valid' });
  });
  it('rejects invalid calendar dates, injectable context and invalid clocks', () => {
    expect(() => buildOwnerOverridePayload(expected, '2026-02-30')).toThrow();
    expect(() =>
      buildOwnerOverridePayload(
        { ...expected, gate: 'prove-red expires=2099-01-01' },
        '2026-10-07',
      ),
    ).toThrow();
    expect(
      verifyOwnerOverrideComments({
        comments: [],
        allowedSigners,
        expected,
        now: new Date('invalid'),
      }),
    ).toMatchObject({ ok: false, reason: 'invalid-clock' });
  });
});

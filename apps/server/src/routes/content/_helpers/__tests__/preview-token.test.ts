/**
 * Preview-token mint/verify unit tests: round-trip, expiry, tampering, timing-safe path.
 */

import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  mintPreviewToken,
  PREVIEW_TOKEN_TTL_SECONDS,
  verifyPreviewToken,
} from '../preview-token.js';

const SECRET = 'unit-test-secret-not-a-real-key';

describe('mintPreviewToken / verifyPreviewToken', () => {
  it('round-trips a valid token', () => {
    const { token, exp } = mintPreviewToken(SECRET, 'session-abc');
    const result = verifyPreviewToken(SECRET, token);
    expect(result).toEqual({ ok: true, sid: 'session-abc', exp });
  });

  it('sets exp to now + TTL', () => {
    const before = Math.floor(Date.now() / 1000);
    const { exp } = mintPreviewToken(SECRET, 'session-abc', PREVIEW_TOKEN_TTL_SECONDS);
    expect(exp).toBeGreaterThanOrEqual(before + PREVIEW_TOKEN_TTL_SECONDS - 1);
    expect(exp).toBeLessThanOrEqual(before + PREVIEW_TOKEN_TTL_SECONDS + 1);
  });

  it('rejects an expired token', () => {
    const { token } = mintPreviewToken(SECRET, 'session-abc', -10);
    const result = verifyPreviewToken(SECRET, token);
    expect(result).toEqual({ ok: false, reason: 'expired' });
  });

  it('rejects a tampered payload', () => {
    const { token } = mintPreviewToken(SECRET, 'session-abc');
    const [, sig] = token.split('.');
    const forgedPayload = Buffer.from(
      JSON.stringify({ sid: 'session-evil', exp: Math.floor(Date.now() / 1000) + 600 }),
      'utf8',
    ).toString('base64url');
    const result = verifyPreviewToken(SECRET, `${forgedPayload}.${sig}`);
    expect(result).toEqual({ ok: false, reason: 'bad_signature' });
  });

  it('rejects a tampered signature', () => {
    const { token } = mintPreviewToken(SECRET, 'session-abc');
    const [payload] = token.split('.');
    const otherSig = mintPreviewToken(SECRET, 'other-session').token.split('.')[1];
    const result = verifyPreviewToken(SECRET, `${payload}.${otherSig}`);
    expect(result).toEqual({ ok: false, reason: 'bad_signature' });
  });

  it('rejects a token signed with a different secret', () => {
    const { token } = mintPreviewToken('a-different-secret', 'session-abc');
    const result = verifyPreviewToken(SECRET, token);
    expect(result).toEqual({ ok: false, reason: 'bad_signature' });
  });

  it('rejects malformed tokens', () => {
    expect(verifyPreviewToken(SECRET, '')).toEqual({ ok: false, reason: 'malformed' });
    expect(verifyPreviewToken(SECRET, 'no-dot')).toEqual({ ok: false, reason: 'malformed' });
    expect(verifyPreviewToken(SECRET, '.onlysig')).toEqual({ ok: false, reason: 'malformed' });
    expect(verifyPreviewToken(SECRET, 'onlypayload.')).toEqual({ ok: false, reason: 'malformed' });
    expect(verifyPreviewToken(SECRET, 'a.b.c')).toEqual({ ok: false, reason: 'malformed' });
  });

  it('rejects a well-signed but non-payload body', () => {
    // Sign arbitrary base64url that is not JSON {sid,exp}: signature passes,
    // payload decode/shape fails -> malformed (never ok).
    const payloadB64 = Buffer.from('not json at all', 'utf8').toString('base64url');
    const sig = createHmac('sha256', SECRET).update(payloadB64).digest().toString('base64url');
    const result = verifyPreviewToken(SECRET, `${payloadB64}.${sig}`);
    expect(result).toEqual({ ok: false, reason: 'malformed' });
  });
});

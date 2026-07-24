import { describe, expect, it } from 'vitest';
import { getInvokeSecret, MAX_SKEW_SECONDS, signMintRequest, verifyMintRequest } from './auth.js';

const SECRET = 'test-signer-invoke-secret-do-not-use-in-prod';
const METHOD = 'POST';
const PATH = '/internal/mint';
const BODY = '{"tier":"pro","customerId":"cus_1"}';

describe('getInvokeSecret', () => {
  it('returns REVEALUI_SIGNER_INVOKE_SECRET', () => {
    expect(getInvokeSecret({ REVEALUI_SIGNER_INVOKE_SECRET: `  ${SECRET}  ` })).toBe(SECRET);
  });

  it('throws when missing (no REVEALUI_SECRET fallback)', () => {
    expect(() => getInvokeSecret({})).toThrow(/REVEALUI_SIGNER_INVOKE_SECRET/);
    expect(() => getInvokeSecret({ REVEALUI_SECRET: 'session-secret' })).toThrow(
      /no REVEALUI_SECRET fallback/,
    );
  });
});

describe('signMintRequest + verifyMintRequest', () => {
  it('accepts a correctly signed request within skew', () => {
    const now = 1_700_000_000;
    const sig = signMintRequest(SECRET, METHOD, PATH, BODY, now);
    const result = verifyMintRequest({
      secret: SECRET,
      method: METHOD,
      path: PATH,
      body: BODY,
      timestampHeader: String(now),
      signatureHeader: sig,
      nowSeconds: now,
    });
    expect(result).toEqual({ ok: true });
  });

  it('rejects missing headers', () => {
    expect(
      verifyMintRequest({
        secret: SECRET,
        method: METHOD,
        path: PATH,
        body: BODY,
        timestampHeader: undefined,
        signatureHeader: undefined,
      }),
    ).toEqual({ ok: false, reason: 'missing_headers' });
  });

  it('rejects non-numeric timestamp', () => {
    expect(
      verifyMintRequest({
        secret: SECRET,
        method: METHOD,
        path: PATH,
        body: BODY,
        timestampHeader: 'not-a-number',
        signatureHeader: 'ab',
      }),
    ).toEqual({ ok: false, reason: 'bad_timestamp' });
  });

  it('rejects skew beyond MAX_SKEW_SECONDS', () => {
    const now = 1_700_000_000;
    const ts = now - (MAX_SKEW_SECONDS + 1);
    const sig = signMintRequest(SECRET, METHOD, PATH, BODY, ts);
    expect(
      verifyMintRequest({
        secret: SECRET,
        method: METHOD,
        path: PATH,
        body: BODY,
        timestampHeader: String(ts),
        signatureHeader: sig,
        nowSeconds: now,
      }),
    ).toEqual({ ok: false, reason: 'skew' });
  });

  it('rejects wrong signature', () => {
    const now = 1_700_000_000;
    const sig = signMintRequest(SECRET, METHOD, PATH, BODY, now);
    // Flip last nibble
    const bad = `${sig.slice(0, -1)}${sig.endsWith('0') ? '1' : '0'}`;
    expect(
      verifyMintRequest({
        secret: SECRET,
        method: METHOD,
        path: PATH,
        body: BODY,
        timestampHeader: String(now),
        signatureHeader: bad,
        nowSeconds: now,
      }),
    ).toEqual({ ok: false, reason: 'bad_signature' });
  });

  it('rejects when body is tampered', () => {
    const now = 1_700_000_000;
    const sig = signMintRequest(SECRET, METHOD, PATH, BODY, now);
    expect(
      verifyMintRequest({
        secret: SECRET,
        method: METHOD,
        path: PATH,
        body: '{"tier":"enterprise","customerId":"cus_1"}',
        timestampHeader: String(now),
        signatureHeader: sig,
        nowSeconds: now,
      }),
    ).toEqual({ ok: false, reason: 'bad_signature' });
  });

  it('normalizes method case when signing/verifying', () => {
    const now = 1_700_000_000;
    const sig = signMintRequest(SECRET, 'post', PATH, BODY, now);
    expect(
      verifyMintRequest({
        secret: SECRET,
        method: 'POST',
        path: PATH,
        body: BODY,
        timestampHeader: String(now),
        signatureHeader: sig,
        nowSeconds: now,
      }),
    ).toEqual({ ok: true });
  });
});

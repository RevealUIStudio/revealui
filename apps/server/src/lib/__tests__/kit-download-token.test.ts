import { afterEach, describe, expect, it } from 'vitest';
import { mintKitDownloadToken, verifyKitDownloadToken } from '../kit-download-token.js';

describe('kit download tokens', () => {
  const prev = process.env.REVEALUI_SECRET;

  afterEach(() => {
    if (prev === undefined) delete process.env.REVEALUI_SECRET;
    else process.env.REVEALUI_SECRET = prev;
  });

  it('round-trips a valid token', () => {
    process.env.REVEALUI_SECRET = 'test-secret-for-kit-tokens-only';
    const token = mintKitDownloadToken('fulfillment-abc');
    const result = verifyKitDownloadToken(token);
    expect(result).toEqual({ ok: true, fulfillmentId: 'fulfillment-abc' });
  });

  it('rejects tampered tokens', () => {
    process.env.REVEALUI_SECRET = 'test-secret-for-kit-tokens-only';
    const token = mintKitDownloadToken('fulfillment-abc');
    const bad = `${token.slice(0, -4)}xxxx`;
    expect(verifyKitDownloadToken(bad).ok).toBe(false);
  });

  it('rejects expired tokens', () => {
    process.env.REVEALUI_SECRET = 'test-secret-for-kit-tokens-only';
    const token = mintKitDownloadToken('fulfillment-abc', -10);
    const result = verifyKitDownloadToken(token);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('expired');
  });
});

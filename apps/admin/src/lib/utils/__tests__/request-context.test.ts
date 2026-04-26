import { resetClientIpConfig } from '@revealui/security';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { extractRequestContext } from '../request-context.js';

function makeRequest(headers: Record<string, string>): Request {
  return new Request('https://admin.example/test', { headers });
}

describe('extractRequestContext (admin / WHATWG Request)', () => {
  // Keep the trusted-proxy-aware extractor's default config consistent across
  // tests. The admin app calls `configureClientIp({ trustedProxyCount: 1 })`
  // at startup; tests reset between cases for isolation.
  beforeEach(() => {
    resetClientIpConfig();
  });
  afterEach(() => {
    resetClientIpConfig();
  });

  it('reads user-agent header', () => {
    const ctx = extractRequestContext(makeRequest({ 'user-agent': 'Mozilla/5.0 (test)' }));
    expect(ctx.userAgent).toBe('Mozilla/5.0 (test)');
  });

  it('returns undefined userAgent when header missing', () => {
    const ctx = extractRequestContext(makeRequest({}));
    expect(ctx.userAgent).toBeUndefined();
  });

  describe('IP extraction (trusted-proxy-aware, GAP-130)', () => {
    it('returns the single XFF entry when only one proxy hop is present', () => {
      const ctx = extractRequestContext(makeRequest({ 'x-forwarded-for': '203.0.113.1' }));
      expect(ctx.ipAddress).toBe('203.0.113.1');
    });

    it('REJECTS leftmost spoofed XFF entries (the GAP-130 defense)', () => {
      // Attacker sets their own X-Forwarded-For before reaching the proxy;
      // proxy appends the attacker's real IP. Trusted-proxy-aware extractor
      // returns the proxy-written value (real attacker IP), NOT the spoof.
      const ctx = extractRequestContext(
        makeRequest({ 'x-forwarded-for': '99.99.99.99, 203.0.113.1' }),
      );
      expect(ctx.ipAddress).toBe('203.0.113.1');
      expect(ctx.ipAddress).not.toBe('99.99.99.99');
    });

    it('handles multi-entry XFF correctly', () => {
      const ctx = extractRequestContext(
        makeRequest({ 'x-forwarded-for': '99.1.1.1, 99.2.2.2, 203.0.113.1' }),
      );
      expect(ctx.ipAddress).toBe('203.0.113.1');
    });

    it('falls back to x-real-ip when x-forwarded-for is absent', () => {
      const ctx = extractRequestContext(makeRequest({ 'x-real-ip': '203.0.113.9' }));
      expect(ctx.ipAddress).toBe('203.0.113.9');
    });

    it('prefers x-forwarded-for over x-real-ip when both are present', () => {
      const ctx = extractRequestContext(
        makeRequest({
          'x-forwarded-for': '203.0.113.1',
          'x-real-ip': '198.51.100.5',
        }),
      );
      expect(ctx.ipAddress).toBe('203.0.113.1');
    });

    it('returns undefined ipAddress when neither header is set (contract preserved)', () => {
      // getClientIp returns 'unknown' when no proxy headers present; our
      // wrapper converts to undefined so validateSessionBinding's
      // `if (ctx.ipAddress && session.ipAddress && …)` short-circuits.
      const ctx = extractRequestContext(makeRequest({}));
      expect(ctx.ipAddress).toBeUndefined();
    });
  });
});

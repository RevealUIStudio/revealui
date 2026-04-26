import { resetClientIpConfig } from '@revealui/security';
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { extractRequestContext } from '../request-context.js';

function extractFromRequest(headers: Record<string, string>) {
  return new Promise<{ userAgent: string | undefined; ipAddress: string | undefined }>(
    (resolve) => {
      const app = new Hono();
      app.get('/ctx', (c) => {
        resolve(extractRequestContext(c));
        return c.text('ok');
      });
      void app.request('/ctx', { headers });
    },
  );
}

describe('extractRequestContext (Hono)', () => {
  // Keep the trusted-proxy-aware extractor's default config consistent across
  // tests. The api app calls `configureClientIp({ trustedProxyCount: 1 })`
  // at startup; tests reset between cases for isolation.
  beforeEach(() => {
    resetClientIpConfig();
  });
  afterEach(() => {
    resetClientIpConfig();
  });

  it('reads user-agent header', async () => {
    const ctx = await extractFromRequest({ 'user-agent': 'Mozilla/5.0 (test)' });
    expect(ctx.userAgent).toBe('Mozilla/5.0 (test)');
  });

  it('returns undefined userAgent when header missing', async () => {
    const ctx = await extractFromRequest({});
    expect(ctx.userAgent).toBeUndefined();
  });

  describe('IP extraction (trusted-proxy-aware, GAP-130)', () => {
    it('returns the single XFF entry when only one proxy hop is present', async () => {
      // With trustedProxyCount=1 and a single entry, that entry was written
      // by the trusted proxy and represents the client peer.
      const ctx = await extractFromRequest({ 'x-forwarded-for': '203.0.113.1' });
      expect(ctx.ipAddress).toBe('203.0.113.1');
    });

    it('REJECTS leftmost spoofed XFF entries (the GAP-130 defense)', async () => {
      // Attacker sets their own X-Forwarded-For header before reaching the
      // proxy; the proxy then APPENDS the attacker's real IP. With
      // trustedProxyCount=1, the rightmost 1 entry was added by the trusted
      // proxy and that's the only entry we trust as client-IP origin. A
      // naive leftmost extractor would return '99.99.99.99' (the spoof);
      // the correct extractor returns '203.0.113.1' (real attacker IP as
      // seen by the proxy).
      const ctx = await extractFromRequest({
        'x-forwarded-for': '99.99.99.99, 203.0.113.1',
      });
      expect(ctx.ipAddress).toBe('203.0.113.1');
      expect(ctx.ipAddress).not.toBe('99.99.99.99');
    });

    it('handles multi-entry XFF correctly', async () => {
      // 3 entries with trustedProxyCount=1: the rightmost 1 is trusted; the
      // entry IMMEDIATELY before it (parts[length - trustedProxyCount] in
      // the implementation) is the trusted proxy's view of the client.
      const ctx = await extractFromRequest({
        'x-forwarded-for': '99.1.1.1, 99.2.2.2, 203.0.113.1',
      });
      expect(ctx.ipAddress).toBe('203.0.113.1');
    });

    it('falls back to x-real-ip when x-forwarded-for is absent', async () => {
      const ctx = await extractFromRequest({ 'x-real-ip': '203.0.113.9' });
      expect(ctx.ipAddress).toBe('203.0.113.9');
    });

    it('prefers x-forwarded-for over x-real-ip when both are present', async () => {
      const ctx = await extractFromRequest({
        'x-forwarded-for': '203.0.113.1',
        'x-real-ip': '198.51.100.5',
      });
      expect(ctx.ipAddress).toBe('203.0.113.1');
    });

    it('returns undefined ipAddress when neither header is set', async () => {
      // Contract preserved: getClientIp returns the literal string 'unknown'
      // when no proxy headers are present; our wrapper converts that to
      // undefined so validateSessionBinding's `if (ctx.ipAddress && ...)`
      // short-circuits the way it always has when no IP was available.
      const ctx = await extractFromRequest({});
      expect(ctx.ipAddress).toBeUndefined();
    });

    it('trims whitespace inside XFF entries', async () => {
      // Spec format allows whitespace after commas; the rightmost-untrusted
      // strategy still picks the correct entry after trimming.
      const ctx = await extractFromRequest({
        'x-forwarded-for': '   99.1.1.1   ,   203.0.113.1   ',
      });
      expect(ctx.ipAddress).toBe('203.0.113.1');
    });
  });
});

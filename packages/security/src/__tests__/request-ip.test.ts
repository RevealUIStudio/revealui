import { describe, it, expect, beforeEach } from 'vitest';
import { getClientIp, configureClientIp, resetClientIpConfig } from '../request-ip.js';

function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/', {
    headers: new Headers(headers),
  });
}

describe('getClientIp', () => {
  beforeEach(() => {
    resetClientIpConfig();
  });

  describe('default config (trustedProxyCount=1)', () => {
    it('extracts IP from single X-Forwarded-For entry', () => {
      const req = makeRequest({ 'x-forwarded-for': '203.0.113.50' });
      expect(getClientIp(req)).toBe('203.0.113.50');
    });

    it('extracts client IP from multi-hop X-Forwarded-For (rightmost untrusted)', () => {
      // Client spoofed a fake IP, proxy appended real client IP
      const req = makeRequest({ 'x-forwarded-for': '1.2.3.4, 203.0.113.50' });
      // With 1 trusted proxy, parts.length=2, clientIndex=2-1=1 → 203.0.113.50
      // Wait, that's the proxy-appended entry. Let me reconsider.
      // Actually: "1.2.3.4, 203.0.113.50"
      // parts = ["1.2.3.4", "203.0.113.50"]
      // clientIndex = 2 - 1 = 1 → "203.0.113.50"
      // This is correct — the last entry was added by the one trusted proxy,
      // and it contains the IP it received the connection from = real client.
      expect(getClientIp(req)).toBe('203.0.113.50');
    });

    it('ignores spoofed entries in X-Forwarded-For', () => {
      // Attacker sends: X-Forwarded-For: spoofed1, spoofed2
      // Proxy appends real IP: X-Forwarded-For: spoofed1, spoofed2, 203.0.113.50
      const req = makeRequest({
        'x-forwarded-for': '10.0.0.1, 192.168.1.1, 203.0.113.50',
      });
      // clientIndex = 3 - 1 = 2 → "203.0.113.50"
      expect(getClientIp(req)).toBe('203.0.113.50');
    });

    it('falls back to X-Real-IP when X-Forwarded-For is absent', () => {
      const req = makeRequest({ 'x-real-ip': '203.0.113.50' });
      expect(getClientIp(req)).toBe('203.0.113.50');
    });

    it('returns unknown when no IP headers present', () => {
      const req = makeRequest();
      expect(getClientIp(req)).toBe('unknown');
    });

    it('trims whitespace from IP values', () => {
      const req = makeRequest({ 'x-forwarded-for': ' 203.0.113.50 ' });
      expect(getClientIp(req)).toBe('203.0.113.50');
    });
  });

  describe('trustedProxyCount=0 (no proxy trust)', () => {
    it('ignores X-Forwarded-For entirely', () => {
      const req = makeRequest({ 'x-forwarded-for': '203.0.113.50' });
      expect(getClientIp(req, { trustedProxyCount: 0 })).toBe('unknown');
    });

    it('ignores X-Real-IP', () => {
      const req = makeRequest({ 'x-real-ip': '203.0.113.50' });
      expect(getClientIp(req, { trustedProxyCount: 0 })).toBe('unknown');
    });
  });

  describe('trustedProxyCount=2 (double proxy)', () => {
    it('skips two rightmost entries to find client IP', () => {
      // Client → CDN (proxy1) → Load Balancer (proxy2) → App
      // X-Forwarded-For: client, proxy1
      const req = makeRequest({
        'x-forwarded-for': '203.0.113.50, 198.51.100.1',
      });
      // clientIndex = 2 - 2 = 0 → "203.0.113.50"
      expect(getClientIp(req, { trustedProxyCount: 2 })).toBe('203.0.113.50');
    });

    it('handles spoofed entries with double proxy', () => {
      // Spoofed, Client, Proxy1
      const req = makeRequest({
        'x-forwarded-for': '10.0.0.1, 203.0.113.50, 198.51.100.1',
      });
      // clientIndex = 3 - 2 = 1 → "203.0.113.50"
      expect(getClientIp(req, { trustedProxyCount: 2 })).toBe('203.0.113.50');
    });

    it('falls back to first entry when fewer entries than proxy count', () => {
      const req = makeRequest({ 'x-forwarded-for': '203.0.113.50' });
      // clientIndex = 1 - 2 = -1, clamped to parts[0]
      expect(getClientIp(req, { trustedProxyCount: 2 })).toBe('203.0.113.50');
    });
  });

  describe('custom ipHeader', () => {
    it('reads from custom header when present', () => {
      const req = makeRequest({
        'cf-connecting-ip': '203.0.113.50',
        'x-forwarded-for': '10.0.0.1',
      });
      expect(getClientIp(req, { ipHeader: 'cf-connecting-ip' })).toBe('203.0.113.50');
    });

    it('falls back to X-Forwarded-For when custom header is absent', () => {
      const req = makeRequest({ 'x-forwarded-for': '203.0.113.50' });
      expect(getClientIp(req, { ipHeader: 'cf-connecting-ip' })).toBe('203.0.113.50');
    });

    it('ignores custom header when trustedProxyCount=0', () => {
      const req = makeRequest({ 'cf-connecting-ip': '203.0.113.50' });
      expect(getClientIp(req, { trustedProxyCount: 0, ipHeader: 'cf-connecting-ip' })).toBe(
        'unknown',
      );
    });
  });

  describe('configureClientIp (module-level defaults)', () => {
    it('applies configured defaults to subsequent calls', () => {
      configureClientIp({ trustedProxyCount: 0 });
      const req = makeRequest({ 'x-forwarded-for': '203.0.113.50' });
      expect(getClientIp(req)).toBe('unknown');
    });

    it('per-call config overrides module defaults', () => {
      configureClientIp({ trustedProxyCount: 0 });
      const req = makeRequest({ 'x-forwarded-for': '203.0.113.50' });
      expect(getClientIp(req, { trustedProxyCount: 1 })).toBe('203.0.113.50');
    });
  });
});

/**
 * Security Headers & CORS Tests
 *
 * Covers: SecurityHeaders, CORSManager, presets, middleware, rate limit headers.
 */

import { describe, expect, it } from 'vitest';
import {
  CORSManager,
  CORSPresets,
  createSecurityMiddleware,
  SecurityHeaders,
  SecurityPresets,
  setRateLimitHeaders,
} from '../headers.js';

// =============================================================================
// SecurityHeaders
// =============================================================================

describe('SecurityHeaders', () => {
  it('returns X-Content-Type-Options by default', () => {
    const sh = new SecurityHeaders();
    const headers = sh.getHeaders();
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
  });

  it('builds CSP from string config', () => {
    const sh = new SecurityHeaders({
      contentSecurityPolicy: "default-src 'self'",
    });
    expect(sh.getHeaders()['Content-Security-Policy']).toBe("default-src 'self'");
  });

  it('builds CSP from object config with multiple directives', () => {
    const sh = new SecurityHeaders({
      contentSecurityPolicy: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", 'https://cdn.example.com'],
        imgSrc: ["'self'", 'data:'],
        upgradeInsecureRequests: true,
      },
    });
    const csp = sh.getHeaders()['Content-Security-Policy'];
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self' https://cdn.example.com");
    expect(csp).toContain('upgrade-insecure-requests');
  });

  it('builds HSTS with boolean true', () => {
    const sh = new SecurityHeaders({ strictTransportSecurity: true });
    expect(sh.getHeaders()['Strict-Transport-Security']).toBe(
      'max-age=31536000; includeSubDomains',
    );
  });

  it('builds HSTS with custom config including preload', () => {
    const sh = new SecurityHeaders({
      strictTransportSecurity: { maxAge: 63072000, includeSubDomains: true, preload: true },
    });
    const hsts = sh.getHeaders()['Strict-Transport-Security'];
    expect(hsts).toBe('max-age=63072000; includeSubDomains; preload');
  });

  it('sets X-Frame-Options', () => {
    const sh = new SecurityHeaders({ xFrameOptions: 'DENY' });
    expect(sh.getHeaders()['X-Frame-Options']).toBe('DENY');
  });

  it('sets Referrer-Policy', () => {
    const sh = new SecurityHeaders({ referrerPolicy: 'strict-origin' });
    expect(sh.getHeaders()['Referrer-Policy']).toBe('strict-origin');
  });

  it('builds Permissions-Policy from string', () => {
    const sh = new SecurityHeaders({ permissionsPolicy: 'camera=(), microphone=()' });
    expect(sh.getHeaders()['Permissions-Policy']).toBe('camera=(), microphone=()');
  });

  it('builds Permissions-Policy from object config', () => {
    const sh = new SecurityHeaders({
      permissionsPolicy: {
        camera: [],
        geolocation: ['self'],
        fullscreen: ['*'],
      },
    });
    const pp = sh.getHeaders()['Permissions-Policy'];
    expect(pp).toContain('camera=()');
    expect(pp).toContain('geolocation=("self")');
    expect(pp).toContain('fullscreen=*');
  });

  it('sets cross-origin headers', () => {
    const sh = new SecurityHeaders({
      crossOriginEmbedderPolicy: 'require-corp',
      crossOriginOpenerPolicy: 'same-origin',
      crossOriginResourcePolicy: 'same-origin',
    });
    const h = sh.getHeaders();
    expect(h['Cross-Origin-Embedder-Policy']).toBe('require-corp');
    expect(h['Cross-Origin-Opener-Policy']).toBe('same-origin');
    expect(h['Cross-Origin-Resource-Policy']).toBe('same-origin');
  });

  it('applyHeaders sets headers on a Response', () => {
    const sh = new SecurityHeaders({ xFrameOptions: 'DENY' });
    const response = new Response('ok');
    sh.applyHeaders(response);
    expect(response.headers.get('X-Frame-Options')).toBe('DENY');
  });
});

// =============================================================================
// CORSManager
// =============================================================================

describe('CORSManager', () => {
  it('allows wildcard origin', () => {
    const cors = new CORSManager({ origin: '*' });
    expect(cors.isOriginAllowed('https://any.com')).toBe(true);
  });

  it('allows specific string origin', () => {
    const cors = new CORSManager({ origin: 'https://app.revealui.com' });
    expect(cors.isOriginAllowed('https://app.revealui.com')).toBe(true);
    expect(cors.isOriginAllowed('https://evil.com')).toBe(false);
  });

  it('allows origin from array', () => {
    const cors = new CORSManager({ origin: ['https://a.com', 'https://b.com'] });
    expect(cors.isOriginAllowed('https://a.com')).toBe(true);
    expect(cors.isOriginAllowed('https://c.com')).toBe(false);
  });

  it('allows origin via function', () => {
    const cors = new CORSManager({
      origin: (o: string) => o.endsWith('.revealui.com'),
    });
    expect(cors.isOriginAllowed('https://app.revealui.com')).toBe(true);
    expect(cors.isOriginAllowed('https://evil.com')).toBe(false);
  });

  it('rejects when origin is empty array', () => {
    const cors = new CORSManager({ origin: [] });
    expect(cors.isOriginAllowed('https://any.com')).toBe(false);
  });

  it('getCORSHeaders sets Vary for non-wildcard origin', () => {
    const cors = new CORSManager({ origin: ['https://a.com'] });
    const headers = cors.getCORSHeaders('https://a.com');
    expect(headers.Vary).toBe('Origin');
    expect(headers['Access-Control-Allow-Origin']).toBe('https://a.com');
  });

  it('getCORSHeaders returns only Vary for disallowed origin', () => {
    const cors = new CORSManager({ origin: ['https://a.com'] });
    const headers = cors.getCORSHeaders('https://evil.com');
    expect(headers.Vary).toBe('Origin');
    expect(headers['Access-Control-Allow-Origin']).toBeUndefined();
  });

  it('sets credentials header when configured', () => {
    const cors = new CORSManager({ origin: ['https://a.com'], credentials: true });
    const headers = cors.getCORSHeaders('https://a.com');
    expect(headers['Access-Control-Allow-Credentials']).toBe('true');
  });

  it('omits credentials with wildcard origin', () => {
    const cors = new CORSManager({ origin: '*', credentials: true });
    const headers = cors.getCORSHeaders('https://a.com');
    expect(headers['Access-Control-Allow-Credentials']).toBeUndefined();
  });

  it('getPreflightHeaders includes methods and max-age', () => {
    const cors = new CORSManager({
      origin: ['https://a.com'],
      methods: ['GET', 'POST'],
      maxAge: 3600,
    });
    const headers = cors.getPreflightHeaders('https://a.com');
    expect(headers['Access-Control-Allow-Methods']).toBe('GET, POST');
    expect(headers['Access-Control-Max-Age']).toBe('3600');
  });

  it('getPreflightHeaders omits methods for disallowed origin', () => {
    const cors = new CORSManager({ origin: ['https://a.com'] });
    const headers = cors.getPreflightHeaders('https://evil.com');
    expect(headers['Access-Control-Allow-Methods']).toBeUndefined();
  });

  it('handlePreflight returns 403 for disallowed origin', () => {
    const cors = new CORSManager({ origin: ['https://a.com'] });
    const response = cors.handlePreflight(new Request('https://api.com'), 'https://evil.com');
    expect(response.status).toBe(403);
  });

  it('handlePreflight returns configured status for allowed origin', () => {
    const cors = new CORSManager({
      origin: ['https://a.com'],
      optionsSuccessStatus: 204,
    });
    const response = cors.handlePreflight(new Request('https://api.com'), 'https://a.com');
    expect(response.status).toBe(204);
  });

  it('handleRequest returns null for non-preflight', () => {
    const cors = new CORSManager({ origin: ['https://a.com'] });
    const request = new Request('https://api.com', {
      headers: { Origin: 'https://a.com' },
    });
    expect(cors.handleRequest(request)).toBeNull();
  });

  it('handleRequest returns null when no Origin header', () => {
    const cors = new CORSManager({ origin: '*' });
    expect(cors.handleRequest(new Request('https://api.com'))).toBeNull();
  });
});

// =============================================================================
// Presets
// =============================================================================

describe('SecurityPresets', () => {
  it('strict preset includes CSP, HSTS, and cross-origin headers', () => {
    const config = SecurityPresets.strict();
    expect(config.contentSecurityPolicy).toBeDefined();
    expect(config.strictTransportSecurity).toBeDefined();
    expect(config.xFrameOptions).toBe('DENY');
    expect(config.crossOriginEmbedderPolicy).toBe('require-corp');
  });

  it('moderate preset is less restrictive', () => {
    const config = SecurityPresets.moderate();
    expect(config.xFrameOptions).toBe('SAMEORIGIN');
    expect(config.crossOriginEmbedderPolicy).toBeUndefined();
  });

  it('development preset is minimal', () => {
    const config = SecurityPresets.development();
    expect(config.contentSecurityPolicy).toBeUndefined();
    expect(config.xContentTypeOptions).toBe(true);
  });
});

describe('CORSPresets', () => {
  it('strict blocks all origins', () => {
    const config = CORSPresets.strict();
    const cors = new CORSManager(config);
    expect(cors.isOriginAllowed('https://any.com')).toBe(false);
  });

  it('moderate allows listed origins', () => {
    const config = CORSPresets.moderate(['https://a.com']);
    const cors = new CORSManager(config);
    expect(cors.isOriginAllowed('https://a.com')).toBe(true);
    expect(cors.isOriginAllowed('https://b.com')).toBe(false);
  });
});

// =============================================================================
// Rate Limit Headers
// =============================================================================

describe('setRateLimitHeaders', () => {
  it('sets all three rate limit headers', () => {
    const response = new Response('ok');
    setRateLimitHeaders(response, 100, 42, 1620000000);
    expect(response.headers.get('X-RateLimit-Limit')).toBe('100');
    expect(response.headers.get('X-RateLimit-Remaining')).toBe('42');
    expect(response.headers.get('X-RateLimit-Reset')).toBe('1620000000');
  });
});

// =============================================================================
// Security Middleware
// =============================================================================

describe('createSecurityMiddleware', () => {
  it('applies security headers to response', async () => {
    const middleware = createSecurityMiddleware({ xFrameOptions: 'DENY' });
    const request = new Request('https://api.com');
    const response = await middleware(request, async () => new Response('ok'));
    expect(response.headers.get('X-Frame-Options')).toBe('DENY');
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });

  it('applies CORS headers when Origin is present', async () => {
    const middleware = createSecurityMiddleware(undefined, {
      origin: ['https://app.com'],
      credentials: true,
    });
    const request = new Request('https://api.com', {
      headers: { Origin: 'https://app.com' },
    });
    const response = await middleware(request, async () => new Response('ok'));
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://app.com');
    expect(response.headers.get('Access-Control-Allow-Credentials')).toBe('true');
  });

  it('handles OPTIONS preflight', async () => {
    const middleware = createSecurityMiddleware(undefined, {
      origin: ['https://app.com'],
      optionsSuccessStatus: 204,
    });
    const request = new Request('https://api.com', {
      method: 'OPTIONS',
      headers: { Origin: 'https://app.com' },
    });
    const response = await middleware(request, async () => new Response('should not reach'));
    expect(response.status).toBe(204);
  });
});

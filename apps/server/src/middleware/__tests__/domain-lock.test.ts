import { Hono } from 'hono';
import { afterEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------
vi.mock('@revealui/core/observability/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// We need to re-import the module for each test group since it reads
// process.env.FORGE_LICENSED_DOMAIN at import time (middleware factory closure).
// Use vi.resetModules() + dynamic import to test different env configurations.
async function importFresh() {
  vi.resetModules();
  // Re-mock logger after module reset
  vi.doMock('@revealui/core/observability/logger', () => ({
    logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
  }));
  return import('../domain-lock.js');
}

// ---------------------------------------------------------------------------
// Tests  -  domainLockMiddleware
// ---------------------------------------------------------------------------
describe('domainLockMiddleware', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('when FORGE_LICENSED_DOMAIN is not set', () => {
    it('passes all requests through (no-op)', async () => {
      delete process.env.FORGE_LICENSED_DOMAIN;

      const { domainLockMiddleware } = await importFresh();
      const app = new Hono();
      // biome-ignore lint/suspicious/noExplicitAny: test helper  -  middleware type
      app.use('*', domainLockMiddleware() as any);
      app.get('/test', (c) => c.json({ ok: true }));

      const res = await app.request('/test', {
        headers: { host: 'evil.com' },
      });

      expect(res.status).toBe(200);
    });
  });

  describe('when FORGE_LICENSED_DOMAIN is set', () => {
    it('allows exact domain match', async () => {
      process.env.FORGE_LICENSED_DOMAIN = 'example.com';

      const { domainLockMiddleware } = await importFresh();
      const app = new Hono();
      // biome-ignore lint/suspicious/noExplicitAny: test helper
      app.use('*', domainLockMiddleware() as any);
      app.get('/test', (c) => c.json({ ok: true }));

      const res = await app.request('/test', {
        headers: { host: 'example.com' },
      });

      expect(res.status).toBe(200);
    });

    it('allows subdomain of licensed domain', async () => {
      process.env.FORGE_LICENSED_DOMAIN = 'example.com';

      const { domainLockMiddleware } = await importFresh();
      const app = new Hono();
      // biome-ignore lint/suspicious/noExplicitAny: test helper
      app.use('*', domainLockMiddleware() as any);
      app.get('/test', (c) => c.json({ ok: true }));

      const res = await app.request('/test', {
        headers: { host: 'app.example.com' },
      });

      expect(res.status).toBe(200);
    });

    it('allows deeply nested subdomains', async () => {
      process.env.FORGE_LICENSED_DOMAIN = 'example.com';

      const { domainLockMiddleware } = await importFresh();
      const app = new Hono();
      // biome-ignore lint/suspicious/noExplicitAny: test helper
      app.use('*', domainLockMiddleware() as any);
      app.get('/test', (c) => c.json({ ok: true }));

      const res = await app.request('/test', {
        headers: { host: 'deep.nested.app.example.com' },
      });

      expect(res.status).toBe(200);
    });

    it('allows localhost', async () => {
      process.env.FORGE_LICENSED_DOMAIN = 'example.com';

      const { domainLockMiddleware } = await importFresh();
      const app = new Hono();
      // biome-ignore lint/suspicious/noExplicitAny: test helper
      app.use('*', domainLockMiddleware() as any);
      app.get('/test', (c) => c.json({ ok: true }));

      const res = await app.request('/test', {
        headers: { host: 'localhost:3000' },
      });

      expect(res.status).toBe(200);
    });

    it('allows 127.0.0.1', async () => {
      process.env.FORGE_LICENSED_DOMAIN = 'example.com';

      const { domainLockMiddleware } = await importFresh();
      const app = new Hono();
      // biome-ignore lint/suspicious/noExplicitAny: test helper
      app.use('*', domainLockMiddleware() as any);
      app.get('/test', (c) => c.json({ ok: true }));

      const res = await app.request('/test', {
        headers: { host: '127.0.0.1:8080' },
      });

      expect(res.status).toBe(200);
    });

    it('rejects unlicensed domain with 403', async () => {
      process.env.FORGE_LICENSED_DOMAIN = 'example.com';

      const { domainLockMiddleware } = await importFresh();
      const app = new Hono();
      // biome-ignore lint/suspicious/noExplicitAny: test helper
      app.use('*', domainLockMiddleware() as any);
      app.get('/test', (c) => c.json({ ok: true }));

      const res = await app.request('/test', {
        headers: { host: 'evil.com' },
      });

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toContain('not licensed');
    });

    it('rejects similar but non-matching domains', async () => {
      process.env.FORGE_LICENSED_DOMAIN = 'example.com';

      const { domainLockMiddleware } = await importFresh();
      const app = new Hono();
      // biome-ignore lint/suspicious/noExplicitAny: test helper
      app.use('*', domainLockMiddleware() as any);
      app.get('/test', (c) => c.json({ ok: true }));

      const res = await app.request('/test', {
        headers: { host: 'notexample.com' },
      });

      expect(res.status).toBe(403);
    });

    it('is case-insensitive for domain matching', async () => {
      process.env.FORGE_LICENSED_DOMAIN = 'Example.COM';

      const { domainLockMiddleware } = await importFresh();
      const app = new Hono();
      // biome-ignore lint/suspicious/noExplicitAny: test helper
      app.use('*', domainLockMiddleware() as any);
      app.get('/test', (c) => c.json({ ok: true }));

      const res = await app.request('/test', {
        headers: { host: 'EXAMPLE.com' },
      });

      expect(res.status).toBe(200);
    });

    it('strips port from host header', async () => {
      process.env.FORGE_LICENSED_DOMAIN = 'example.com';

      const { domainLockMiddleware } = await importFresh();
      const app = new Hono();
      // biome-ignore lint/suspicious/noExplicitAny: test helper
      app.use('*', domainLockMiddleware() as any);
      app.get('/test', (c) => c.json({ ok: true }));

      const res = await app.request('/test', {
        headers: { host: 'example.com:3000' },
      });

      expect(res.status).toBe(200);
    });

    it('trims whitespace from FORGE_LICENSED_DOMAIN', async () => {
      process.env.FORGE_LICENSED_DOMAIN = '  example.com  ';

      const { domainLockMiddleware } = await importFresh();
      const app = new Hono();
      // biome-ignore lint/suspicious/noExplicitAny: test helper
      app.use('*', domainLockMiddleware() as any);
      app.get('/test', (c) => c.json({ ok: true }));

      const res = await app.request('/test', {
        headers: { host: 'example.com' },
      });

      expect(res.status).toBe(200);
    });
  });
});

// ---------------------------------------------------------------------------
// Tests  -  validateForgeConfig
// ---------------------------------------------------------------------------
describe('validateForgeConfig', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('does nothing when neither env var is set', async () => {
    delete process.env.FORGE_LICENSED_DOMAIN;
    delete process.env.FORGE_LICENSE_KEY;

    const { validateForgeConfig } = await importFresh();
    expect(() => validateForgeConfig()).not.toThrow();
  });

  it('throws when FORGE_LICENSE_KEY is set but FORGE_LICENSED_DOMAIN is missing', async () => {
    delete process.env.FORGE_LICENSED_DOMAIN;
    process.env.FORGE_LICENSE_KEY = 'key-123';

    const { validateForgeConfig } = await importFresh();
    expect(() => validateForgeConfig()).toThrow('FORGE_LICENSED_DOMAIN is missing');
  });

  it('throws when FORGE_LICENSED_DOMAIN is set but FORGE_LICENSE_KEY is missing', async () => {
    process.env.FORGE_LICENSED_DOMAIN = 'example.com';
    delete process.env.FORGE_LICENSE_KEY;

    const { validateForgeConfig } = await importFresh();
    expect(() => validateForgeConfig()).toThrow('FORGE_LICENSE_KEY is missing');
  });

  it('does not throw when both env vars are set', async () => {
    process.env.FORGE_LICENSED_DOMAIN = 'example.com';
    process.env.FORGE_LICENSE_KEY = 'key-123';

    const { validateForgeConfig } = await importFresh();
    expect(() => validateForgeConfig()).not.toThrow();
  });

  it('treats whitespace-only values as empty strings (not missing)', async () => {
    process.env.FORGE_LICENSED_DOMAIN = '   ';
    process.env.FORGE_LICENSE_KEY = 'key-123';

    const { validateForgeConfig } = await importFresh();
    // '   '.trim() = ''  -  nullish coalescing (??) treats '' as valid (not null/undefined),
    // so isForgeMode = Boolean('') = false, and the function returns early.
    expect(() => validateForgeConfig()).not.toThrow();
  });
});

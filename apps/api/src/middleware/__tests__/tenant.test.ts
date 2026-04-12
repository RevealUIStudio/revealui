import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------
vi.mock('@revealui/core/observability/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { errorHandler } from '../error.js';
import {
  getTenantFromContext,
  requireTenant,
  type TenantContext,
  tenantMiddleware,
} from '../tenant.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface ErrorBody {
  error: string;
  message: string;
}

interface TenantBody {
  tenant: TenantContext | null;
}

function createApp(options?: { required?: boolean; headerName?: string }) {
  const app = new Hono();
  app.use('*', tenantMiddleware(options));
  app.get('/test', (c) => c.json({ tenant: getTenantFromContext(c) }));
  app.get('/require-tenant', (c) => {
    const tenant = requireTenant(c);
    return c.json({ tenant });
  });
  app.onError(errorHandler);
  return app;
}

// ---------------------------------------------------------------------------
// Tests  -  tenantMiddleware
// ---------------------------------------------------------------------------
describe('tenantMiddleware', () => {
  describe('with required: true (default)', () => {
    let app: ReturnType<typeof createApp>;

    beforeEach(() => {
      app = createApp();
    });

    it('extracts tenant ID from X-Tenant-ID header', async () => {
      const res = await app.request('/test', {
        headers: { 'X-Tenant-ID': 'acme-corp' },
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as TenantBody;
      expect(body.tenant).not.toBeNull();
      expect(body.tenant?.id).toBe('acme-corp');
      expect(body.tenant?.resolvedAt).toBeDefined();
    });

    it('returns 400 when no tenant header is present', async () => {
      const res = await app.request('/test');

      expect(res.status).toBe(400);
      const body = (await res.json()) as ErrorBody;
      expect(body.error).toContain('Missing tenant context');
      expect(body.error).toContain('X-Tenant-ID');
    });

    it('returns 400 for tenant ID with special characters', async () => {
      const res = await app.request('/test', {
        headers: { 'X-Tenant-ID': 'acme/corp;drop' },
      });

      expect(res.status).toBe(400);
      const body = (await res.json()) as ErrorBody;
      expect(body.error).toContain('Invalid tenant ID format');
    });

    it('returns 400 for tenant ID exceeding 128 characters', async () => {
      const longId = 'a'.repeat(129);
      const res = await app.request('/test', {
        headers: { 'X-Tenant-ID': longId },
      });

      expect(res.status).toBe(400);
      const body = (await res.json()) as ErrorBody;
      expect(body.error).toContain('Invalid tenant ID format');
    });

    it('accepts tenant ID at exactly 128 characters', async () => {
      const maxId = 'a'.repeat(128);
      const res = await app.request('/test', {
        headers: { 'X-Tenant-ID': maxId },
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as TenantBody;
      expect(body.tenant?.id).toBe(maxId);
    });

    it('accepts alphanumeric tenant IDs', async () => {
      const res = await app.request('/test', {
        headers: { 'X-Tenant-ID': 'tenant123' },
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as TenantBody;
      expect(body.tenant?.id).toBe('tenant123');
    });

    it('accepts tenant IDs with hyphens', async () => {
      const res = await app.request('/test', {
        headers: { 'X-Tenant-ID': 'my-tenant-org' },
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as TenantBody;
      expect(body.tenant?.id).toBe('my-tenant-org');
    });

    it('accepts tenant IDs with underscores', async () => {
      const res = await app.request('/test', {
        headers: { 'X-Tenant-ID': 'my_tenant_org' },
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as TenantBody;
      expect(body.tenant?.id).toBe('my_tenant_org');
    });

    it('accepts UUID-style tenant IDs', async () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      const res = await app.request('/test', {
        headers: { 'X-Tenant-ID': uuid },
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as TenantBody;
      expect(body.tenant?.id).toBe(uuid);
    });

    it('rejects tenant ID with spaces', async () => {
      const res = await app.request('/test', {
        headers: { 'X-Tenant-ID': 'acme corp' },
      });

      expect(res.status).toBe(400);
    });

    it('rejects empty tenant ID string', async () => {
      const res = await app.request('/test', {
        headers: { 'X-Tenant-ID': '' },
      });

      // Empty string header is treated as missing by Hono
      expect(res.status).toBe(400);
    });

    it('rejects tenant ID with SQL injection characters', async () => {
      const res = await app.request('/test', {
        headers: { 'X-Tenant-ID': "'; DROP TABLE tenants;--" },
      });

      expect(res.status).toBe(400);
    });

    it('rejects tenant ID with path traversal characters', async () => {
      const res = await app.request('/test', {
        headers: { 'X-Tenant-ID': '../etc/passwd' },
      });

      expect(res.status).toBe(400);
    });

    it('sets resolvedAt as a Date-serialized string in the response', async () => {
      const before = new Date();
      const res = await app.request('/test', {
        headers: { 'X-Tenant-ID': 'acme' },
      });
      const after = new Date();

      expect(res.status).toBe(200);
      const body = (await res.json()) as TenantBody;
      const resolvedAt = new Date(body.tenant?.resolvedAt as unknown as string);
      expect(resolvedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(resolvedAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe('with required: false', () => {
    let app: ReturnType<typeof createApp>;

    beforeEach(() => {
      app = createApp({ required: false });
    });

    it('allows missing tenant header and sets tenant to null', async () => {
      const res = await app.request('/test');

      expect(res.status).toBe(200);
      const body = (await res.json()) as TenantBody;
      expect(body.tenant).toBeNull();
    });

    it('still extracts tenant when header is present', async () => {
      const res = await app.request('/test', {
        headers: { 'X-Tenant-ID': 'optional-tenant' },
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as TenantBody;
      expect(body.tenant?.id).toBe('optional-tenant');
    });

    it('still validates tenant ID format when present', async () => {
      const res = await app.request('/test', {
        headers: { 'X-Tenant-ID': 'bad!tenant@id' },
      });

      expect(res.status).toBe(400);
    });
  });

  describe('with custom headerName', () => {
    it('reads tenant from the custom header', async () => {
      const app = createApp({ headerName: 'X-Organization-ID' });
      const res = await app.request('/test', {
        headers: { 'X-Organization-ID': 'custom-org' },
      });

      expect(res.status).toBe(200);
      const body = (await res.json()) as TenantBody;
      expect(body.tenant?.id).toBe('custom-org');
    });

    it('returns 400 referencing custom header name when missing', async () => {
      const app = createApp({ headerName: 'X-Organization-ID' });
      const res = await app.request('/test');

      expect(res.status).toBe(400);
      const body = (await res.json()) as ErrorBody;
      expect(body.error).toContain('X-Organization-ID');
    });

    it('ignores default X-Tenant-ID when custom header is configured', async () => {
      const app = createApp({ headerName: 'X-Organization-ID' });
      const res = await app.request('/test', {
        headers: { 'X-Tenant-ID': 'wrong-header' },
      });

      expect(res.status).toBe(400);
    });
  });

  describe('default options', () => {
    it('works with no options argument', async () => {
      const app = new Hono();
      app.use('*', tenantMiddleware());
      app.get('/test', (c) => c.json({ ok: true }));
      app.onError(errorHandler);

      const res = await app.request('/test', {
        headers: { 'X-Tenant-ID': 'default-test' },
      });
      expect(res.status).toBe(200);
    });
  });
});

// ---------------------------------------------------------------------------
// Tests  -  getTenantFromContext
// ---------------------------------------------------------------------------
describe('getTenantFromContext', () => {
  it('returns null when no tenant is set in context', async () => {
    const app = new Hono();
    // No tenant middleware  -  context has no 'tenant' key
    app.get('/test', (c) => c.json({ tenant: getTenantFromContext(c) }));

    const res = await app.request('/test');
    expect(res.status).toBe(200);
    const body = (await res.json()) as TenantBody;
    expect(body.tenant).toBeNull();
  });

  it('returns TenantContext when tenant has been set', async () => {
    const app = createApp();
    const res = await app.request('/test', {
      headers: { 'X-Tenant-ID': 'ctx-test' },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as TenantBody;
    expect(body.tenant).not.toBeNull();
    expect(body.tenant?.id).toBe('ctx-test');
    expect(body.tenant?.resolvedAt).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Tests  -  requireTenant
// ---------------------------------------------------------------------------
describe('requireTenant', () => {
  it('throws HTTPException 403 when no tenant is set', async () => {
    const app = new Hono();
    // No tenant middleware  -  requireTenant should throw
    app.get('/require-tenant', (c) => {
      const tenant = requireTenant(c);
      return c.json({ tenant });
    });
    app.onError(errorHandler);

    const res = await app.request('/require-tenant');
    expect(res.status).toBe(403);
    const body = (await res.json()) as ErrorBody;
    expect(body.error).toContain('Tenant context required');
  });

  it('returns TenantContext when tenant is set', async () => {
    const app = createApp();
    const res = await app.request('/require-tenant', {
      headers: { 'X-Tenant-ID': 'required-tenant' },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { tenant: TenantContext };
    expect(body.tenant.id).toBe('required-tenant');
    expect(body.tenant.resolvedAt).toBeDefined();
  });

  it('throws 403 even when middleware ran with required: false and no header', async () => {
    const app = new Hono();
    app.use('*', tenantMiddleware({ required: false }));
    app.get('/require-tenant', (c) => {
      const tenant = requireTenant(c);
      return c.json({ tenant });
    });
    app.onError(errorHandler);

    const res = await app.request('/require-tenant');
    expect(res.status).toBe(403);
  });
});

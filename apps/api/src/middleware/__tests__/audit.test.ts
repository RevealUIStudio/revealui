import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@revealui/core/observability/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { auditMiddleware } from '../audit.js';

function createMockAuditSystem() {
  return {
    log: vi.fn().mockResolvedValue(undefined),
  };
}

// biome-ignore lint/suspicious/noExplicitAny: test helper  -  Hono Variables type requires loose typing in tests
type TestVariables = { user: any; requestId: string };

function createApp(audit: ReturnType<typeof createMockAuditSystem>, user?: { id: string }) {
  const app = new Hono<{ Variables: TestVariables }>();
  if (user) {
    app.use('*', async (c, next) => {
      c.set('user', user);
      c.set('requestId', 'req-123');
      await next();
    });
  } else {
    app.use('*', async (c, next) => {
      c.set('requestId', 'req-123');
      await next();
    });
  }
  // biome-ignore lint/suspicious/noExplicitAny: test helper  -  AuditSystem mock shape is partial
  app.use('*', auditMiddleware(audit as any));
  app.get('/api/tickets', (c) => c.json({ items: [] }));
  app.post('/api/tickets', (c) => c.json({ created: true }, 201));
  app.get('/api/error', () => {
    throw new Error('test error');
  });
  return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('auditMiddleware', () => {
  it('logs successful GET requests with severity low', async () => {
    const audit = createMockAuditSystem();
    const app = createApp(audit, { id: 'user-1' });

    await app.request('/api/tickets');

    // Wait for fire-and-forget to complete
    await new Promise((r) => setTimeout(r, 10));

    expect(audit.log).toHaveBeenCalledOnce();
    const call = audit.log.mock.calls[0][0];
    expect(call.type).toBe('data.read');
    expect(call.severity).toBe('low');
    expect(call.actor.id).toBe('user-1');
    expect(call.actor.type).toBe('user');
    expect(call.action).toBe('GET /api/tickets');
    expect(call.result).toBe('success');
    expect(call.metadata.status).toBe(200);
    expect(call.metadata.requestId).toBe('req-123');
    expect(typeof call.metadata.duration).toBe('number');
  });

  it('logs POST requests with data.create type', async () => {
    const audit = createMockAuditSystem();
    const app = createApp(audit, { id: 'user-1' });

    await app.request('/api/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });

    await new Promise((r) => setTimeout(r, 10));

    expect(audit.log).toHaveBeenCalledOnce();
    const call = audit.log.mock.calls[0][0];
    expect(call.type).toBe('data.create');
  });

  it('logs anonymous requests with actor.id as anonymous', async () => {
    const audit = createMockAuditSystem();
    const app = createApp(audit);

    await app.request('/api/tickets');

    await new Promise((r) => setTimeout(r, 10));

    const call = audit.log.mock.calls[0][0];
    expect(call.actor.id).toBe('anonymous');
    expect(call.actor.type).toBe('api');
  });

  it('does not crash the request if audit logging fails', async () => {
    const audit = createMockAuditSystem();
    audit.log.mockRejectedValue(new Error('Audit DB down'));
    const app = createApp(audit, { id: 'user-1' });

    const res = await app.request('/api/tickets');

    expect(res.status).toBe(200);
  });

  it('extracts resource type from URL path', async () => {
    const audit = createMockAuditSystem();
    const app = createApp(audit, { id: 'user-1' });

    await app.request('/api/tickets');

    await new Promise((r) => setTimeout(r, 10));

    const call = audit.log.mock.calls[0][0];
    expect(call.resource.type).toBe('tickets');
  });

  it('captures request duration in metadata', async () => {
    const audit = createMockAuditSystem();
    const app = createApp(audit, { id: 'user-1' });

    await app.request('/api/tickets');

    await new Promise((r) => setTimeout(r, 10));

    const call = audit.log.mock.calls[0][0];
    expect(call.metadata.duration).toBeGreaterThanOrEqual(0);
  });
});

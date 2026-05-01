import { Hono } from 'hono';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { csrfMiddleware, generateCsrfToken, validateCsrfToken } from '../csrf.js';

const SECRET = 'test-secret-key-32chars-long!!';
const SESSION_ID = 'session-abc-123';

// ─── generateCsrfToken ────────────────────────────────────────────────────────

describe('generateCsrfToken', () => {
  it('returns a string in nonce:hmac format', () => {
    const token = generateCsrfToken(SESSION_ID, SECRET);
    const parts = token.split(':');
    expect(parts).toHaveLength(2);
    expect(parts[0]).toMatch(/^[0-9a-f]{32}$/); // 16 random bytes as hex
    expect(parts[1]).toMatch(/^[0-9a-f]{64}$/); // SHA-256 HMAC as hex
  });

  it('generates unique tokens on each call (random nonce)', () => {
    const t1 = generateCsrfToken(SESSION_ID, SECRET);
    const t2 = generateCsrfToken(SESSION_ID, SECRET);
    expect(t1).not.toBe(t2);
  });

  it('produces tokens that can be validated', () => {
    const token = generateCsrfToken(SESSION_ID, SECRET);
    expect(validateCsrfToken(token, SESSION_ID, SECRET)).toBe(true);
  });

  it('tokens are session-bound (wrong session fails validation)', () => {
    const token = generateCsrfToken(SESSION_ID, SECRET);
    expect(validateCsrfToken(token, 'other-session', SECRET)).toBe(false);
  });
});

// ─── validateCsrfToken ────────────────────────────────────────────────────────

describe('validateCsrfToken', () => {
  it('returns true for a valid token', () => {
    const token = generateCsrfToken(SESSION_ID, SECRET);
    expect(validateCsrfToken(token, SESSION_ID, SECRET)).toBe(true);
  });

  it('returns false when token has no colon separator', () => {
    expect(validateCsrfToken('nocolon', SESSION_ID, SECRET)).toBe(false);
  });

  it('returns false when token has more than one colon', () => {
    expect(validateCsrfToken('a:b:c', SESSION_ID, SECRET)).toBe(false);
  });

  it('returns false when nonce is empty', () => {
    expect(validateCsrfToken(':hmacvalue', SESSION_ID, SECRET)).toBe(false);
  });

  it('returns false when hmac portion is empty', () => {
    expect(validateCsrfToken('nonce:', SESSION_ID, SECRET)).toBe(false);
  });

  it('returns false when hmac is tampered with', () => {
    const token = generateCsrfToken(SESSION_ID, SECRET);
    const [nonce] = token.split(':');
    const tampered = `${nonce}:${'0'.repeat(64)}`;
    expect(validateCsrfToken(tampered, SESSION_ID, SECRET)).toBe(false);
  });

  it('returns false when session ID does not match', () => {
    const token = generateCsrfToken(SESSION_ID, SECRET);
    expect(validateCsrfToken(token, 'different-session', SECRET)).toBe(false);
  });

  it('returns false when secret does not match', () => {
    const token = generateCsrfToken(SESSION_ID, SECRET);
    expect(validateCsrfToken(token, SESSION_ID, 'wrong-secret')).toBe(false);
  });

  it('returns false when hmac is not valid hex (Buffer.from throws)', () => {
    // Non-hex string causes Buffer.from with hex encoding to produce unexpected bytes
    // and the length comparison will catch it
    expect(validateCsrfToken('nonce:not-valid-hex!!!', SESSION_ID, SECRET)).toBe(false);
  });
});

// ─── csrfMiddleware ───────────────────────────────────────────────────────────

describe('csrfMiddleware', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  function createApp(options?: Parameters<typeof csrfMiddleware>[0]) {
    const app = new Hono();
    app.use('*', csrfMiddleware(options));
    app.get('/test', (c) => c.json({ ok: true }));
    app.post('/test', (c) => c.json({ ok: true }));
    app.put('/test', (c) => c.json({ ok: true }));
    app.delete('/test', (c) => c.json({ ok: true }));
    app.options('/test', (c) => c.json({ ok: true }));
    return app;
  }

  // ── Safe methods are always skipped ──────────────────────────────────────────

  it('allows GET without any CSRF header', async () => {
    const app = createApp();
    const res = await app.request('/test', { method: 'GET' });
    expect(res.status).toBe(200);
  });

  it('allows HEAD without any CSRF header', async () => {
    const app = createApp();
    const res = await app.request('/test', { method: 'HEAD' });
    expect(res.status).toBe(200);
  });

  it('allows OPTIONS without any CSRF header', async () => {
    const app = createApp();
    const res = await app.request('/test', { method: 'OPTIONS' });
    expect(res.status).toBe(200);
  });

  // ── Skip when no session cookie ───────────────────────────────────────────

  it('allows POST without session cookie (API-key client)', async () => {
    const app = createApp();
    const res = await app.request('/test', { method: 'POST' });
    expect(res.status).toBe(200);
  });

  // ── Exempt paths are skipped ──────────────────────────────────────────────

  it('skips CSRF for /api/webhooks/ path (default exempt)', async () => {
    const app = new Hono();
    app.use('*', csrfMiddleware());
    app.post('/api/webhooks/stripe', (c) => c.json({ ok: true }));

    const res = await app.request('/api/webhooks/stripe', {
      method: 'POST',
      headers: { Cookie: 'revealui-session=sess-123' },
    });
    expect(res.status).toBe(200);
  });

  it('skips CSRF for /.well-known/ path', async () => {
    const app = new Hono();
    app.use('*', csrfMiddleware());
    app.post('/.well-known/agent.json', (c) => c.json({ ok: true }));

    const res = await app.request('/.well-known/agent.json', {
      method: 'POST',
      headers: { Cookie: 'revealui-session=sess-123' },
    });
    expect(res.status).toBe(200);
  });

  it('skips CSRF for custom exempt path', async () => {
    const app = new Hono();
    app.use('*', csrfMiddleware({ exemptPaths: ['/custom/exempt/'] }));
    app.post('/custom/exempt/hook', (c) => c.json({ ok: true }));

    const res = await app.request('/custom/exempt/hook', {
      method: 'POST',
      headers: { Cookie: 'revealui-session=sess-123' },
    });
    expect(res.status).toBe(200);
  });

  // ── Missing secret ────────────────────────────────────────────────────────

  it('returns 500 when REVEALUI_SECRET is not set and session+path require CSRF check', async () => {
    vi.stubEnv('REVEALUI_SECRET', '');

    const app = new Hono();
    app.use('*', async (c, next) => {
      c.set('session', { id: SESSION_ID });
      await next();
    });
    app.use('*', csrfMiddleware());
    app.post('/test', (c) => c.json({ ok: true }));

    const res = await app.request('/test', {
      method: 'POST',
      headers: { Cookie: 'revealui-session=sess-123' },
    });
    expect(res.status).toBe(500);
  });

  // ── No session ID in context ──────────────────────────────────────────────

  it('skips CSRF when session context has no id (unauthenticated with cookie)', async () => {
    vi.stubEnv('REVEALUI_SECRET', SECRET);

    const app = new Hono();
    app.use('*', async (c, next) => {
      c.set('session', {}); // session exists but no id
      await next();
    });
    app.use('*', csrfMiddleware());
    app.post('/test', (c) => c.json({ ok: true }));

    const res = await app.request('/test', {
      method: 'POST',
      headers: { Cookie: 'revealui-session=sess-123' },
    });
    expect(res.status).toBe(200);
  });

  // ── Token validation ──────────────────────────────────────────────────────

  it('returns 403 when CSRF token is missing from header', async () => {
    vi.stubEnv('REVEALUI_SECRET', SECRET);

    const app = new Hono();
    app.use('*', async (c, next) => {
      c.set('session', { id: SESSION_ID });
      await next();
    });
    app.use('*', csrfMiddleware());
    app.post('/test', (c) => c.json({ ok: true }));

    const res = await app.request('/test', {
      method: 'POST',
      headers: { Cookie: 'revealui-session=sess-123' },
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain('missing');
  });

  it('returns 403 when CSRF token is invalid', async () => {
    vi.stubEnv('REVEALUI_SECRET', SECRET);

    const app = new Hono();
    app.use('*', async (c, next) => {
      c.set('session', { id: SESSION_ID });
      await next();
    });
    app.use('*', csrfMiddleware());
    app.post('/test', (c) => c.json({ ok: true }));

    const res = await app.request('/test', {
      method: 'POST',
      headers: {
        Cookie: 'revealui-session=sess-123',
        'X-CSRF-Token': 'invalid-token',
      },
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain('invalid');
  });

  it('allows POST with a valid CSRF token', async () => {
    vi.stubEnv('REVEALUI_SECRET', SECRET);

    const token = generateCsrfToken(SESSION_ID, SECRET);

    const app = new Hono();
    app.use('*', async (c, next) => {
      c.set('session', { id: SESSION_ID });
      await next();
    });
    app.use('*', csrfMiddleware());
    app.post('/test', (c) => c.json({ ok: true }));

    const res = await app.request('/test', {
      method: 'POST',
      headers: {
        Cookie: 'revealui-session=sess-123',
        'X-CSRF-Token': token,
      },
    });
    expect(res.status).toBe(200);
  });

  it('respects custom cookie name option', async () => {
    vi.stubEnv('REVEALUI_SECRET', SECRET);

    const app = new Hono();
    app.use('*', async (c, next) => {
      c.set('session', { id: SESSION_ID });
      await next();
    });
    app.use('*', csrfMiddleware({ cookieName: 'my-session' }));
    app.post('/test', (c) => c.json({ ok: true }));

    // Correct custom cookie name  -  triggers CSRF check, token is missing → 403
    const res = await app.request('/test', {
      method: 'POST',
      headers: { Cookie: 'my-session=sess-123' },
    });
    expect(res.status).toBe(403);
  });

  it('respects custom header name option', async () => {
    vi.stubEnv('REVEALUI_SECRET', SECRET);

    const token = generateCsrfToken(SESSION_ID, SECRET);

    const app = new Hono();
    app.use('*', async (c, next) => {
      c.set('session', { id: SESSION_ID });
      await next();
    });
    app.use('*', csrfMiddleware({ headerName: 'X-My-CSRF' }));
    app.post('/test', (c) => c.json({ ok: true }));

    const res = await app.request('/test', {
      method: 'POST',
      headers: {
        Cookie: 'revealui-session=sess-123',
        'X-My-CSRF': token,
      },
    });
    expect(res.status).toBe(200);
  });

  it('allows DELETE with valid CSRF token', async () => {
    vi.stubEnv('REVEALUI_SECRET', SECRET);

    const token = generateCsrfToken(SESSION_ID, SECRET);

    const app = new Hono();
    app.use('*', async (c, next) => {
      c.set('session', { id: SESSION_ID });
      await next();
    });
    app.use('*', csrfMiddleware());
    app.delete('/test', (c) => c.json({ ok: true }));

    const res = await app.request('/test', {
      method: 'DELETE',
      headers: {
        Cookie: 'revealui-session=sess-123',
        'X-CSRF-Token': token,
      },
    });
    expect(res.status).toBe(200);
  });
});

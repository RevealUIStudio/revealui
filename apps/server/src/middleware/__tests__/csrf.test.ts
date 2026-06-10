import { Hono } from 'hono';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { csrfMiddleware, generateCsrfToken, validateCsrfToken } from '../csrf.js';

const SECRET = 'test-secret-key-32chars-long!!';
// Arbitrary binding string for the token-primitive unit tests below.
const SESSION_ID = 'session-abc-123';
// The middleware binds tokens to the raw session COOKIE VALUE (signed
// double-submit  -  the vocabulary the admin app issues against), NOT the
// DB session row id that auth middleware puts on context.
const SESSION_COOKIE = 'sess-123';
const DB_SESSION_ROW_ID = 'a1b2c3d4-e5f6-7890-uuid-sessionrow00';

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
      c.set('session', { id: DB_SESSION_ROW_ID });
      await next();
    });
    app.use('*', csrfMiddleware());
    app.post('/test', (c) => c.json({ ok: true }));

    const res = await app.request('/test', {
      method: 'POST',
      headers: { Cookie: `revealui-session=${SESSION_COOKIE}` },
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
      c.set('session', { id: DB_SESSION_ROW_ID });
      await next();
    });
    app.use('*', csrfMiddleware());
    app.post('/test', (c) => c.json({ ok: true }));

    const res = await app.request('/test', {
      method: 'POST',
      headers: { Cookie: `revealui-session=${SESSION_COOKIE}` },
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain('missing');
  });

  it('returns 403 when CSRF token is invalid', async () => {
    vi.stubEnv('REVEALUI_SECRET', SECRET);

    const app = new Hono();
    app.use('*', async (c, next) => {
      c.set('session', { id: DB_SESSION_ROW_ID });
      await next();
    });
    app.use('*', csrfMiddleware());
    app.post('/test', (c) => c.json({ ok: true }));

    const res = await app.request('/test', {
      method: 'POST',
      headers: {
        Cookie: `revealui-session=${SESSION_COOKIE}`,
        'X-CSRF-Token': 'invalid-token',
      },
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain('invalid');
  });

  it('allows POST with a token bound to the session cookie value (admin-issued shape)', async () => {
    vi.stubEnv('REVEALUI_SECRET', SECRET);

    // What the admin app actually issues: HMAC over the raw session cookie
    // value (proxy.ts `revealui-csrf` cookie / server-side forwarders).
    const token = generateCsrfToken(SESSION_COOKIE, SECRET);

    const app = new Hono();
    app.use('*', async (c, next) => {
      c.set('session', { id: DB_SESSION_ROW_ID });
      await next();
    });
    app.use('*', csrfMiddleware());
    app.post('/test', (c) => c.json({ ok: true }));

    const res = await app.request('/test', {
      method: 'POST',
      headers: {
        Cookie: `revealui-session=${SESSION_COOKIE}`,
        'X-CSRF-Token': token,
      },
    });
    expect(res.status).toBe(200);
  });

  it('rejects a token bound to the DB session row id (the pre-fix binding no issuer speaks)', async () => {
    vi.stubEnv('REVEALUI_SECRET', SECRET);

    // Regression for the binding unification: tokens minted against
    // session.id used to be the only accepted shape, yet no browser-reachable
    // issuer produced them  -  every cookie-bearing unsafe admin→api call
    // 403'd. They must NOT validate now that the cookie value is the binding.
    const legacyBoundToken = generateCsrfToken(DB_SESSION_ROW_ID, SECRET);

    const app = new Hono();
    app.use('*', async (c, next) => {
      c.set('session', { id: DB_SESSION_ROW_ID });
      await next();
    });
    app.use('*', csrfMiddleware());
    app.post('/test', (c) => c.json({ ok: true }));

    const res = await app.request('/test', {
      method: 'POST',
      headers: {
        Cookie: `revealui-session=${SESSION_COOKIE}`,
        'X-CSRF-Token': legacyBoundToken,
      },
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain('invalid');
  });

  it('respects custom cookie name option', async () => {
    vi.stubEnv('REVEALUI_SECRET', SECRET);

    const app = new Hono();
    app.use('*', async (c, next) => {
      c.set('session', { id: DB_SESSION_ROW_ID });
      await next();
    });
    app.use('*', csrfMiddleware({ cookieName: 'my-session' }));
    app.post('/test', (c) => c.json({ ok: true }));

    // Correct custom cookie name  -  triggers CSRF check, token is missing → 403
    const res = await app.request('/test', {
      method: 'POST',
      headers: { Cookie: `my-session=${SESSION_COOKIE}` },
    });
    expect(res.status).toBe(403);
  });

  it('respects custom header name option', async () => {
    vi.stubEnv('REVEALUI_SECRET', SECRET);

    const token = generateCsrfToken(SESSION_COOKIE, SECRET);

    const app = new Hono();
    app.use('*', async (c, next) => {
      c.set('session', { id: DB_SESSION_ROW_ID });
      await next();
    });
    app.use('*', csrfMiddleware({ headerName: 'X-My-CSRF' }));
    app.post('/test', (c) => c.json({ ok: true }));

    const res = await app.request('/test', {
      method: 'POST',
      headers: {
        Cookie: `revealui-session=${SESSION_COOKIE}`,
        'X-My-CSRF': token,
      },
    });
    expect(res.status).toBe(200);
  });

  it('allows DELETE with valid CSRF token', async () => {
    vi.stubEnv('REVEALUI_SECRET', SECRET);

    const token = generateCsrfToken(SESSION_COOKIE, SECRET);

    const app = new Hono();
    app.use('*', async (c, next) => {
      c.set('session', { id: DB_SESSION_ROW_ID });
      await next();
    });
    app.use('*', csrfMiddleware());
    app.delete('/test', (c) => c.json({ ok: true }));

    const res = await app.request('/test', {
      method: 'DELETE',
      headers: {
        Cookie: `revealui-session=${SESSION_COOKIE}`,
        'X-CSRF-Token': token,
      },
    });
    expect(res.status).toBe(200);
  });

  it('validates the token against the custom cookie name value when overridden', async () => {
    vi.stubEnv('REVEALUI_SECRET', SECRET);

    const customCookieValue = 'custom-sess-value-789';
    const token = generateCsrfToken(customCookieValue, SECRET);

    const app = new Hono();
    app.use('*', async (c, next) => {
      c.set('session', { id: DB_SESSION_ROW_ID });
      await next();
    });
    app.use('*', csrfMiddleware({ cookieName: 'my-session' }));
    app.post('/test', (c) => c.json({ ok: true }));

    const res = await app.request('/test', {
      method: 'POST',
      headers: {
        Cookie: `my-session=${customCookieValue}`,
        'X-CSRF-Token': token,
      },
    });
    expect(res.status).toBe(200);
  });
});

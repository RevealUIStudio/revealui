/**
 * GAP-381 Phase A — harness receipts ingest.
 *
 * Covers design invariants:
 *   I-1  identity from token user only (forged display email does not become userId)
 *   I-2  device-token requirement (cookie/session rejected)
 *   I-7  rate limit headers present after auth
 *
 * Audit append is mocked at the store door so we do not need PGlite for the
 * route shape tests; recordHarnessHookAudit is still exercised via the mock.
 */

import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const appendMock = vi.fn().mockResolvedValue(undefined);

vi.mock('../../lib/audit-signer.js', () => ({
  createAuditStore: () => ({ append: appendMock }),
}));

vi.mock('@revealui/db', () => ({
  getClient: () => ({}),
}));

vi.mock('@revealui/core/security', () => ({
  classifyAuditWriteFailure: () => 'unknown',
  recordAuditWriteResult: vi.fn(),
}));

vi.mock('@revealui/core/observability/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock('@revealui/auth/server', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({
    allowed: true,
    remaining: 100,
    resetAt: Date.now() + 60_000,
  }),
}));

vi.mock('../../middleware/auth.js', () => ({
  authMiddleware: async (_c: unknown, next: () => Promise<void>) => next(),
}));

vi.mock('../../middleware/entitlements.js', () => ({
  entitlementMiddleware: async (_c: unknown, next: () => Promise<void>) => next(),
  getEntitlementsFromContext: (c: { get: (k: string) => unknown }) =>
    c.get('entitlements') ?? { accountId: null },
}));

vi.mock('../../middleware/license.js', () => ({
  requireFeature: () => async (_c: unknown, next: () => Promise<void>) => next(),
}));

import { checkRateLimit } from '@revealui/auth/server';
import {
  createHarnessReceiptsApp,
  handleReceiptsPost,
  harnessReceiptRateLimit,
  requireDeviceToken,
} from '../harness-receipts.js';

const USER = { id: 'user_token_owner', role: 'admin', email: 'owner@example.com' };

function mountWithAuth(opts: { user?: typeof USER | null; deviceAuth?: boolean }): Hono {
  const app = new Hono();
  app.use('/api/harness/*', async (c, next) => {
    if (opts.user) {
      c.set('user', opts.user);
      c.set('session', {
        id: opts.deviceAuth ? 'device-token' : 'cookie-session',
        deviceAuth: opts.deviceAuth === true,
      });
      c.set('entitlements', { accountId: 'acct_1' });
    }
    await next();
  });
  if (opts.user) {
    app.use('/api/harness/*', requireDeviceToken);
    app.use('/api/harness/*', harnessReceiptRateLimit);
  }
  app.route('/api/harness', createHarnessReceiptsApp());
  return app;
}

describe('GAP-381 Phase A: POST /api/harness/receipts', () => {
  beforeEach(() => {
    appendMock.mockClear();
    vi.mocked(checkRateLimit).mockClear();
    vi.mocked(checkRateLimit).mockResolvedValue({
      allowed: true,
      remaining: 100,
      resetAt: Date.now() + 60_000,
    });
  });

  it('I-2: rejects unauthenticated requests with 401', async () => {
    const app = mountWithAuth({ user: null });
    const res = await app.request('/api/harness/receipts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ source: 'cursor', kind: 'pre-tool' }),
    });
    // No user middleware → handler may 401 from requireDeviceToken never running;
    // without auth middleware the route still runs if we only mounted the app.
    // When user is null we did not mount requireDeviceToken — force via handleReceiptsPost?
    // Re-mount with requireDeviceToken always and no user:
    const strict = new Hono();
    strict.use('/api/harness/*', requireDeviceToken);
    strict.route('/api/harness', createHarnessReceiptsApp());
    const r2 = await strict.request('/api/harness/receipts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ source: 'cursor', kind: 'pre-tool' }),
    });
    expect(r2.status).toBe(401);
    expect(res.status).not.toBe(201);
  });

  it('I-2: rejects cookie sessions without deviceAuth', async () => {
    const app = mountWithAuth({ user: USER, deviceAuth: false });
    const res = await app.request('/api/harness/receipts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ source: 'cursor', kind: 'pre-tool', enforcementTier: 'advisory' }),
    });
    expect(res.status).toBe(401);
    const text = await res.text();
    expect(text.toLowerCase()).toMatch(/device token|authentication/);
    expect(appendMock).not.toHaveBeenCalled();
  });

  it('accepts a device-token session and writes harness.hook receipt (I-3 door)', async () => {
    const app = mountWithAuth({ user: USER, deviceAuth: true });
    const res = await app.request('/api/harness/receipts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        source: 'cursor',
        kind: 'pre-tool',
        enforcementTier: 'advisory',
        decision: 'allow',
        toolName: 'Shell',
        identity: { conversationId: 'conv-1', modelId: 'grok-4.5' },
        raw: { user_email: 'forged@attacker.example', command: 'ls' },
      }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { success: boolean; accepted: number; ids: string[] };
    expect(body.success).toBe(true);
    expect(body.accepted).toBe(1);
    expect(body.ids).toHaveLength(1);
    expect(appendMock).toHaveBeenCalledTimes(1);
    const entry = appendMock.mock.calls[0]?.[0] as {
      eventType: string;
      payload: Record<string, unknown>;
    };
    expect(entry.eventType).toBe('harness.hook.pre-tool');
    // I-1: token owner is the userId, not forged email
    expect(entry.payload.userId).toBe(USER.id);
    expect(entry.payload.displayEmail).toBe('forged@attacker.example');
    expect(entry.payload.userId).not.toBe('forged@attacker.example');
  });

  it('I-5: coerces client enforcementTier=enforced to advisory until signatures exist', async () => {
    const result = await handleReceiptsPost(USER, 'acct_1', {
      source: 'vscode',
      kind: 'pre-shell',
      enforcementTier: 'enforced',
      decision: 'deny',
    });
    expect(result.accepted).toBe(1);
    const entry = appendMock.mock.calls[0]?.[0] as { payload: { enforcementTier: string } };
    expect(entry.payload.enforcementTier).toBe('advisory');
  });

  it('I-7: sets rate-limit headers on device-auth path', async () => {
    const app = mountWithAuth({ user: USER, deviceAuth: true });
    const res = await app.request('/api/harness/receipts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ source: 'claude-code', kind: 'stop', enforcementTier: 'advisory' }),
    });
    expect(res.status).toBe(201);
    expect(res.headers.get('X-RateLimit-Limit')).toBeTruthy();
    expect(checkRateLimit).toHaveBeenCalled();
    const key = vi.mocked(checkRateLimit).mock.calls[0]?.[0] as string;
    expect(key).toContain(USER.id);
  });

  it('GET /policy-snapshot returns advisory structure-only document', async () => {
    const app = mountWithAuth({ user: USER, deviceAuth: true });
    const res = await app.request('/api/harness/policy-snapshot');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { enforcementTier: string; rules: unknown[] };
    expect(body.enforcementTier).toBe('advisory');
    expect(Array.isArray(body.rules)).toBe(true);
  });
});

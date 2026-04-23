/**
 * elicitation-respond route tests (Stage 3.4).
 *
 * Covers session ownership, pending-elicitation lookup, and action
 * normalization. Streaming + call-tool integration is exercised separately
 * — this file focuses on the validation surface of the respond endpoint.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  awaitElicitationResponse,
  createCallSession,
  deleteCallSession,
} from '@/lib/mcp/call-sessions';

const mockGetSession = vi.fn();
vi.mock('@revealui/auth/server', () => ({
  getSession: (...args: unknown[]) => mockGetSession(...args),
}));

vi.mock('@/lib/utils/request-context', () => ({
  extractRequestContext: () => ({ userAgent: undefined, ipAddress: undefined }),
}));

function makeRequest(url: string, init?: RequestInit): Request {
  return new Request(url, {
    headers: { cookie: 'session=test' },
    ...init,
  });
}

beforeEach(() => {
  mockGetSession.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/mcp/remote-servers/[server]/elicitation-respond', () => {
  it('returns 401 without a session', async () => {
    mockGetSession.mockResolvedValue(null);
    const { POST } = await import('../elicitation-respond/route.js');
    const res = await POST(
      makeRequest('http://admin.test/api/mcp/remote-servers/linear/elicitation-respond', {
        method: 'POST',
        body: JSON.stringify({}),
      }) as never,
    );
    expect(res.status).toBe(401);
  });

  it('rejects malformed sessionId / elicitationId', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'u1', role: 'admin' } });
    const { POST } = await import('../elicitation-respond/route.js');
    const res = await POST(
      makeRequest('http://admin.test/api/mcp/remote-servers/linear/elicitation-respond', {
        method: 'POST',
        body: JSON.stringify({ sessionId: 'not-a-uuid', elicitationId: 'x', action: 'accept' }),
      }) as never,
    );
    expect(res.status).toBe(400);
  });

  it('rejects unknown action', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'u1', role: 'admin' } });
    const { POST } = await import('../elicitation-respond/route.js');
    const session = createCallSession('u1');
    const res = await POST(
      makeRequest('http://admin.test/api/mcp/remote-servers/linear/elicitation-respond', {
        method: 'POST',
        body: JSON.stringify({
          sessionId: session.sessionId,
          elicitationId: '00000000-0000-0000-0000-000000000000',
          action: 'bogus',
        }),
      }) as never,
    );
    expect(res.status).toBe(400);
    deleteCallSession(session.sessionId);
  });

  it('returns 404 when the session is gone', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'u1', role: 'admin' } });
    const { POST } = await import('../elicitation-respond/route.js');
    const res = await POST(
      makeRequest('http://admin.test/api/mcp/remote-servers/linear/elicitation-respond', {
        method: 'POST',
        body: JSON.stringify({
          sessionId: '11111111-1111-1111-1111-111111111111',
          elicitationId: '22222222-2222-2222-2222-222222222222',
          action: 'cancel',
        }),
      }) as never,
    );
    expect(res.status).toBe(404);
  });

  it('returns 403 when the session owner is a different admin', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'eve', role: 'admin' } });
    const session = createCallSession('alice');
    const { POST } = await import('../elicitation-respond/route.js');
    const res = await POST(
      makeRequest('http://admin.test/api/mcp/remote-servers/linear/elicitation-respond', {
        method: 'POST',
        body: JSON.stringify({
          sessionId: session.sessionId,
          elicitationId: '22222222-2222-2222-2222-222222222222',
          action: 'cancel',
        }),
      }) as never,
    );
    expect(res.status).toBe(403);
    deleteCallSession(session.sessionId);
  });

  it('resolves the pending elicitation with accept + content', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'u1', role: 'admin' } });
    const session = createCallSession('u1');
    const elicitationId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const pending = awaitElicitationResponse(session.sessionId, elicitationId);
    const { POST } = await import('../elicitation-respond/route.js');
    const res = await POST(
      makeRequest('http://admin.test/api/mcp/remote-servers/linear/elicitation-respond', {
        method: 'POST',
        body: JSON.stringify({
          sessionId: session.sessionId,
          elicitationId,
          action: 'accept',
          content: { name: 'alice', count: 3 },
        }),
      }) as never,
    );
    expect(res.status).toBe(200);
    await expect(pending).resolves.toEqual({
      action: 'accept',
      content: { name: 'alice', count: 3 },
    });
    deleteCallSession(session.sessionId);
  });

  it('rejects accept without a plain-object content', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'u1', role: 'admin' } });
    const session = createCallSession('u1');
    const elicitationId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    void awaitElicitationResponse(session.sessionId, elicitationId);
    const { POST } = await import('../elicitation-respond/route.js');
    const res = await POST(
      makeRequest('http://admin.test/api/mcp/remote-servers/linear/elicitation-respond', {
        method: 'POST',
        body: JSON.stringify({
          sessionId: session.sessionId,
          elicitationId,
          action: 'accept',
          content: [1, 2, 3],
        }),
      }) as never,
    );
    expect(res.status).toBe(400);
    deleteCallSession(session.sessionId);
  });

  it('accepts decline/cancel with no content', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'u1', role: 'admin' } });
    const session = createCallSession('u1');
    const elicitationId = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
    const pending = awaitElicitationResponse(session.sessionId, elicitationId);
    const { POST } = await import('../elicitation-respond/route.js');
    const res = await POST(
      makeRequest('http://admin.test/api/mcp/remote-servers/linear/elicitation-respond', {
        method: 'POST',
        body: JSON.stringify({
          sessionId: session.sessionId,
          elicitationId,
          action: 'decline',
        }),
      }) as never,
    );
    expect(res.status).toBe(200);
    await expect(pending).resolves.toEqual({ action: 'decline' });
    deleteCallSession(session.sessionId);
  });
});

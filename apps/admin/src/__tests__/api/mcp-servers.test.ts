/**
 * MCP Servers Route Tests
 *
 * GET /api/mcp/servers — returns static MCP server registry (admin only)
 */

import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const { mockGetSession } = vi.hoisted(() => ({ mockGetSession: vi.fn() }));

vi.mock('@revealui/auth/server', () => ({
  getSession: mockGetSession,
}));

// ---------------------------------------------------------------------------
// Route import (after mocks)
// ---------------------------------------------------------------------------

import { GET } from '../../app/api/mcp/servers/route';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(): NextRequest {
  return new NextRequest('http://localhost/api/mcp/servers');
}

function makeSession(role: 'admin' | 'user' | 'member') {
  return {
    session: { id: 'sess-1', userId: 'user-1' },
    user: { id: 'user-1', role, email: 'test@example.com' },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/mcp/servers', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when not authenticated', async () => {
    mockGetSession.mockResolvedValueOnce(null);
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/unauthorized/i);
  });

  it('returns 403 when authenticated but not admin', async () => {
    mockGetSession.mockResolvedValueOnce(makeSession('user'));
    const res = await GET(makeRequest());
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/forbidden/i);
  });

  it('returns 403 for member role', async () => {
    mockGetSession.mockResolvedValueOnce(makeSession('member'));
    const res = await GET(makeRequest());
    expect(res.status).toBe(403);
  });

  it('returns 200 with servers array for admin', async () => {
    mockGetSession.mockResolvedValueOnce(makeSession('admin'));
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.servers)).toBe(true);
    expect(body.servers.length).toBeGreaterThan(0);
  });

  it('each server entry has id, name, description, status, tools fields', async () => {
    mockGetSession.mockResolvedValueOnce(makeSession('admin'));
    const res = await GET(makeRequest());
    const { servers } = await res.json();
    for (const server of servers) {
      expect(server).toHaveProperty('id');
      expect(server).toHaveProperty('name');
      expect(server).toHaveProperty('description');
      expect(server).toHaveProperty('status');
      expect(Array.isArray(server.tools)).toBe(true);
    }
  });

  it('resolves status to "unavailable" when required env vars are absent', async () => {
    // Ensure env vars for a server that requires them are not set
    const origVercel = process.env.VERCEL_TOKEN;
    delete process.env.VERCEL_TOKEN;
    mockGetSession.mockResolvedValueOnce(makeSession('admin'));
    const res = await GET(makeRequest());
    const { servers } = await res.json();
    const vercelServer = servers.find((s: { id: string }) => s.id === 'vercel');
    expect(vercelServer.status).toBe('unavailable');
    if (origVercel !== undefined) process.env.VERCEL_TOKEN = origVercel;
  });

  it('resolves status to "configured" for servers with no required env vars', async () => {
    mockGetSession.mockResolvedValueOnce(makeSession('admin'));
    const res = await GET(makeRequest());
    const { servers } = await res.json();
    // Playwright requires no env vars
    const playwright = servers.find((s: { id: string }) => s.id === 'playwright');
    expect(playwright.status).toBe('configured');
  });
});

/**
 * (frontend)/next/preview route — draft-mode enable is admin-only.
 *
 * The draft-mode enabler must validate the session server-side (not trust
 * cookie presence) and require an admin role before enabling draft mode,
 * mirroring the (frontend)/[slug] render path. A forged/absent cookie or a
 * non-admin session must get 403 with draft mode never enabled.
 *
 * No regex authored (fleet posture): assertions use equality + call counts.
 */
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetSession = vi.fn();
const mockEnable = vi.fn();
const mockRedirect = vi.fn();

vi.mock('@revealui/auth/server', () => ({
  getSession: (...args: unknown[]) => mockGetSession(...args),
}));

vi.mock('@/lib/utils/request-context', () => ({
  extractRequestContext: () => ({ userAgent: 'test-ua', ipAddress: undefined }),
}));

vi.mock('next/headers', () => ({
  draftMode: () => Promise.resolve({ enable: mockEnable }),
}));

vi.mock('next/navigation', () => ({
  redirect: (...args: unknown[]) => mockRedirect(...args),
}));

import { GET } from '../route';

function req(path: string | null) {
  const url =
    path === null
      ? 'http://localhost/next/preview'
      : `http://localhost/next/preview?path=${encodeURIComponent(path)}`;
  return new NextRequest(url);
}

describe('(frontend)/next/preview — draft-mode enable is admin-only', () => {
  beforeEach(() => vi.clearAllMocks());

  it('404s when no path is provided', async () => {
    mockGetSession.mockResolvedValue({
      user: { id: 'a', email: 'a@example.com', role: 'admin' },
      session: {},
    });
    const res = await GET(req(null));
    expect(res.status).toBe(404);
    expect(mockEnable).not.toHaveBeenCalled();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it('403 and never enables draft when the session is invalid/absent (forged cookie)', async () => {
    mockGetSession.mockResolvedValue(null);
    const res = await GET(req('/about'));
    expect(res.status).toBe(403);
    expect(mockEnable).not.toHaveBeenCalled();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it('403 and never enables draft for a non-admin (public-signup user) session', async () => {
    mockGetSession.mockResolvedValue({
      user: { id: 'u', email: 'u@example.com', role: 'user' },
      session: {},
    });
    const res = await GET(req('/about'));
    expect(res.status).toBe(403);
    expect(mockEnable).not.toHaveBeenCalled();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it('enables draft and redirects for an admin session', async () => {
    mockGetSession.mockResolvedValue({
      user: { id: 'a', email: 'a@example.com', role: 'admin' },
      session: {},
    });
    await GET(req('/about'));
    expect(mockEnable).toHaveBeenCalledOnce();
    expect(mockRedirect).toHaveBeenCalledWith('/about');
  });
});

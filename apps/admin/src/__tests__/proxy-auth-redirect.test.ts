/**
 * Admin proxy — authenticated-user redirect off /login + /signup (#1107).
 *
 * An admin holding a valid `revealui-session` has no reason to see the
 * login/signup screens. Verifies `src/proxy.ts` redirects such a user to '/',
 * scoped to /login + /signup only, and leaves the other public auth-flow pages
 * (forgot/reset/rotate-password, mfa, setup) reachable. The `revealui-role`
 * cookie is normalized to 'admin' | 'user' at sign-in, so the redirect predicate
 * matches the auth gate's admit check — no redirect loop.
 *
 * No regex authored (fleet posture): assertions use URL parsing + equality.
 */
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import proxy from '../proxy';

// The setup-redirect probe (fires on '/' and '/login' for UNAUTHENTICATED
// requests) calls fetch(`${origin}/api/setup`). Stub it to report setup-not-needed
// so the unauthenticated cases fall through to the normal page passthrough.
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function req(path: string, cookie?: string): NextRequest {
  return new NextRequest(`https://admin.example.com${path}`, {
    headers: cookie ? { cookie } : {},
  });
}

/** Location header's pathname, or null when there is no redirect. */
function redirectPath(res: Response): string | null {
  const location = res.headers.get('location');
  return location ? new URL(location).pathname : null;
}

const ADMIN_COOKIES = 'revealui-session=sess-abc; revealui-role=admin';
const USER_COOKIES = 'revealui-session=sess-abc; revealui-role=user';

describe('admin proxy — authenticated redirect off /login + /signup (#1107)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ needed: false }),
    });
  });

  it('redirects an authenticated admin off /login to /', async () => {
    const res = await proxy(req('/login', ADMIN_COOKIES));
    expect(res.status).toBe(307);
    expect(redirectPath(res)).toBe('/');
  });

  it('redirects an authenticated admin off /signup to /', async () => {
    const res = await proxy(req('/signup', ADMIN_COOKIES));
    expect(res.status).toBe(307);
    expect(redirectPath(res)).toBe('/');
  });

  it('does not redirect an unauthenticated visitor off /login', async () => {
    const res = await proxy(req('/login'));
    expect(redirectPath(res)).not.toBe('/');
  });

  it('does not redirect an authenticated non-admin (role=user) off /login', async () => {
    const res = await proxy(req('/login', USER_COOKIES));
    expect(redirectPath(res)).not.toBe('/');
  });

  it('does not redirect an authenticated admin off /forgot-password', async () => {
    const res = await proxy(req('/forgot-password', ADMIN_COOKIES));
    expect(redirectPath(res)).not.toBe('/');
  });

  it('does not redirect an authenticated admin off /rotate-password', async () => {
    const res = await proxy(req('/rotate-password', ADMIN_COOKIES));
    expect(redirectPath(res)).not.toBe('/');
  });

  it('sends an authenticated non-admin off an admin route to /welcome, not /login', async () => {
    // The bug: a signed-in user-role account hitting an admin route was bounced
    // to /login (the form they just used) — a silent flash-and-reappear loop.
    // Fix: redirect to /welcome with a ?denied=admin notice instead.
    const res = await proxy(req('/settings', USER_COOKIES));
    expect(res.status).toBe(307);
    const location = res.headers.get('location');
    const url = location ? new URL(location) : null;
    expect(url?.pathname).toBe('/welcome');
    expect(url?.pathname).not.toBe('/login');
    expect(url?.searchParams.get('denied')).toBe('admin');
  });

  it('does not bounce an authenticated non-admin off /welcome (no loop)', async () => {
    // /welcome is session-only, so the target of the deny redirect is itself
    // reachable — guarantees the deny path terminates instead of looping.
    const res = await proxy(req('/welcome', USER_COOKIES));
    expect(redirectPath(res)).not.toBe('/login');
    expect(redirectPath(res)).not.toBe('/welcome');
  });
});

describe('admin proxy — /dashboard auth gate (GAP-292)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ needed: false }),
    });
  });

  it('redirects an unauthenticated /dashboard request to /login (auth gate)', async () => {
    // /dashboard is not in PUBLIC_PATHS — auth gate protects it and redirects
    // unauthenticated requests to /login with the original path preserved.
    const res = await proxy(req('/dashboard'));
    expect(res.status).toBe(307);
    const location = res.headers.get('location');
    const url = location ? new URL(location) : null;
    expect(url?.pathname).toBe('/login');
    expect(url?.searchParams.get('redirect')).toBe('/dashboard');
  });

  it('does not redirect an authenticated admin off /dashboard (served by static route)', async () => {
    // /dashboard is served by (backend)/dashboard/page.tsx (static route, higher
    // priority than (frontend)/[slug]). The proxy should pass it through — no redirect.
    const res = await proxy(req('/dashboard', ADMIN_COOKIES));
    expect(redirectPath(res)).toBeNull();
  });
});

describe('admin proxy — /forgot-password is not public (S1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ needed: false }),
    });
  });

  it('redirects an UNAUTHENTICATED /forgot-password request to /login (no longer whitelisted public)', async () => {
    // /forgot-password was in PUBLIC_PATHS but has no route — it fell through to
    // the (frontend)/[slug] CMS catch-all unauthenticated. It is now protected;
    // an anonymous request is bounced to /login (with the original path preserved).
    const res = await proxy(req('/forgot-password'));
    expect(res.status).toBe(307);
    const location = res.headers.get('location');
    const url = location ? new URL(location) : null;
    expect(url?.pathname).toBe('/login');
    expect(url?.searchParams.get('redirect')).toBe('/forgot-password');
  });

  it('still treats /reset-password as public (recovery flow entry point)', async () => {
    const res = await proxy(req('/reset-password'));
    // Public path → no auth redirect to /login.
    expect(redirectPath(res)).not.toBe('/login');
  });
});

/**
 * Admin proxy — role-aware auth gate and redirect tests.
 *
 * The `revealui-role` cookie carries the actual DB role (owner, admin, editor,
 * viewer, agent, contributor). The proxy uses this for two purposes:
 * 1. Redirect authenticated users off /login + /signup (admins → /, others → /welcome)
 * 2. Gate admin-only paths (/settings, /users) — non-admin roles → /welcome?denied=admin
 * 3. All other authenticated paths are open to any role
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
const OWNER_COOKIES = 'revealui-session=sess-abc; revealui-role=owner';
const VIEWER_COOKIES = 'revealui-session=sess-abc; revealui-role=viewer';
const EDITOR_COOKIES = 'revealui-session=sess-abc; revealui-role=editor';

describe('admin proxy — authenticated redirect off /login + /signup', () => {
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

  it('redirects an authenticated owner off /login to /', async () => {
    const res = await proxy(req('/login', OWNER_COOKIES));
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

  it('redirects an authenticated viewer off /login to /welcome', async () => {
    const res = await proxy(req('/login', VIEWER_COOKIES));
    expect(res.status).toBe(307);
    expect(redirectPath(res)).toBe('/welcome');
  });

  it('redirects an authenticated editor off /login to /welcome', async () => {
    const res = await proxy(req('/login', EDITOR_COOKIES));
    expect(res.status).toBe(307);
    expect(redirectPath(res)).toBe('/welcome');
  });

  it('does not redirect an authenticated admin off /forgot-password', async () => {
    const res = await proxy(req('/forgot-password', ADMIN_COOKIES));
    expect(redirectPath(res)).not.toBe('/');
  });

  it('does not redirect an authenticated admin off /rotate-password', async () => {
    const res = await proxy(req('/rotate-password', ADMIN_COOKIES));
    expect(redirectPath(res)).not.toBe('/');
  });

  it('honors a safe ?redirect= on /login instead of dumping an admin on /', async () => {
    const res = await proxy(req('/login?redirect=/account/license', ADMIN_COOKIES));
    expect(res.status).toBe(307);
    expect(redirectPath(res)).toBe('/account/license');
  });

  it('honors a safe ?returnUrl= on /login (LicenseProvider query name)', async () => {
    const res = await proxy(req('/login?returnUrl=%2Faccount%2Flicense', OWNER_COOKIES));
    expect(res.status).toBe(307);
    expect(redirectPath(res)).toBe('/account/license');
  });

  it('prefers ?redirect= over ?returnUrl= when both are present', async () => {
    const res = await proxy(
      req('/login?redirect=/account/license&returnUrl=/welcome', ADMIN_COOKIES),
    );
    expect(redirectPath(res)).toBe('/account/license');
  });

  it('still dumps an authenticated admin on / when no safe dest is present', async () => {
    const res = await proxy(req('/login', ADMIN_COOKIES));
    expect(redirectPath(res)).toBe('/');
  });

  it('rejects an off-origin redirect and falls back to admin home', async () => {
    const res = await proxy(req('/login?redirect=https://evil.example/steal', ADMIN_COOKIES));
    expect(redirectPath(res)).toBe('/');
  });

  it('rejects a protocol-relative returnUrl and falls back to admin home', async () => {
    const res = await proxy(req('/login?returnUrl=//evil.example/steal', ADMIN_COOKIES));
    expect(redirectPath(res)).toBe('/');
  });

  it('does not honor /login as a dest (no bounce loop)', async () => {
    const res = await proxy(req('/login?redirect=/login', ADMIN_COOKIES));
    expect(redirectPath(res)).toBe('/');
  });

  it('honors a safe ?redirect= on /signup for an authenticated admin', async () => {
    const res = await proxy(req('/signup?redirect=/account/license', ADMIN_COOKIES));
    expect(redirectPath(res)).toBe('/account/license');
  });

  it('lets an authenticated admin stay on /account/license (no dump to /)', async () => {
    const res = await proxy(req('/account/license', OWNER_COOKIES));
    expect(redirectPath(res)).toBeNull();
  });

  it('301s the /settings/account/license bookmark to /account/license', async () => {
    const res = await proxy(req('/settings/account/license', OWNER_COOKIES));
    expect(res.status).toBe(301);
    expect(redirectPath(res)).toBe('/account/license');
  });
});

describe('admin proxy — role-aware admin-only gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ needed: false }),
    });
  });

  it('sends a viewer off /settings to /welcome?denied=admin', async () => {
    const res = await proxy(req('/settings', VIEWER_COOKIES));
    expect(res.status).toBe(307);
    const location = res.headers.get('location');
    const url = location ? new URL(location) : null;
    expect(url?.pathname).toBe('/welcome');
    expect(url?.searchParams.get('denied')).toBe('admin');
  });

  it('sends a viewer off /users to /welcome?denied=admin', async () => {
    const res = await proxy(req('/users', VIEWER_COOKIES));
    expect(res.status).toBe(307);
    const location = res.headers.get('location');
    const url = location ? new URL(location) : null;
    expect(url?.pathname).toBe('/welcome');
    expect(url?.searchParams.get('denied')).toBe('admin');
  });

  it('lets an admin through to /settings', async () => {
    const res = await proxy(req('/settings', ADMIN_COOKIES));
    expect(redirectPath(res)).toBeNull();
  });

  it('lets an owner through to /settings', async () => {
    const res = await proxy(req('/settings', OWNER_COOKIES));
    expect(redirectPath(res)).toBeNull();
  });

  it('lets a viewer through to non-admin paths like /dashboard', async () => {
    const res = await proxy(req('/dashboard', VIEWER_COOKIES));
    expect(redirectPath(res)).toBeNull();
  });

  it('lets an editor through to non-admin paths like /content', async () => {
    const res = await proxy(req('/content', EDITOR_COOKIES));
    expect(redirectPath(res)).toBeNull();
  });

  it('does not bounce an authenticated non-admin off /welcome (no loop)', async () => {
    const res = await proxy(req('/welcome', VIEWER_COOKIES));
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
    const res = await proxy(req('/dashboard'));
    expect(res.status).toBe(307);
    const location = res.headers.get('location');
    const url = location ? new URL(location) : null;
    expect(url?.pathname).toBe('/login');
    expect(url?.searchParams.get('redirect')).toBe('/dashboard');
  });

  it('does not redirect an authenticated admin off /dashboard', async () => {
    const res = await proxy(req('/dashboard', ADMIN_COOKIES));
    expect(redirectPath(res)).toBeNull();
  });

  it('does not redirect an authenticated viewer off /dashboard (role-aware gate)', async () => {
    const res = await proxy(req('/dashboard', VIEWER_COOKIES));
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

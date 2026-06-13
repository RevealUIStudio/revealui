/**
 * Admin proxy CSP tests (GAP-219 hardening).
 *
 * Verifies the per-request nonce Content-Security-Policy set by `src/proxy.ts`:
 *   - script-src carries a 'nonce-…' and NO 'unsafe-inline'
 *   - the external-script host allowlist is preserved (no 'strict-dynamic')
 *   - the same unified policy is the single CSP source for page and /api responses
 *   - a fresh nonce is generated per request
 *   - style-src intentionally retains 'unsafe-inline'
 *
 * No regex is authored here (per the fleet no-regex posture) — the CSP string is
 * inspected with `split('; ')` + `startsWith` + `includes`.
 */
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import proxy from '../proxy';

// The setup-redirect probe (only fires on '/' and '/login') calls
// fetch(`${origin}/api/setup`). Stub it so the page path falls through to the
// normal CSP passthrough instead of attempting a network call.
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

/** Return the `script-src …` directive from a CSP header value, or ''. */
function directive(csp: string | null, name: string): string {
  if (!csp) return '';
  return csp.split('; ').find((d) => d.startsWith(`${name} `)) ?? '';
}

describe('admin proxy — CSP nonce (GAP-219)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ needed: false }),
    });
  });

  it('sets a per-request nonce on a page route and drops unsafe-inline from script-src', async () => {
    const res = await proxy(new NextRequest('https://admin.example.com/login'));
    const csp = res.headers.get('content-security-policy');
    expect(csp).toBeTruthy();
    const scriptSrc = directive(csp, 'script-src');
    expect(scriptSrc).toContain("'nonce-");
    expect(scriptSrc).not.toContain("'unsafe-inline'");
  });

  it('preserves the external-script host allowlist and does not use strict-dynamic', async () => {
    const res = await proxy(new NextRequest('https://admin.example.com/login'));
    const scriptSrc = directive(res.headers.get('content-security-policy'), 'script-src');
    expect(scriptSrc).toContain('https://js.stripe.com');
    expect(scriptSrc).not.toContain("'strict-dynamic'");
  });

  it('keeps unsafe-inline on style-src (intentional — Tailwind/Next/tenant inline styles)', async () => {
    const res = await proxy(new NextRequest('https://admin.example.com/login'));
    const styleSrc = directive(res.headers.get('content-security-policy'), 'style-src');
    expect(styleSrc).toContain("'unsafe-inline'");
  });

  it('applies the same unified nonce CSP to /api responses (single script-src directive)', async () => {
    const res = await proxy(new NextRequest('https://admin.example.com/api/health'));
    const csp = res.headers.get('content-security-policy') ?? '';
    expect(directive(csp, 'script-src')).toContain("'nonce-");
    expect(directive(csp, 'script-src')).not.toContain("'unsafe-inline'");
    // Exactly one script-src directive — no duplicated/conflicting policy.
    expect(csp.split('; ').filter((d) => d.startsWith('script-src ')).length).toBe(1);
  });

  it('generates a fresh nonce per request', async () => {
    const a = directive(
      (await proxy(new NextRequest('https://admin.example.com/login'))).headers.get(
        'content-security-policy',
      ),
      'script-src',
    );
    const b = directive(
      (await proxy(new NextRequest('https://admin.example.com/login'))).headers.get(
        'content-security-policy',
      ),
      'script-src',
    );
    expect(a).not.toBe(b);
  });
});

describe('admin proxy — /welcome auth gate (post-checkout subscriber)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ needed: false }) });
  });

  it('lets an authenticated non-admin (paying customer) reach /welcome without bouncing to /login', async () => {
    const res = await proxy(
      new NextRequest('https://admin.example.com/welcome?success=true&tier=pro', {
        headers: { cookie: 'revealui-session=tok; revealui-role=user' },
      }),
    );
    // Post-checkout landing is session-gated, not admin-gated: no redirect.
    expect(res.headers.get('location')).toBeNull();
  });

  it('still requires a session for /welcome (no session redirects to /login)', async () => {
    const res = await proxy(new NextRequest('https://admin.example.com/welcome'));
    expect(res.headers.get('location')).toContain('/login');
  });

  it('still enforces the admin role on other backend pages (non-admin session redirects to /login)', async () => {
    const res = await proxy(
      new NextRequest('https://admin.example.com/posts', {
        headers: { cookie: 'revealui-session=tok; revealui-role=user' },
      }),
    );
    expect(res.headers.get('location')).toContain('/login');
  });

  it('lets an authenticated non-admin (subscriber) reach /account/billing without bouncing to /login', async () => {
    const res = await proxy(
      new NextRequest('https://admin.example.com/account/billing?upgrade=pro', {
        headers: { cookie: 'revealui-session=tok; revealui-role=user' },
      }),
    );
    expect(res.headers.get('location')).toBeNull();
  });

  it('still requires a session for /account/billing (no session redirects to /login)', async () => {
    const res = await proxy(new NextRequest('https://admin.example.com/account/billing'));
    expect(res.headers.get('location')).toContain('/login');
  });
});

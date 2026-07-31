/**
 * Client-side re-auth redirect for dead or rejected sessions (GAP-454).
 * Keeps the return path so the operator lands back after sign-in.
 */

/**
 * Public pre-auth surfaces (mirror apps/admin/src/proxy.ts PUBLIC_PATHS).
 * LicenseProvider and other 401 handlers must NOT bounce off these — e.g.
 * MFA challenge has no full session yet, so /api/billing/subscription 401
 * is expected and must not send the user back to /login (GAP-360 walk).
 */
export function isPreAuthPublicPath(pathname: string): boolean {
  return (
    pathname === '/login' ||
    pathname.startsWith('/login/') ||
    pathname === '/signup' ||
    pathname.startsWith('/signup/') ||
    pathname === '/mfa' ||
    pathname.startsWith('/mfa/') ||
    pathname === '/rotate-password' ||
    pathname.startsWith('/rotate-password/') ||
    pathname === '/reset-password' ||
    pathname.startsWith('/reset-password/') ||
    pathname === '/setup' ||
    pathname.startsWith('/setup/')
  );
}

export function redirectToLogin(returnPath?: string): void {
  if (typeof window === 'undefined') return;
  const path =
    returnPath ?? `${window.location.pathname}${window.location.search}${window.location.hash}`;
  // Avoid a redirect loop if we are already on the login surface.
  if (path === '/login' || path.startsWith('/login?')) return;
  // Mid MFA / signup / password recovery: no full session yet; 401s from
  // license probes must not abort the challenge.
  if (isPreAuthPublicPath(window.location.pathname)) return;
  const returnUrl = encodeURIComponent(path || '/');
  window.location.assign(`/login?returnUrl=${returnUrl}`);
}

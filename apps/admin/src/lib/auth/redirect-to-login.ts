/**
 * Client-side re-auth redirect for dead or rejected sessions (GAP-454).
 * Keeps the return path so the operator lands back after sign-in.
 */
export function redirectToLogin(returnPath?: string): void {
  if (typeof window === 'undefined') return;
  const path =
    returnPath ?? `${window.location.pathname}${window.location.search}${window.location.hash}`;
  // Avoid a redirect loop if we are already on the login surface.
  if (path === '/login' || path.startsWith('/login?')) return;
  const returnUrl = encodeURIComponent(path || '/');
  window.location.assign(`/login?returnUrl=${returnUrl}`);
}

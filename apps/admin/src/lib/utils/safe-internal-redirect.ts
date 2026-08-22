/** Same-origin path used when no browser origin is available (Edge / Node). */
const FALLBACK_ORIGIN = 'https://revealui.invalid';

function resolveOrigin(origin?: string): string {
  if (origin) return origin;
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return FALLBACK_ORIGIN;
}

/** Validate a same-origin redirect path. Returns the safe path or null. */
export function safeInternalRedirect(raw: string | null, origin?: string): string | null {
  if (!raw) return null;
  if (!raw.startsWith('/') || raw.startsWith('//')) return null; // reject protocol-relative //evil.com
  if (raw.includes('\\')) return null; // browsers treat \ as / → /\evil.com
  try {
    const base = resolveOrigin(origin);
    const u = new URL(raw, base);
    if (u.origin !== new URL(base).origin) return null; // catch-all same-origin guard
    return u.pathname + u.search + u.hash;
  } catch {
    return null;
  }
}

function pathnameOf(dest: string): string {
  const withoutHash = dest.split('#')[0] ?? dest;
  return withoutHash.split('?')[0] ?? withoutHash;
}

function isAuthEntryPath(pathname: string): boolean {
  return (
    pathname === '/login' ||
    pathname === '/signup' ||
    pathname.startsWith('/login/') ||
    pathname.startsWith('/signup/')
  );
}

/**
 * Same-origin dest that is safe to send a signed-in user to after /login or
 * /signup. Drops auth-entry loops so we never bounce /login → /login.
 */
export function safePostAuthRedirect(raw: string | null, origin?: string): string | null {
  const dest = safeInternalRedirect(raw, origin);
  if (!dest) return null;
  if (isAuthEntryPath(pathnameOf(dest))) return null;
  return dest;
}

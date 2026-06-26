'use client';

/** Validate a same-origin redirect path. Returns the safe path or null. */
export function safeInternalRedirect(raw: string | null): string | null {
  if (!raw) return null;
  if (!raw.startsWith('/') || raw.startsWith('//')) return null; // reject protocol-relative //evil.com
  if (raw.includes('\\')) return null; // browsers treat \ as / → /\evil.com
  try {
    const u = new URL(raw, window.location.origin);
    if (u.origin !== window.location.origin) return null; // catch-all same-origin guard
    return u.pathname + u.search + u.hash;
  } catch {
    return null;
  }
}

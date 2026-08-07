/**
 * CSRF helpers for browser clients (admin, auth hooks, agent stream, sync).
 *
 * Single source of truth for reading the JS-readable `revealui-csrf` cookie
 * (fleet-redundancy P2-C; C12 residual 2026-08-07). Consumers: this package's
 * admin APIClient, `@revealui/auth/react` (re-export), `@revealui/ai`
 * useAgentStream, `@revealui/sync` csrfHeaders, and apps/admin `apiFetch`.
 *
 * The admin proxy and the api server's csrfMiddleware require any unsafe
 * request carrying a `revealui-session` cookie to echo this cookie as an
 * `X-CSRF-Token` header. Re-read immediately before each request because
 * the proxy re-issues the cookie when it no longer validates against the
 * current session (e.g. after re-login or session rotation).
 */

/**
 * Read the `revealui-csrf` cookie value. Returns `undefined` outside the
 * browser, when the cookie is absent, or when its value is empty.
 */
export function readCsrfToken(): string | undefined {
  if (typeof document === 'undefined') return undefined;
  for (const part of document.cookie.split(';')) {
    const eqIdx = part.indexOf('=');
    if (eqIdx === -1) continue;
    if (part.slice(0, eqIdx).trim() === 'revealui-csrf') {
      const raw = part.slice(eqIdx + 1).trim();
      if (!raw) return undefined;
      try {
        return decodeURIComponent(raw);
      } catch {
        return raw;
      }
    }
  }
  return undefined;
}

/**
 * POST `/api/auth/sign-out`, echoing the CSRF cookie as `X-CSRF-Token` when
 * one is readable. Sign-out always runs with a session cookie, so without the
 * header the admin proxy rejects the request with 403 "CSRF token missing"
 * and the server-side session is never revoked. When no cookie is readable
 * the request stays byte-identical to the historical bare fetch (no `headers`
 * key at all).
 */
export async function postSignOut(): Promise<Response> {
  const csrfToken = readCsrfToken();
  return fetch('/api/auth/sign-out', {
    method: 'POST',
    credentials: 'include',
    ...(csrfToken ? { headers: { 'X-CSRF-Token': csrfToken } } : {}),
  });
}

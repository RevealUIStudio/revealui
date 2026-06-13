/**
 * Signed double-submit CSRF support for the admin sync mutation routes.
 *
 * The admin proxy rejects any unsafe-method `/api/*` request that carries a
 * `revealui-session` cookie without an `X-CSRF-Token` header echoing the
 * JS-readable `revealui-csrf` cookie. Mirrors the attach pattern used by the
 * admin `apiFetch` helper and the core admin `APIClient`.
 */

const CSRF_COOKIE_NAME = 'revealui-csrf';
const CSRF_HEADER_NAME = 'X-CSRF-Token';

/**
 * Read the `revealui-csrf` cookie value.
 * Returns null outside a browser context or when the cookie is absent or empty.
 */
export function getCsrfToken(): string | null {
  if (typeof document === 'undefined') return null;
  for (const part of document.cookie.split(';')) {
    const eqIdx = part.indexOf('=');
    if (eqIdx === -1) continue;
    if (part.slice(0, eqIdx).trim() === CSRF_COOKIE_NAME) {
      const raw = part.slice(eqIdx + 1).trim();
      if (!raw) return null;
      try {
        return decodeURIComponent(raw);
      } catch {
        return raw;
      }
    }
  }
  return null;
}

/**
 * CSRF header for an unsafe-method request to `url`, or an empty object when
 * none applies. The token is only attached to same-origin targets: the cookie
 * is scoped to the admin origin, and an absolute `proxyBaseUrl` pointing at a
 * foreign origin must never receive it. Relative URLs resolve against the page
 * origin, so they always qualify.
 */
export function csrfHeaders(url: string): Record<string, string> {
  if (typeof window === 'undefined') return {};
  let target: URL;
  try {
    target = new URL(url, window.location.origin);
  } catch {
    return {};
  }
  if (target.origin !== window.location.origin) {
    return {};
  }
  const token = getCsrfToken();
  return token === null ? {} : { [CSRF_HEADER_NAME]: token };
}

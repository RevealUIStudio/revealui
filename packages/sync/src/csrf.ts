/**
 * Signed double-submit CSRF support for the admin sync mutation routes.
 *
 * Cookie reader is the fleet SSOT in `@revealui/core/admin/utils/csrf`
 * (fleet-redundancy P2-C / 2026-08-07 C12 residual). This module only adds
 * same-origin header attach for sync hooks.
 *
 * The admin proxy rejects any unsafe-method `/api/*` request that carries a
 * `revealui-session` cookie without an `X-CSRF-Token` header echoing the
 * JS-readable `revealui-csrf` cookie.
 */

import { readCsrfToken } from '@revealui/core/admin/utils/csrf';

const CSRF_HEADER_NAME = 'X-CSRF-Token';

/**
 * Read the `revealui-csrf` cookie value.
 * Returns null outside a browser context or when the cookie is absent or empty.
 * Thin null-coalesce over the core SSOT (`readCsrfToken` returns `undefined`).
 */
export function getCsrfToken(): string | null {
  return readCsrfToken() ?? null;
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

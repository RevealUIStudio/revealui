/**
 * Admin browser CSRF helpers.
 *
 * Cookie reader is the fleet SSOT in `@revealui/core/admin/utils/csrf`
 * (fleet-redundancy P2-C / 2026-08-07 C12 residual). This module keeps the
 * admin-only attach predicate (`isCsrfTarget`) and `apiFetch` wrapper.
 */

import { readCsrfToken } from '@revealui/core/admin/utils/csrf';

/**
 * Read the `revealui-csrf` cookie value.
 * Returns null outside a browser context or when the cookie is absent or empty.
 * Thin null-coalesce over the core SSOT (`readCsrfToken` returns `undefined`).
 */
export function getCsrfToken(): string | null {
  return readCsrfToken() ?? null;
}

const CSRF_UNSAFE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Origin of the api server the admin browser talks to (cross-subdomain in prod). */
function configuredApiOrigin(): string | null {
  const raw = (process.env.NEXT_PUBLIC_API_URL || 'https://api.revealui.com').trim();
  return URL.canParse(raw) ? new URL(raw).origin : null;
}

/**
 * True when `urlStr` targets a RevealUI surface that enforces the signed
 * double-submit CSRF check: the admin's own `/api/*` routes (relative or
 * same-origin absolute) or the api server's `/api/*` routes (absolute,
 * cross-origin). Both validate the same token  -  HMAC over the session
 * cookie value  -  so one attach predicate covers both.
 *
 * Foreign origins never get the token: it would be useless to them, and
 * request headers are not something to hand out.
 */
export function isCsrfTarget(urlStr: string): boolean {
  if (urlStr.startsWith('/api/')) return true;
  if (!URL.canParse(urlStr)) return false;
  const target = new URL(urlStr);
  if (!target.pathname.startsWith('/api/')) return false;
  if (target.origin === configuredApiOrigin()) return true;
  return typeof window !== 'undefined' && target.origin === window.location.origin;
}

export function apiFetch(url: string | URL, init: RequestInit = {}): Promise<Response> {
  const method = (init.method ?? 'GET').toUpperCase();
  const urlStr = typeof url === 'string' ? url : url.toString();
  const needsCsrf = CSRF_UNSAFE.has(method) && isCsrfTarget(urlStr);
  if (!needsCsrf) return fetch(url, init);
  const token = getCsrfToken();
  if (!token) return fetch(url, init);
  return fetch(url, {
    ...init,
    headers: {
      ...init.headers,
      'X-CSRF-Token': token,
    },
  });
}

/**
 * Same-origin CSRF gate for progressive form POSTs (2.3.4 dogfood).
 *
 * Full admin double-submit (`revealui-csrf` + HMAC) stays on the admin/api
 * stack for Phase 3. Here we only reject cross-site POSTs that carry an
 * Origin/Referer that does not match the request URL origin.
 *
 * Skipped for:
 * - safe methods (GET/HEAD/OPTIONS)
 * - JS server actions (`x-rsc-action`) — SameSite cookie + RSC Accept path
 */

const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);

export function csrfOriginResponse(request: Request): Response | null {
  if (SAFE.has(request.method.toUpperCase())) return null;
  if (request.headers.get('x-rsc-action')) return null;

  const url = new URL(request.url);
  const expected = url.origin;

  const origin = request.headers.get('origin');
  if (origin) {
    if (origin === expected) return null;
    return forbidden('Origin mismatch');
  }

  const referer = request.headers.get('referer');
  if (referer) {
    try {
      if (new URL(referer).origin === expected) return null;
    } catch {
      return forbidden('Invalid Referer');
    }
    return forbidden('Referer mismatch');
  }

  // No Origin/Referer: browsers omit Origin on same-site form navigations in
  // some cases. Allow for dogfood progressive forms; production admin should
  // use double-submit cookies (Phase 3 port).
  return null;
}

function forbidden(reason: string): Response {
  return new Response(`Forbidden (CSRF): ${reason}`, {
    status: 403,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

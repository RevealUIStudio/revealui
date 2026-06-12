/**
 * CSRF Double-Submit Token Helper
 *
 * Shared by the react auth hooks (`usePasskey`, `useMFA`, `useSignOut`) whose
 * POSTs target the RevealUI admin proxy's CSRF-gated endpoints.
 */

/**
 * Read the JS-readable `revealui-csrf` cookie. The RevealUI admin proxy
 * (`apps/admin/src/proxy.ts`) requires it as an `X-CSRF-Token` header on any
 * session-cookie-bearing unsafe request, and may re-issue the cookie on any
 * response — so call this immediately before each fetch rather than once per
 * flow. Returns undefined outside the browser or when the cookie is
 * absent/empty. Mirrors the cookie-read in `@revealui/core`'s admin APIClient
 * (`request()`) and `@revealui/ai`'s `useAgentStream`.
 */
export function readCsrfToken(): string | undefined {
  if (typeof document === 'undefined') return undefined;
  for (const part of document.cookie.split(';')) {
    const eqIdx = part.indexOf('=');
    if (eqIdx === -1) continue;
    if (part.slice(0, eqIdx).trim() === 'revealui-csrf') {
      return part.slice(eqIdx + 1).trim() || undefined;
    }
  }
  return undefined;
}

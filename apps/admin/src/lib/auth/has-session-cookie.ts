/**
 * Cookie-presence probe for client auth gates.
 *
 * `useSession()` is a one-shot fetch of `/api/auth/session`. A transient miss
 * (slow API, cross-origin 401) must not be treated as signed-out when the
 * browser still holds `revealui-session` — that bounce is what dumped a
 * signed-in owner from /account/license onto the dashboard.
 */

export const SESSION_COOKIE_NAME = 'revealui-session';

export function hasSessionCookie(cookieSource?: string): boolean {
  const raw = cookieSource ?? (typeof document === 'undefined' ? '' : document.cookie);
  const parts = raw.split(';');
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed.startsWith(`${SESSION_COOKIE_NAME}=`)) continue;
    return trimmed.slice(SESSION_COOKIE_NAME.length + 1).length > 0;
  }
  return false;
}

/**
 * Client pages should only send the user to /login when the session hook is
 * finished, empty, AND no session cookie is present.
 */
export function shouldRedirectToLoginOnEmptySession(
  session: unknown,
  sessionLoading: boolean,
  cookieSource?: string,
): boolean {
  if (sessionLoading || session) return false;
  return !hasSessionCookie(cookieSource);
}

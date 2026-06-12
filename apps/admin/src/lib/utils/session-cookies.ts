/**
 * Session Cookie Helpers
 *
 * Shared attribute derivation for the auth cookies set at sign-in and
 * cleared at sign-out.
 *
 * Cookie identity is (name, domain, path): a deletion cookie only matches
 * what sign-in set when it carries the SAME domain and path attributes.
 * Sign-in sets `revealui-session` / `revealui-role` with
 * `domain: SESSION_COOKIE_DOMAIN` in production (cross-subdomain auth), so a
 * host-only delete is a browser-level no-op and the user stays signed in.
 */

import type { NextResponse } from 'next/server';

export const SESSION_COOKIE = 'revealui-session';
export const ROLE_COOKIE = 'revealui-role';
export const MUST_ROTATE_COOKIE = 'revealui-must-rotate';

/**
 * Domain attribute for the session/role cookies, mirroring the sign-in
 * derivation: `SESSION_COOKIE_DOMAIN` in production, host-only otherwise.
 *
 * Unlike sign-in, this never throws when the variable is missing  -  sign-out
 * must still clear whatever cookie the host actually has.
 */
export function sessionCookieDomain(): string | undefined {
  return process.env.NODE_ENV === 'production'
    ? process.env.SESSION_COOKIE_DOMAIN || undefined
    : undefined;
}

/**
 * Expire the auth cookies with the same attributes they were set with:
 * `revealui-session` / `revealui-role` domain-scoped in production,
 * `revealui-must-rotate` host-only (it is set host-only at sign-in).
 */
export function clearSessionCookies(response: NextResponse): void {
  const expire = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 0,
    expires: new Date(0),
  };
  const domain = sessionCookieDomain();

  response.cookies.set(SESSION_COOKIE, '', { ...expire, domain });
  response.cookies.set(ROLE_COOKIE, '', { ...expire, domain });
  response.cookies.set(MUST_ROTATE_COOKIE, '', expire);
}

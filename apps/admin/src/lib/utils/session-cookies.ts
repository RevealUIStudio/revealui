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

import { isHostedDeployment } from '@revealui/core/deployment-mode';
import { logger } from '@revealui/utils/logger';
import type { NextResponse } from 'next/server';

export const SESSION_COOKIE = 'revealui-session';
export const ROLE_COOKIE = 'revealui-role';
export const MUST_ROTATE_COOKIE = 'revealui-must-rotate';

export interface SessionCookieDomainOptions {
  /**
   * Log an error when the variable is missing in production. The session
   * cookie SET sites opt in (a host-only session cookie silently breaks
   * cross-subdomain auth); the role-hint sites and sign-out stay silent.
   */
  logIfMissing?: boolean;
}

/**
 * Domain attribute for the session/role cookies, mirroring the sign-in
 * derivation: `SESSION_COOKIE_DOMAIN` in production, host-only otherwise.
 * An empty string counts as unset so the cookie falls back to host-only
 * rather than carrying `domain=""`.
 *
 * Unlike the sign-in session cookie, this never throws when the variable is
 * missing  -  sign-out must still clear whatever cookie the host actually
 * has, and the role-hint cookie is a defense-in-depth signal rather than the
 * security boundary. The sign-in session cookie uses
 * `requireSessionCookieDomain` instead.
 */
export function sessionCookieDomain(options?: SessionCookieDomainOptions): string | undefined {
  if (process.env.NODE_ENV !== 'production') {
    return undefined;
  }
  if (options?.logIfMissing && !process.env.SESSION_COOKIE_DOMAIN) {
    logger.error(
      'SESSION_COOKIE_DOMAIN env var is required in production  -  session cookie will not be set cross-subdomain',
    );
  }
  return process.env.SESSION_COOKIE_DOMAIN || undefined;
}

/**
 * Strict domain derivation for the sign-in session cookie: in production a
 * missing `SESSION_COOKIE_DOMAIN` throws, but ONLY on a RevealUI Studio
 * hosted-SaaS deployment (`isHostedDeployment()` — admin.revealui.com +
 * api.revealui.com sharing one auth cookie across subdomains). Every other
 * posture — a RevForge Fleet-branded kit or a plain OSS/unlicensed self-host
 * (GAP-430/GAP-440, no `REVEALUI_LICENSE_PRIVATE_KEY`) — runs single-host and
 * falls back to a host-only cookie, matching `sessionCookieDomain()`.
 *
 * This MUST use the same `isHostedDeployment()` signal as
 * `env-validation.ts`'s `isSaasHosted` check (which already exempts every
 * self-host posture from requiring `SESSION_COOKIE_DOMAIN` at boot). Before
 * GAP-446 this function used a narrower, unrelated `REVEALUI_FLEET_MODE`-only
 * exemption that never recognized a plain self-host — so a stranger's fresh
 * Railway deploy (no license key, no Fleet flag) passed boot-time validation
 * but threw on every successful sign-in at request time, turning a correct
 * login into a 500.
 */
export function requireSessionCookieDomain(): string | undefined {
  if (process.env.NODE_ENV !== 'production') {
    return undefined;
  }
  if (isHostedDeployment(process.env) && !process.env.SESSION_COOKIE_DOMAIN) {
    throw new Error(
      'SESSION_COOKIE_DOMAIN env var is required in production for cross-subdomain auth on a RevealUI Studio hosted deployment',
    );
  }
  return process.env.SESSION_COOKIE_DOMAIN || undefined;
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

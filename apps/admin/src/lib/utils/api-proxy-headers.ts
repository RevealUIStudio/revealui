import type { NextRequest } from 'next/server';
import { generateCsrfToken } from './csrf-token';

/**
 * Headers for a server-side forward of a browser request to the api server.
 *
 * - Forwards the Cookie header so the api authenticates the same session.
 * - Forwards the browser's User-Agent: the api's session binding deletes a
 *   session outright when a cookie arrives under a different UA (stolen-cookie
 *   defense), and an absent UA merely skips that check  -  forwarding keeps
 *   the defense meaningful for proxied traffic instead of silently disarming
 *   it.
 * - Mints an X-CSRF-Token bound to the session cookie value: the api's
 *   csrfMiddleware enforces the signed double-submit check on every
 *   cookie-bearing unsafe request, and this forwarder holds both inputs
 *   (cookie value + REVEALUI_SECRET) that the browser-side issuer uses.
 */
export async function apiForwardHeaders(
  request: NextRequest,
  extra?: Record<string, string>,
): Promise<Record<string, string>> {
  const headers: Record<string, string> = { ...extra };

  const cookie = request.headers.get('Cookie');
  if (cookie) headers.Cookie = cookie;

  const userAgent = request.headers.get('User-Agent');
  if (userAgent) headers['User-Agent'] = userAgent;

  const sessionValue = request.cookies.get('revealui-session')?.value;
  const secret = process.env.REVEALUI_SECRET;
  if (sessionValue && secret) {
    headers['X-CSRF-Token'] = await generateCsrfToken(sessionValue, secret);
  }

  return headers;
}

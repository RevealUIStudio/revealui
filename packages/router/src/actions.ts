/**
 * Server-action transport helpers (ADR D2 / T7 / 2.2.4 progressive forms).
 */

import type { MiddlewareContext, RouteMiddleware } from './types';

/** Header carrying the opaque server-action id (RSDW convention). */
export const RSC_ACTION_HEADER = 'x-rsc-action';

/** Header on RSC-nav redirect responses (ADR D6). */
export const RSC_REDIRECT_HEADER = 'X-Router-Redirect';

export function getServerActionId(request: Request): string | null {
  if (request.method !== 'POST') return null;
  const id = request.headers.get(RSC_ACTION_HEADER);
  return id && id.length > 0 ? id : null;
}

export function isServerActionRequest(request: Request): boolean {
  return getServerActionId(request) !== null;
}

/**
 * Progressive-enhancement form POST (ADR D2 form path): POST without
 * `x-rsc-action`, typically `multipart/form-data` or urlencoded body.
 */
export function isFormActionRequest(request: Request): boolean {
  if (request.method !== 'POST') return false;
  if (getServerActionId(request)) return false;
  const contentType = request.headers.get('content-type') ?? '';
  return (
    contentType.includes('multipart/form-data') ||
    contentType.includes('application/x-www-form-urlencoded')
  );
}

/**
 * Read redirect path from an RSC navigation / action response (ADR D6).
 */
export function getRouterRedirect(response: Response): string | null {
  const path = response.headers.get(RSC_REDIRECT_HEADER);
  return path && path.length > 0 ? path : null;
}

/**
 * Run action middleware chain before loadServerAction (D2.d).
 * - `false` → abort (403)
 * - `string` → redirect path
 * - `true` → continue
 */
export async function runActionMiddleware(
  middleware: RouteMiddleware[],
  context: MiddlewareContext,
): Promise<true | false | string> {
  for (const mw of middleware) {
    const result = await mw(context);
    if (result === false) return false;
    if (typeof result === 'string') return result;
  }
  return true;
}

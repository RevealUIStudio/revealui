/**
 * Server-action transport helpers (ADR D2 / T7).
 */

import type { MiddlewareContext, RouteMiddleware } from './types';

/** Header carrying the opaque server-action id (RSDW convention). */
export const RSC_ACTION_HEADER = 'x-rsc-action';

export function getServerActionId(request: Request): string | null {
  if (request.method !== 'POST') return null;
  const id = request.headers.get(RSC_ACTION_HEADER);
  return id && id.length > 0 ? id : null;
}

export function isServerActionRequest(request: Request): boolean {
  return getServerActionId(request) !== null;
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

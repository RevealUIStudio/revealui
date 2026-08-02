/**
 * Server-only session helpers (ALS). Do not import from browser entry graph.
 */
import { getRequestOrNull } from '@revealui/router/server';
import { getSessionFromRequest, type PocSession } from './session.ts';

/**
 * Session from the current renderRequest ALS, or an explicit Request.
 */
export async function getSession(request?: Request): Promise<PocSession | null> {
  const req = request ?? getRequestOrNull();
  if (!req) return null;
  return getSessionFromRequest(req);
}

'use server';

import { getSession } from '../auth/session-server.ts';

/** Public: who am I (reads ALS request cookie). */
export async function whoami(): Promise<string> {
  const session = await getSession();
  if (!session) return 'anonymous';
  return `signed-in as ${session.sub} (iat ${new Date(session.iat).toISOString()})`;
}

/**
 * Protected mutation — action id contains `secretPing` so useAction middleware
 * returns 403 without a valid dogfood session cookie.
 */
export async function secretPing(): Promise<string> {
  const session = await getSession();
  if (!session) {
    // Defense in depth if middleware is misconfigured.
    throw new Error('unauthorized');
  }
  return `secret ok for ${session.sub} at ${new Date().toISOString()}`;
}

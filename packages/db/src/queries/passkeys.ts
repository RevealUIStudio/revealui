/**
 * Passkey database queries
 */

import { eq } from 'drizzle-orm';
import type { Database } from '../client/index.js';
import { passkeys } from '../schema/passkeys.js';

/** Look up a passkey by its WebAuthn credential ID */
export async function getPasskeyByCredentialId(db: Database, credentialId: string) {
  const result = await db
    .select()
    .from(passkeys)
    .where(eq(passkeys.credentialId, credentialId))
    .limit(1);
  return result[0] ?? null;
}

/** Update the signature counter after a successful authentication */
export async function updatePasskeyCounter(db: Database, id: string, counter: number) {
  await db.update(passkeys).set({ counter, lastUsedAt: new Date() }).where(eq(passkeys.id, id));
}

/**
 * User API key database queries
 */

import { and, eq } from 'drizzle-orm';
import type { Database } from '../client/index.js';
import { userApiKeys } from '../schema/api-keys.js';

/** Get a user's API key metadata (provider + hint, no encrypted key) */
export async function getApiKeyMetadata(db: Database, userId: string) {
  const result = await db
    .select({ provider: userApiKeys.provider, keyHint: userApiKeys.keyHint })
    .from(userApiKeys)
    .where(eq(userApiKeys.userId, userId))
    .limit(1);
  return result[0] ?? null;
}

/** Get a user's encrypted API key for decryption */
export async function getEncryptedApiKey(db: Database, userId: string) {
  const result = await db
    .select({
      id: userApiKeys.id,
      provider: userApiKeys.provider,
      encryptedKey: userApiKeys.encryptedKey,
    })
    .from(userApiKeys)
    .where(eq(userApiKeys.userId, userId))
    .limit(1);
  return result[0] ?? null;
}

/** Upsert an API key (delete existing for provider, then insert new) */
export async function upsertApiKey(
  db: Database,
  values: {
    id: string;
    userId: string;
    provider: string;
    encryptedKey: string;
    keyHint: string | null;
  },
) {
  // Delete existing key for this user+provider
  await db
    .delete(userApiKeys)
    .where(and(eq(userApiKeys.userId, values.userId), eq(userApiKeys.provider, values.provider)));

  const now = new Date();
  await db.insert(userApiKeys).values({
    ...values,
    createdAt: now,
    updatedAt: now,
  });
}

/** Delete all API keys for a user */
export async function deleteApiKeys(db: Database, userId: string) {
  await db.delete(userApiKeys).where(eq(userApiKeys.userId, userId));
}

/** Update lastUsedAt timestamp (fire-and-forget) */
export async function touchApiKeyUsage(db: Database, keyId: string) {
  await db.update(userApiKeys).set({ lastUsedAt: new Date() }).where(eq(userApiKeys.id, keyId));
}

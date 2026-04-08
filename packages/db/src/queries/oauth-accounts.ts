/**
 * OAuth account database queries
 */

import { and, eq, isNull } from 'drizzle-orm';
import type { Database } from '../client/index.js';
import { oauthAccounts } from '../schema/oauth-accounts.js';

/** Look up an OAuth account by provider + provider user ID (active only) */
export async function getOAuthAccountByProviderUser(
  db: Database,
  provider: string,
  providerUserId: string,
) {
  const result = await db
    .select({ userId: oauthAccounts.userId })
    .from(oauthAccounts)
    .where(
      and(
        eq(oauthAccounts.provider, provider),
        eq(oauthAccounts.providerUserId, providerUserId),
        isNull(oauthAccounts.deletedAt),
      ),
    )
    .limit(1);
  return result[0] ?? null;
}

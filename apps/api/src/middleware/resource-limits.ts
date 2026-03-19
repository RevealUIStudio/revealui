/**
 * Resource Limit Middleware for Hono API
 *
 * Enforces tier-based limits on sites and users.
 * Uses getMaxSites() / getMaxUsers() from @revealui/core/license
 * to determine limits based on the current license tier.
 *
 * R5-C3: Site limits are account-aware — if a user belongs to an account,
 * sites are counted at the account level (all members' sites), not per-user.
 */

import { getMaxSites, getMaxUsers } from '@revealui/core/license';
import { accountMemberships } from '@revealui/db/schema';
import { count, eq, inArray } from 'drizzle-orm';
import type { MiddlewareHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';

/**
 * Get all user IDs that belong to the same account as the given user.
 * If the user has no account membership, returns just their own ID.
 */
// biome-ignore lint/suspicious/noExplicitAny: db is a Drizzle client (NeonHttp or NodePg) — union type is unwieldy for internal helper
async function getAccountMemberIds(db: any, userId: string): Promise<string[]> {
  // Find the user's account
  const membership = await db
    .select({ accountId: accountMemberships.accountId })
    .from(accountMemberships)
    .where(eq(accountMemberships.userId, userId))
    .limit(1);

  if (membership.length === 0) {
    // No account — self-hosted or solo user, count per-user
    return [userId];
  }

  // Get all members of that account
  const members = await db
    .select({ userId: accountMemberships.userId })
    .from(accountMemberships)
    .where(eq(accountMemberships.accountId, membership[0].accountId));

  return members.map((m: { userId: string }) => m.userId);
}

/**
 * Enforce site creation limit based on the current license.
 * Must be placed AFTER dbMiddleware and authMiddleware({ required: true }).
 *
 * R5-C3: If user belongs to an account, counts sites across ALL account members.
 *
 * @param getSitesTable - Returns the sites table reference (avoids top-level import of DB schema)
 */
export const enforceSiteLimit = (
  getSitesTable: () => { ownerId: { name: string } },
): MiddlewareHandler => {
  return async (c, next) => {
    const db = c.get('db');
    const user = c.get('user');

    if (!(db && user)) {
      throw new HTTPException(401, { message: 'Authentication required' });
    }

    const sitesTable = getSitesTable();
    const max = getMaxSites();

    if (max === Number.POSITIVE_INFINITY) {
      await next();
      return;
    }

    // R5-C3: Account-aware site counting
    const memberIds = await getAccountMemberIds(db, user.id);

    // biome-ignore lint/suspicious/noExplicitAny: DB typing is dynamic across middleware boundary
    const result = await (db as any)
      .select({ count: count() })
      .from(sitesTable)
      // biome-ignore lint/suspicious/noExplicitAny: DB typing is dynamic across middleware boundary
      .where(inArray((sitesTable as any).ownerId, memberIds));

    const currentCount = result[0]?.count ?? 0;

    if (currentCount >= max) {
      throw new HTTPException(403, {
        message: `Site limit reached (${currentCount}/${max}). Upgrade your license for more sites.`,
      });
    }

    await next();
  };
};

/**
 * Enforce user creation limit based on the current license.
 * Must be placed AFTER dbMiddleware.
 *
 * @param getUsersTable - Returns the users table reference
 */
export const enforceUserLimit = (
  getUsersTable: () => { status: { name: string } },
): MiddlewareHandler => {
  return async (c, next) => {
    const db = c.get('db');

    if (!db) {
      throw new HTTPException(500, { message: 'Database not available' });
    }

    const usersTable = getUsersTable();
    const max = getMaxUsers();

    if (max === Number.POSITIVE_INFINITY) {
      await next();
      return;
    }

    // biome-ignore lint/suspicious/noExplicitAny: DB typing is dynamic across middleware boundary
    const result = await (db as any)
      .select({ count: count() })
      .from(usersTable)
      // biome-ignore lint/suspicious/noExplicitAny: DB typing is dynamic across middleware boundary
      .where(eq((usersTable as any).status, 'active'));

    const currentCount = result[0]?.count ?? 0;

    if (currentCount >= max) {
      throw new HTTPException(403, {
        message: `User limit reached (${currentCount}/${max}). Upgrade your license for more users.`,
      });
    }

    await next();
  };
};

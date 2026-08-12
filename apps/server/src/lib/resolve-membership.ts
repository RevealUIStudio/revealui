/**
 * Active account membership resolution (GAP-477 Phase C).
 *
 * Replaces nondeterministic `.limit(1)` without ORDER BY on multi-account users.
 *
 * Priority:
 * 1. Preferred account id/slug (X-Tenant-ID / tenant middleware) when the user
 *    has an active membership on that account
 * 2. Exactly one active membership → that row
 * 3. Multiple memberships without preference → oldest by created_at (stable)
 *
 * Fail-closed: no active membership → null.
 */

import type { Database } from '@revealui/db/client';
import { accountMemberships, accounts } from '@revealui/db/schema';
import { and, asc, eq, or } from 'drizzle-orm';

export interface ActiveMembership {
  accountId: string;
  role: string;
}

/**
 * Resolve which billing/workspace account a user is acting as for entitlements.
 *
 * @param preferredAccountId - Optional account id or slug (e.g. X-Tenant-ID).
 *   Only wins when the user has an active membership on that account.
 */
export async function resolveActiveMembership(
  db: Database,
  userId: string,
  preferredAccountId?: string | null,
): Promise<ActiveMembership | null> {
  const preferred = preferredAccountId?.trim() || null;

  if (preferred) {
    const [preferredRow] = await db
      .select({
        accountId: accountMemberships.accountId,
        role: accountMemberships.role,
      })
      .from(accountMemberships)
      .innerJoin(accounts, eq(accounts.id, accountMemberships.accountId))
      .where(
        and(
          eq(accountMemberships.userId, userId),
          eq(accountMemberships.status, 'active'),
          or(eq(accounts.id, preferred), eq(accounts.slug, preferred)),
        ),
      )
      .limit(1);

    if (preferredRow) {
      return preferredRow;
    }
  }

  const rows = await db
    .select({
      accountId: accountMemberships.accountId,
      role: accountMemberships.role,
    })
    .from(accountMemberships)
    .where(and(eq(accountMemberships.userId, userId), eq(accountMemberships.status, 'active')))
    .orderBy(asc(accountMemberships.createdAt))
    .limit(1);

  return rows[0] ?? null;
}

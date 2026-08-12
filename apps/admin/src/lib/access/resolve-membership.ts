/**
 * Active account membership resolution for admin (GAP-477 Phase C).
 *
 * Mirror of apps/server/src/lib/resolve-membership.ts — keep lockstep when
 * preference rules change. Admin cannot import apps/server.
 */

import type { Database } from '@revealui/db/client';
import { accountMemberships, accounts } from '@revealui/db/schema';
import { and, asc, eq, or } from 'drizzle-orm';

export interface ActiveMembership {
  accountId: string;
  role: string;
}

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

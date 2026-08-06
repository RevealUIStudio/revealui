/**
 * Backfill: membership owner + users.role=viewer → platform admin.
 *
 * Durable residual for accounts provisioned before ensureAccountOwnerPlatformAdmin.
 * Dry-run by default. Never grants super-admin.
 *
 * Usage:
 *   revvault run --env DATABASE_URL=revealui/prod/db/postgres-url -- \
 *     pnpm exec tsx scripts/admin/backfill-account-owner-platform-admin.ts
 *   ... -- --apply
 */

import { ensureAccountOwnerPlatformAdmin } from '@revealui/auth/server';
import { getClient } from '@revealui/db/client';
import { accountMemberships, users } from '@revealui/db/schema';
import { and, eq, isNull, or } from 'drizzle-orm';

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  const db = getClient();

  const rows = await db
    .select({
      userId: users.id,
      email: users.email,
      role: users.role,
      membershipRole: accountMemberships.role,
    })
    .from(users)
    .innerJoin(
      accountMemberships,
      and(
        eq(accountMemberships.userId, users.id),
        eq(accountMemberships.role, 'owner'),
        eq(accountMemberships.status, 'active'),
      ),
    )
    .where(
      and(
        isNull(users.deletedAt),
        or(eq(users.role, 'viewer'), eq(users.role, 'editor'), eq(users.role, 'contributor')),
      ),
    );

  // Dedupe users (multiple accounts unlikely but safe)
  const byUser = new Map<string, (typeof rows)[0]>();
  for (const row of rows) {
    byUser.set(row.userId, row);
  }

  console.log(`[backfill] candidates: ${byUser.size} (dry-run=${!apply})`);
  for (const row of byUser.values()) {
    console.log(`  ${row.email ?? row.userId}  users.role=${row.role} → admin`);
  }

  if (!apply) {
    console.log('[backfill] re-run with --apply to update');
    return;
  }

  let updated = 0;
  for (const userId of byUser.keys()) {
    const result = await ensureAccountOwnerPlatformAdmin(db, userId);
    if (result?.updated) updated += 1;
  }
  console.log(`[backfill] updated: ${updated}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

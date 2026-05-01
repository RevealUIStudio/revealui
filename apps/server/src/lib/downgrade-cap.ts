/**
 * Proactive Resource Capping on Tier Downgrade (GAP-105 M-03)
 *
 * When a user downgrades (e.g., Pro → Free), this module detects resources
 * that exceed the new tier's limits and soft-disables the excess:
 *
 *   - Sites over limit → archived (data preserved, read-only)
 *   - Users over limit → memberships revoked (non-owners, newest first)
 *
 * Agent task metering is handled separately via meteringStatus in entitlements.
 * Capping is non-destructive: archived sites can be restored on upgrade,
 * and revoked memberships can be re-invited.
 */

import { type LicenseTierId, TIER_LIMITS } from '@revealui/contracts/pricing';
import { logger } from '@revealui/core/observability/logger';
import type { Database } from '@revealui/db/client';
import { accountMemberships, sites } from '@revealui/db/schema';
import { and, asc, count, desc, eq, inArray, isNull, ne } from 'drizzle-orm';

// =============================================================================
// Tier Comparison
// =============================================================================

const TIER_RANK: Record<LicenseTierId, number> = {
  free: 0,
  pro: 1,
  max: 2,
  enterprise: 3,
};

/** Returns true if newTier has strictly lower rank than oldTier. */
export function isDowngrade(oldTier: LicenseTierId, newTier: LicenseTierId): boolean {
  return TIER_RANK[newTier] < TIER_RANK[oldTier];
}

// =============================================================================
// Capping Result
// =============================================================================

export interface CapResult {
  /** Whether any resources were capped. */
  capped: boolean;
  /** Number of sites archived due to exceeding new tier limit. */
  sitesArchived: number;
  /** Number of memberships revoked due to exceeding new tier limit. */
  membershipsRevoked: number;
  /** IDs of archived sites (for audit trail). */
  archivedSiteIds: string[];
  /** IDs of revoked memberships (for audit trail). */
  revokedMembershipIds: string[];
}

// =============================================================================
// Core Capping Logic
// =============================================================================

/**
 * Cap resources for an account after a tier downgrade.
 *
 * Idempotent: safe to call multiple times (already-archived sites won't be
 * re-archived, already-revoked memberships won't be touched).
 *
 * @param db - Database client (transactional or not)
 * @param accountId - The account being downgraded
 * @param oldTier - Previous tier
 * @param newTier - New (lower) tier
 * @returns Summary of what was capped
 */
export async function capResourcesOnDowngrade(
  db: Pick<Database, 'select' | 'update'>,
  accountId: string,
  oldTier: LicenseTierId,
  newTier: LicenseTierId,
): Promise<CapResult> {
  const result: CapResult = {
    capped: false,
    sitesArchived: 0,
    membershipsRevoked: 0,
    archivedSiteIds: [],
    revokedMembershipIds: [],
  };

  if (!isDowngrade(oldTier, newTier)) {
    return result;
  }

  const newLimits = TIER_LIMITS[newTier];

  // Get all member IDs for this account
  const members = await db
    .select({ userId: accountMemberships.userId })
    .from(accountMemberships)
    .where(
      and(eq(accountMemberships.accountId, accountId), eq(accountMemberships.status, 'active')),
    );

  const memberIds = members.map((m) => m.userId);
  if (memberIds.length === 0) return result;

  // --- Cap Sites ---
  if (newLimits.sites !== null) {
    await capSites(db, memberIds, newLimits.sites, result);
  }

  // --- Cap Users (memberships) ---
  if (newLimits.users !== null) {
    await capMemberships(db, accountId, newLimits.users, result);
  }

  result.capped = result.sitesArchived > 0 || result.membershipsRevoked > 0;

  if (result.capped) {
    logger.info('Resources capped after tier downgrade', {
      accountId,
      oldTier,
      newTier,
      sitesArchived: result.sitesArchived,
      membershipsRevoked: result.membershipsRevoked,
    });
  }

  return result;
}

// =============================================================================
// Site Capping
// =============================================================================

/**
 * Archive excess sites beyond the new tier limit.
 * Archives the oldest non-archived, non-deleted sites first.
 */
async function capSites(
  db: Pick<Database, 'select' | 'update'>,
  memberIds: string[],
  maxSites: number,
  result: CapResult,
): Promise<void> {
  // Count active (non-archived, non-deleted) sites owned by account members
  const [countResult] = await db
    .select({ count: count() })
    .from(sites)
    .where(
      and(inArray(sites.ownerId, memberIds), ne(sites.status, 'archived'), isNull(sites.deletedAt)),
    );

  const currentCount = countResult?.count ?? 0;
  if (currentCount <= maxSites) return;

  const excess = currentCount - maxSites;

  // Get the oldest non-archived sites to archive (preserve the newest)
  const sitesToArchive = await db
    .select({ id: sites.id })
    .from(sites)
    .where(
      and(inArray(sites.ownerId, memberIds), ne(sites.status, 'archived'), isNull(sites.deletedAt)),
    )
    .orderBy(asc(sites.createdAt))
    .limit(excess);

  if (sitesToArchive.length === 0) return;

  const idsToArchive = sitesToArchive.map((s) => s.id);

  await db
    .update(sites)
    .set({ status: 'archived', updatedAt: new Date() })
    .where(inArray(sites.id, idsToArchive));

  result.sitesArchived = idsToArchive.length;
  result.archivedSiteIds = idsToArchive;
}

// =============================================================================
// Membership Capping
// =============================================================================

/**
 * Revoke excess memberships beyond the new tier's user limit.
 * Revokes the newest non-owner memberships first (owners are never revoked).
 */
async function capMemberships(
  db: Pick<Database, 'select' | 'update'>,
  accountId: string,
  maxUsers: number,
  result: CapResult,
): Promise<void> {
  // Count active memberships
  const [countResult] = await db
    .select({ count: count() })
    .from(accountMemberships)
    .where(
      and(eq(accountMemberships.accountId, accountId), eq(accountMemberships.status, 'active')),
    );

  const currentCount = countResult?.count ?? 0;
  if (currentCount <= maxUsers) return;

  const excess = currentCount - maxUsers;

  // Get the newest non-owner memberships to revoke
  const membershipsToRevoke = await db
    .select({ id: accountMemberships.id })
    .from(accountMemberships)
    .where(
      and(
        eq(accountMemberships.accountId, accountId),
        eq(accountMemberships.status, 'active'),
        ne(accountMemberships.role, 'owner'),
      ),
    )
    .orderBy(desc(accountMemberships.createdAt))
    .limit(excess);

  if (membershipsToRevoke.length === 0) return;

  const idsToRevoke = membershipsToRevoke.map((m) => m.id);

  await db
    .update(accountMemberships)
    .set({ status: 'revoked', updatedAt: new Date() })
    .where(inArray(accountMemberships.id, idsToRevoke));

  result.membershipsRevoked = idsToRevoke.length;
  result.revokedMembershipIds = idsToRevoke;
}

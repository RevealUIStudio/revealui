/**
 * User database queries with soft-delete support
 */

import { and, count, desc, eq, gt, ilike, inArray, isNull, or, sql } from 'drizzle-orm';
import { type Database, withTransaction } from '../client/index.js';
import { sites } from '../schema/sites.js';
import { users } from '../schema/users.js';
import { SiteDomainCleanupRequiredError } from './sites.js';

/** Condition that excludes soft-deleted users */
const notDeleted = isNull(users.deletedAt);
const noOwnedConsultationDomain = (userId: string) =>
  sql`NOT EXISTS (SELECT 1 FROM ${sites} WHERE ${sites.ownerId} = ${userId} AND (${sites.settings} ? 'consultationDomain' OR ${sites.settings} ? 'consultationDomainPending'))`;
const CONSULTATION_DOMAIN_OWNER_LOCK_PREFIX = 'consultation-domain-owner:';

/** Preserve the authenticated cleanup owner before any account deletion side effects. */
export async function assertUserDomainCleanupComplete(db: Database, userId: string): Promise<void> {
  const [retained] = await db
    .select({ id: sites.id })
    .from(sites)
    .where(
      and(
        eq(sites.ownerId, userId),
        sql`${sites.settings} ? 'consultationDomain' OR ${sites.settings} ? 'consultationDomainPending'`,
      ),
    )
    .limit(1);
  if (retained)
    throw new SiteDomainCleanupRequiredError(
      undefined,
      'Detach owned consultation hostnames before deleting this account.',
    );
}

/**
 * Admit account erasure before side effects and exclude new provider resources
 * until completion. The domain assignment trigger tries this same advisory key
 * before locking canonical identities. Configured CMS calls reuse the maintained
 * transaction lease, preserving pool capacity while cascading owned sites.
 */
export async function withUserDomainCleanupAdmission<T>(
  db: Database,
  userId: string,
  erase: () => Promise<T>,
): Promise<T> {
  return withTransaction(db, async (tx) => {
    await tx.select({
      admission: sql`pg_advisory_xact_lock(hashtextextended(${CONSULTATION_DOMAIN_OWNER_LOCK_PREFIX} || ${userId}, 0))`,
    });
    await assertUserDomainCleanupComplete(tx, userId);
    return erase();
  });
}

/**
 * Soft cap on the number of users with `role: 'owner'`. App-layer only — not a
 * DB constraint — so the cap can be lifted without a migration. Sized for a
 * small founding team: primary + break-glass + one successor/co-founder slot.
 */
export const OWNER_SOFT_CAP = 3;

/** Error thrown when the owner soft cap would be exceeded. */
export class OwnerSlotError extends Error {
  readonly code = 'OWNER_SLOT_EXHAUSTED';
  readonly currentCount: number;
  readonly max: number;
  constructor(currentCount: number, max: number) {
    super(
      `Owner soft cap reached: ${currentCount}/${max} owners exist. ` +
        `Demote an existing owner before promoting another.`,
    );
    this.name = 'OwnerSlotError';
    this.currentCount = currentCount;
    this.max = max;
  }
}

/** Count non-deleted users with `role: 'owner'`. */
export async function countOwners(db: Database): Promise<number> {
  const result = await db
    .select({ total: count() })
    .from(users)
    .where(and(eq(users.role, 'owner'), notDeleted));
  return result[0]?.total ?? 0;
}

/**
 * Throws `OwnerSlotError` if promoting another user to `owner` would exceed
 * the soft cap. Call *before* writing `role: 'owner'` on an update. Safe to
 * skip during bootstrap: bootstrap only runs when no users exist, so the
 * count is always zero there.
 */
export async function assertOwnerSlotAvailable(
  db: Database,
  max: number = OWNER_SOFT_CAP,
): Promise<void> {
  const current = await countOwners(db);
  if (current >= max) {
    throw new OwnerSlotError(current, max);
  }
}

export interface ListUsersOptions {
  status?: string;
  role?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

/** List users with optional filters and pagination */
export async function getAllUsers(db: Database, options: ListUsersOptions = {}) {
  const { status, role, search, limit = 20, offset = 0 } = options;
  const conditions = [
    notDeleted,
    ...(status ? [eq(users.status, status)] : []),
    ...(role ? [eq(users.role, role)] : []),
    ...(search ? [ilike(users.email, `%${search}%`)] : []),
  ];
  return db
    .select()
    .from(users)
    .where(and(...conditions))
    .orderBy(desc(users.createdAt))
    .limit(limit)
    .offset(offset);
}

/** Count users matching filters (for pagination) */
export async function countUsers(db: Database, options: ListUsersOptions = {}) {
  const { status, role, search } = options;
  const conditions = [
    notDeleted,
    ...(status ? [eq(users.status, status)] : []),
    ...(role ? [eq(users.role, role)] : []),
    ...(search ? [ilike(users.email, `%${search}%`)] : []),
  ];
  const result = await db
    .select({ total: count() })
    .from(users)
    .where(and(...conditions));
  return result[0]?.total ?? 0;
}

/** Update a user's fields */
export async function updateUser(
  db: Database,
  id: string,
  data: Partial<typeof users.$inferInsert>,
  options: { verificationTokenHash?: string } = {},
) {
  const erasing = data.status === 'deleted' || data.deletedAt != null || data.anonymizedAt != null;
  const result = await db
    .update(users)
    .set({ ...data, updatedAt: new Date() })
    .where(
      and(
        eq(users.id, id),
        notDeleted,
        ...(erasing ? [noOwnedConsultationDomain(id)] : []),
        ...(options.verificationTokenHash
          ? [
              eq(users.emailVerificationToken, options.verificationTokenHash),
              eq(users.emailVerified, false),
              eq(users.status, 'active'),
              or(
                isNull(users.emailVerificationTokenExpiresAt),
                gt(users.emailVerificationTokenExpiresAt, new Date()),
              ),
            ]
          : []),
      ),
    )
    .returning()
    .catch((error: unknown) => {
      throw SiteDomainCleanupRequiredError.fromDatabase(error) ?? error;
    });
  if (!result[0] && erasing) await assertUserDomainCleanupComplete(db, id);
  return result[0] ?? null;
}

/** Batch-load multiple users by ID in a single query (prevents N+1) */
export async function getUsersByIds(db: Database, ids: string[]) {
  if (ids.length === 0) return [];
  return db
    .select()
    .from(users)
    .where(and(inArray(users.id, ids), notDeleted));
}

export async function getUserById(db: Database, id: string) {
  const result = await db
    .select()
    .from(users)
    .where(and(eq(users.id, id), notDeleted))
    .limit(1);
  return result[0] ?? null;
}

export async function getUserByEmail(db: Database, email: string) {
  const result = await db
    .select()
    .from(users)
    .where(and(eq(users.email, email), notDeleted))
    .limit(1);
  return result[0] ?? null;
}

/** Soft-delete: sets deletedAt timestamp instead of removing the row */
export async function deleteUser(db: Database, id: string) {
  const removed = await db
    .update(users)
    .set({ deletedAt: new Date(), updatedAt: new Date(), status: 'deleted' })
    .where(and(eq(users.id, id), notDeleted, noOwnedConsultationDomain(id)))
    .returning()
    .catch((error: unknown) => {
      throw SiteDomainCleanupRequiredError.fromDatabase(error) ?? error;
    });
  if (!removed[0]) await assertUserDomainCleanupComplete(db, id);
}

/** Restore a soft-deleted user */
export async function restoreUser(db: Database, id: string) {
  const result = await db
    .update(users)
    .set({ deletedAt: null, updatedAt: new Date(), status: 'active' })
    .where(eq(users.id, id))
    .returning();
  return result[0] ?? null;
}

/** Create a new user and return the inserted row */
export async function createUser(db: Database, data: typeof users.$inferInsert) {
  const result = await db.insert(users).values(data).returning();
  return result[0] ?? null;
}

/** Anonymize PII for GDPR right-to-erasure. Soft-deletes if not already deleted. */
export async function anonymizeUser(db: Database, id: string) {
  const now = new Date();
  const result = await db
    .update(users)
    .set({
      name: 'Deleted User',
      email: null,
      avatarUrl: null,
      password: null,
      mfaSecret: null,
      mfaBackupCodes: null,
      sshKeyFingerprint: null,
      preferences: null,
      emailVerificationToken: null,
      emailVerificationTokenExpiresAt: null,
      agentConfig: null,
      anonymizedAt: now,
      deletedAt: now,
      updatedAt: now,
      status: 'deleted',
    })
    .where(and(eq(users.id, id), noOwnedConsultationDomain(id)))
    .returning()
    .catch((error: unknown) => {
      throw SiteDomainCleanupRequiredError.fromDatabase(error) ?? error;
    });
  if (!result[0]) await assertUserDomainCleanupComplete(db, id);
  return result[0] ?? null;
}

/** Permanently remove a soft-deleted user (GDPR compliance / admin cleanup) */
export async function purgeUser(db: Database, id: string) {
  try {
    const removed = await db
      .delete(users)
      .where(and(eq(users.id, id), noOwnedConsultationDomain(id)))
      .returning();
    if (!removed[0]) {
      await assertUserDomainCleanupComplete(db, id);
    }
  } catch (error) {
    throw SiteDomainCleanupRequiredError.fromDatabase(error) ?? error;
  }
}

/** Count active (non-deleted, status='active') users */
export async function countActiveUsers(db: Database): Promise<number> {
  const result = await db.select({ total: count() }).from(users).where(eq(users.status, 'active'));
  return result[0]?.total ?? 0;
}

/** Record the outcome of a Stripe-side GDPR erasure attempt on a user row.
 * Called after stripe.customers.del succeeds or fails so the audit trail is complete. */
export async function updateUserStripeDeletion(
  db: Database,
  id: string,
  status: 'deleted' | 'failed',
): Promise<void> {
  await db
    .update(users)
    .set({ stripeDeletionStatus: status, stripeDeletionAt: new Date(), updatedAt: new Date() })
    .where(eq(users.id, id));
}

/** Look up a user by their email verification token hash (non-expired only) */
export async function getUserByVerificationToken(db: Database, tokenHash: string) {
  const result = await db
    .select({ id: users.id, emailVerified: users.emailVerified })
    .from(users)
    .where(
      and(
        eq(users.emailVerificationToken, tokenHash),
        or(
          isNull(users.emailVerificationTokenExpiresAt),
          gt(users.emailVerificationTokenExpiresAt, new Date()),
        ),
      ),
    )
    .limit(1);
  return result[0] ?? null;
}

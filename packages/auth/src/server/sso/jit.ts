/**
 * Enterprise SSO JIT user upsert (GAP-464).
 *
 * Flow:
 * 1. Lookup sso_identities by (providerId, subject) → existing user
 * 2. Else if verified email: find users by email → link identity
 *    (enterprise SSO intentionally links by verified email from id_token;
 *    email is used only when emailVerified === true)
 * 3. Else create user with password null and a sanitized role
 * 4. Insert sso_identities; ensure account_memberships row as 'member'
 *
 * Never defaults new users to admin. Membership role is always 'member'
 * (account ACL); mapped SSO role is stored on users.role after allowlist.
 */

import { logger } from '@revealui/core/observability/logger';
import { getClient } from '@revealui/db/client';
import { accountMemberships, ssoIdentities, users } from '@revealui/db/schema';
import { and, eq, isNull } from 'drizzle-orm';
import type { User } from '../../types.js';

/** Roles allowed on users.role for SSO-provisioned humans. */
const ALLOWED_USER_ROLES = new Set(['viewer', 'editor', 'contributor', 'admin', 'owner']);

export interface UpsertSsoUserInput {
  providerId: string;
  /** Provider's account_id — membership is attached here */
  accountId: string;
  /** IdP subject (`sub`) */
  subject: string;
  email?: string;
  /** Only link/create with email when IdP asserts email_verified */
  emailVerified?: boolean;
  name?: string;
  /** Role from mapSsoGroupsToRole (already forbid unmapped admin) */
  role: string;
}

/**
 * Map SSO/group roles onto the users table allowlist.
 * `member` (membership vocabulary) → `viewer` on the user row.
 * Unknown roles fail closed to `viewer` (never admin).
 */
export function normalizeSsoUserRole(role: string): string {
  if (role === 'member') return 'viewer';
  if (ALLOWED_USER_ROLES.has(role)) return role;
  return 'viewer';
}

/**
 * Upsert a user from a validated SSO identity and ensure account membership.
 */
export async function upsertSsoUser(input: UpsertSsoUserInput): Promise<User> {
  const { providerId, accountId, subject, email, emailVerified, name, role } = input;

  if (!(providerId && accountId && subject)) {
    throw new Error('providerId, accountId, and subject are required for SSO JIT');
  }

  const db = getClient();
  const userRole = normalizeSsoUserRole(role);
  const displayName =
    typeof name === 'string' && name.trim().length > 0 ? name.trim() : (email ?? 'SSO User');

  // 1. Existing federated identity
  const [existingIdentity] = await db
    .select()
    .from(ssoIdentities)
    .where(and(eq(ssoIdentities.providerId, providerId), eq(ssoIdentities.subject, subject)))
    .limit(1);

  if (existingIdentity) {
    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, existingIdentity.userId), isNull(users.deletedAt)))
      .limit(1);

    if (!user) {
      logger.error('sso_identities row references missing user', {
        identityId: existingIdentity.id,
        userId: existingIdentity.userId,
      });
      throw new Error('SSO identity references a deleted user');
    }

    // Refresh email on identity if we have a verified one
    if (email && emailVerified === true && existingIdentity.email !== email) {
      await db
        .update(ssoIdentities)
        .set({ email, updatedAt: new Date() })
        .where(eq(ssoIdentities.id, existingIdentity.id));
    }

    await ensureAccountMembership(db, accountId, user.id);
    return user as User;
  }

  // 2. Link by verified email (enterprise SSO intentional JIT)
  let userId: string;
  let isNewUser = false;

  if (email && emailVerified === true) {
    const [existingUser] = await db
      .select()
      .from(users)
      .where(and(eq(users.email, email), isNull(users.deletedAt)))
      .limit(1);

    if (existingUser) {
      userId = existingUser.id;
      logger.info('Linking SSO identity to existing user by verified email', {
        userId,
        providerId,
      });
    } else {
      isNewUser = true;
      userId = crypto.randomUUID();
    }
  } else {
    isNewUser = true;
    userId = crypto.randomUUID();
  }

  // 3. Create user (password null — federated only)
  if (isNewUser) {
    await db.insert(users).values({
      id: userId,
      name: displayName,
      email: email && emailVerified === true ? email : (email ?? null),
      password: null,
      role: userRole,
      status: 'active',
      emailVerified: emailVerified === true,
      emailVerifiedAt: emailVerified === true ? new Date() : null,
    });
  }

  // 4. Insert identity link
  await db.insert(ssoIdentities).values({
    id: crypto.randomUUID(),
    userId,
    providerId,
    subject,
    email: email ?? null,
  });

  await ensureAccountMembership(db, accountId, userId);

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) {
    throw new Error('Failed to fetch upserted SSO user');
  }
  return user as User;
}

async function ensureAccountMembership(
  db: ReturnType<typeof getClient>,
  accountId: string,
  userId: string,
): Promise<void> {
  const [existing] = await db
    .select({ id: accountMemberships.id })
    .from(accountMemberships)
    .where(and(eq(accountMemberships.accountId, accountId), eq(accountMemberships.userId, userId)))
    .limit(1);

  if (existing) return;

  await db.insert(accountMemberships).values({
    id: crypto.randomUUID(),
    accountId,
    userId,
    role: 'member',
    status: 'active',
  });
}

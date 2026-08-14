/**
 * Platform-operator entitlement.
 *
 * Super-admin (`_json.roles`) is the instance operator (first signup / bootstrap).
 * Hosted account owners are shell admins, not super-admin.
 *
 * Operators receive a real Enterprise `account_entitlements` row (source=grant).
 * Gates stay fail-closed. This is not an identity bypass.
 */

import { getConfiguredStripeMode } from '@revealui/config/stripe-mode';
import { getFeaturesForTier } from '@revealui/core/features';
import { logger } from '@revealui/core/observability/logger';
import { getClient } from '@revealui/db';
import { accountEntitlements, accountMemberships, users } from '@revealui/db/schema';
import { and, eq } from 'drizzle-orm';

/** Lockstep with `getHostedLimitsForTier('enterprise')` in apps/server. */
export const PLATFORM_OPERATOR_LIMITS = {
  maxAgentTasks: Number.MAX_SAFE_INTEGER,
} as const;

const SUPER_ADMIN_ROLE = 'super-admin';

export function rolesFromUserJson(json: unknown): string[] {
  let value: unknown = json;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value) as unknown;
    } catch {
      return [];
    }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return [];
  }
  const roles = (value as { roles?: unknown }).roles;
  if (!Array.isArray(roles)) {
    return [];
  }
  return roles.filter((role): role is string => typeof role === 'string');
}

/**
 * True when this user is the instance operator (engine super-admin).
 * Accepts session `_json.roles` and engine `roles`.
 */
export function isPlatformOperatorUser(
  user: { _json?: unknown; roles?: unknown } | null | undefined,
): boolean {
  if (!user) {
    return false;
  }
  if (Array.isArray(user.roles) && user.roles.includes(SUPER_ADMIN_ROLE)) {
    return true;
  }
  return rolesFromUserJson(user._json).includes(SUPER_ADMIN_ROLE);
}

export interface EnsurePlatformOperatorEntitlementResult {
  accountId: string;
  wrote: boolean;
}

export interface EnsurePlatformOperatorSkipped {
  skipped: true;
  reason: string;
}

function featureRecord(features: object): Record<string, boolean> {
  return Object.fromEntries(
    Object.entries(features).filter(
      (entry): entry is [string, boolean] => typeof entry[1] === 'boolean',
    ),
  );
}

function enterpriseRowComplete(row: {
  tier?: string | null;
  status?: string | null;
  features?: unknown;
}): boolean {
  if (row.tier !== 'enterprise') {
    return false;
  }
  if (row.status !== 'active' && row.status !== 'trialing') {
    return false;
  }
  const features =
    row.features && typeof row.features === 'object' && !Array.isArray(row.features)
      ? (row.features as Record<string, unknown>)
      : {};
  return features.ai === true;
}

/**
 * Upsert Enterprise (source=grant) for a platform operator's billing account.
 *
 * Skips users who are not super-admin. Idempotent when the row is already
 * a healthy Enterprise grant with `ai`.
 */
export async function ensurePlatformOperatorEntitlement(params: {
  userId: string;
  accountId?: string;
  now?: Date;
}): Promise<EnsurePlatformOperatorEntitlementResult | EnsurePlatformOperatorSkipped> {
  const db = getClient();
  const [user] = await db
    .select({ id: users.id, json: users._json })
    .from(users)
    .where(eq(users.id, params.userId))
    .limit(1);

  if (!(user && isPlatformOperatorUser({ _json: user.json }))) {
    return { skipped: true, reason: 'not_platform_operator' };
  }

  let accountId = params.accountId;
  if (!accountId) {
    const [membership] = await db
      .select({ accountId: accountMemberships.accountId })
      .from(accountMemberships)
      .where(
        and(
          eq(accountMemberships.userId, params.userId),
          eq(accountMemberships.role, 'owner'),
          eq(accountMemberships.status, 'active'),
        ),
      )
      .limit(1);
    accountId = membership?.accountId;
  }

  if (!accountId) {
    logger.warn('[platform-operator-entitlement] no owner membership; skip', {
      userId: params.userId,
    });
    return { skipped: true, reason: 'no_owner_membership' };
  }

  const mode = getConfiguredStripeMode();
  const [existing] = await db
    .select({
      tier: accountEntitlements.tier,
      status: accountEntitlements.status,
      features: accountEntitlements.features,
      lastEventAt: accountEntitlements.lastEventAt,
    })
    .from(accountEntitlements)
    .where(and(eq(accountEntitlements.accountId, accountId), eq(accountEntitlements.mode, mode)))
    .limit(1);

  if (existing && enterpriseRowComplete(existing)) {
    return { accountId, wrote: false };
  }

  const now = params.now ?? new Date();
  const values = {
    planId: 'enterprise' as const,
    tier: 'enterprise' as const,
    status: 'active',
    features: featureRecord(getFeaturesForTier('enterprise')),
    limits: { ...PLATFORM_OPERATOR_LIMITS },
    meteringStatus: 'active',
    mode,
    source: 'grant' as const,
    graceUntil: null,
    lastEventAt: existing ? (existing.lastEventAt ?? null) : null,
    updatedAt: now,
    cogsBreakerTrippedAt: null,
    cogsBreakerReason: null,
  };

  if (existing) {
    await db
      .update(accountEntitlements)
      .set(values)
      .where(and(eq(accountEntitlements.accountId, accountId), eq(accountEntitlements.mode, mode)));
  } else {
    await db.insert(accountEntitlements).values({ accountId, ...values });
  }

  logger.info('[platform-operator-entitlement] granted enterprise', {
    accountId,
    userId: params.userId,
    mode,
    previousTier: existing?.tier ?? null,
  });

  return { accountId, wrote: true };
}

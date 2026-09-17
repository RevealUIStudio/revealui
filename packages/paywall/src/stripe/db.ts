import { getConfiguredStripeMode } from '@revealui/config/stripe-mode';
import {
  accountEntitlements,
  accountMemberships,
  accountSubscriptions,
  billingCatalog,
  users,
} from '@revealui/db/schema';
import { and, eq, isNull } from 'drizzle-orm';

import {
  type BillingCatalogKind,
  type LicenseTier,
  type PaidTier,
  PaywallBillingError,
  type PgPoolLike,
  type ProtectedStripe,
  type SubscriptionSnapshot,
} from './types.js';

type Db = ReturnType<typeof import('@revealui/db').getClient>;

async function stripeCustomerIsUsable(
  stripe: ProtectedStripe,
  customerId: string,
): Promise<boolean> {
  try {
    const customer = await stripe.customers.retrieve(customerId);
    return !('deleted' in customer && customer.deleted === true);
  } catch {
    return false;
  }
}

/**
 * Resolve an active catalog Stripe price id for a paid tier + billing kind.
 *
 * @example
 * ```ts
 * import { resolveCatalogPriceId } from '@revealui/paywall/stripe';
 * const priceId = await resolveCatalogPriceId(db, 'pro', 'subscription');
 * ```
 */
export async function resolveCatalogPriceId(
  db: Db,
  tier: PaidTier,
  kind: BillingCatalogKind,
  requestedPriceId?: string,
  interval: 'month' | 'year' = 'month',
): Promise<string> {
  const mode = getConfiguredStripeMode();
  const planId =
    kind === 'subscription' && interval === 'year' ? `${kind}:${tier}:year` : `${kind}:${tier}`;
  const [catalogEntry] = await db
    .select({ stripePriceId: billingCatalog.stripePriceId })
    .from(billingCatalog)
    .where(
      and(
        eq(billingCatalog.planId, planId),
        eq(billingCatalog.tier, tier),
        eq(billingCatalog.billingModel, kind),
        eq(billingCatalog.mode, mode),
        eq(billingCatalog.active, true),
      ),
    )
    .limit(1);

  const resolvedPriceId = catalogEntry?.stripePriceId;
  if (!resolvedPriceId) {
    throw new PaywallBillingError(
      500,
      `Billing catalog is not configured for ${kind} ${tier} (${mode} mode)`,
    );
  }
  if (requestedPriceId?.trim() && requestedPriceId.trim() !== resolvedPriceId) {
    throw new PaywallBillingError(
      400,
      'Requested price does not match the server billing catalog.',
    );
  }
  return resolvedPriceId;
}

/**
 * Hosted subscription snapshot from entitlements (grace-aware).
 *
 * @example
 * ```ts
 * import { getHostedSubscriptionSnapshot } from '@revealui/paywall/stripe';
 * const snap = await getHostedSubscriptionSnapshot(db, userId);
 * ```
 */
export async function getHostedSubscriptionSnapshot(
  db: Db,
  userId: string,
): Promise<SubscriptionSnapshot | null> {
  const [membership] = await db
    .select({ accountId: accountMemberships.accountId })
    .from(accountMemberships)
    .where(and(eq(accountMemberships.userId, userId), eq(accountMemberships.status, 'active')))
    .limit(1);
  if (!membership?.accountId) return null;

  const [entitlement] = await db
    .select({
      tier: accountEntitlements.tier,
      status: accountEntitlements.status,
      graceUntil: accountEntitlements.graceUntil,
    })
    .from(accountEntitlements)
    .where(
      and(
        eq(accountEntitlements.accountId, membership.accountId),
        eq(accountEntitlements.mode, getConfiguredStripeMode()),
      ),
    )
    .limit(1);
  if (!entitlement?.tier) return null;

  const now = new Date();
  let effectiveStatus = entitlement.status;
  if (
    (effectiveStatus === 'past_due' ||
      effectiveStatus === 'canceled' ||
      effectiveStatus === 'revoked') &&
    entitlement.graceUntil &&
    entitlement.graceUntil > now
  ) {
    effectiveStatus = 'grace_period';
  }

  return {
    tier: entitlement.tier as LicenseTier,
    status: effectiveStatus,
    graceUntil: entitlement.graceUntil?.toISOString() ?? null,
  };
}

/**
 * Stripe customer id from account subscription, else user row.
 *
 * @example
 * ```ts
 * import { resolveHostedStripeCustomerId } from '@revealui/paywall/stripe';
 * const cus = await resolveHostedStripeCustomerId(db, userId);
 * ```
 */
export async function resolveHostedStripeCustomerId(
  db: Db,
  userId: string,
  accountId?: string | null,
): Promise<string | null> {
  const resolvedAccountId =
    accountId ??
    (
      await db
        .select({ accountId: accountMemberships.accountId })
        .from(accountMemberships)
        .where(and(eq(accountMemberships.userId, userId), eq(accountMemberships.status, 'active')))
        .limit(1)
    )[0]?.accountId;

  if (resolvedAccountId) {
    const [subscription] = await db
      .select({ stripeCustomerId: accountSubscriptions.stripeCustomerId })
      .from(accountSubscriptions)
      .where(eq(accountSubscriptions.accountId, resolvedAccountId))
      .limit(1);
    if (subscription?.stripeCustomerId) {
      return subscription.stripeCustomerId;
    }
  }

  const [dbUser] = await db
    .select({ stripeCustomerId: users.stripeCustomerId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return dbUser?.stripeCustomerId ?? null;
}

/**
 * Create or reuse a Stripe customer for `userId`. Inject db, optional pg pool,
 * and the host Stripe client (OSS paywall never imports Pro services).
 *
 * @example
 * ```ts
 * import { ensureStripeCustomer } from '@revealui/paywall/stripe';
 * const cus = await ensureStripeCustomer(db, pool, stripe, userId, email);
 * ```
 */
export async function ensureStripeCustomer(
  db: Db,
  pool: PgPoolLike | null,
  stripe: ProtectedStripe,
  userId: string,
  email: string,
): Promise<string> {
  const [user] = await db
    .select({ stripeCustomerId: users.stripeCustomerId })
    .from(users)
    .where(eq(users.id, userId));

  const storedCustomerId = user?.stripeCustomerId;
  if (storedCustomerId) {
    if (await stripeCustomerIsUsable(stripe, storedCustomerId)) {
      return storedCustomerId;
    }
    await db
      .update(users)
      .set({ stripeCustomerId: null, updatedAt: new Date() })
      .where(and(eq(users.id, userId), eq(users.stripeCustomerId, storedCustomerId)));
  }

  if (pool) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`stripe:ensure:${userId}`]);
      const winnerResult = await client.query(
        `SELECT stripe_customer_id FROM users WHERE id = $1`,
        [userId],
      );
      const alreadyCreated = winnerResult.rows[0]?.stripe_customer_id;
      if (typeof alreadyCreated === 'string' && alreadyCreated.length > 0) {
        await client.query('COMMIT');
        return alreadyCreated;
      }
      const customer = await stripe.customers.create(
        { email, metadata: { revealui_user_id: userId } },
        { idempotencyKey: `create-customer-${userId}` },
      );
      await client.query(
        `UPDATE users SET stripe_customer_id = $1, updated_at = NOW() WHERE id = $2`,
        [customer.id, userId],
      );
      await client.query('COMMIT');
      return customer.id;
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch {
        /* ignore */
      }
      throw err;
    } finally {
      client.release();
    }
  }

  const customer = await stripe.customers.create(
    { email, metadata: { revealui_user_id: userId } },
    { idempotencyKey: `create-customer-${userId}` },
  );
  await db
    .update(users)
    .set({ stripeCustomerId: customer.id, updatedAt: new Date() })
    .where(and(eq(users.id, userId), isNull(users.stripeCustomerId)));
  const [updated] = await db
    .select({ stripeCustomerId: users.stripeCustomerId })
    .from(users)
    .where(eq(users.id, userId));
  return updated?.stripeCustomerId ?? customer.id;
}

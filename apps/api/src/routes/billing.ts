/**
 * Billing Routes — Stripe checkout, portal, and subscription status
 *
 * Uses RevealUI session auth (not Supabase). Bridges the NeonDB users table
 * with Stripe customer records via the `stripe_customer_id` column.
 */

import { CircuitBreaker, CircuitBreakerOpenError } from '@revealui/core/error-handling';
import { getMaxAgentTasks } from '@revealui/core/license';
import { logger } from '@revealui/core/observability/logger';
import { getClient } from '@revealui/db';
import {
  accountEntitlements,
  accountMemberships,
  accountSubscriptions,
  agentCreditBalance,
  agentTaskUsage,
  billingCatalog,
  licenses,
  processedWebhookEvents,
  users,
} from '@revealui/db/schema';
import { createRoute, OpenAPIHono, z } from '@revealui/openapi';
import { and, count, countDistinct, desc, eq, gt, gte, isNull, lt, lte, sql } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import Stripe from 'stripe';
import {
  sendDowngradeConfirmationEmail,
  sendUpgradeConfirmationEmail,
} from '../lib/webhook-emails.js';
import { resetDbStatusCache, resetSupportExpiryCache } from '../middleware/license.js';

/** Default trial period for new subscriptions (overridable via env) */
const TRIAL_PERIOD_DAYS = Number.parseInt(process.env.REVEALUI_TRIAL_DAYS ?? '7', 10);

/** How far ahead to look for expiring support contracts (overridable via env, default 30 days) */
const SUPPORT_RENEWAL_WINDOW_MS =
  Number.parseInt(process.env.REVEALUI_SUPPORT_RENEWAL_DAYS ?? '30', 10) * 24 * 60 * 60 * 1000;

/**
 * Canonical monthly tier prices in USD (whole dollars).
 * Single source of truth — used for RVUI payment recording and MRR fallbacks.
 * Must match the marketing site and Stripe product catalog.
 */
const CANONICAL_TIER_PRICES: Record<string, number> = {
  pro: 49,
  max: 149,
  enterprise: 299,
};

/**
 * Computes a Stripe meter event timestamp for the last second of a billing cycle.
 *
 * Stripe Billing Meters require event timestamps to fall within the billing period
 * they are associated with. Since we report overage for the *previous* calendar month,
 * the timestamp must be within that month — not in the current month when the cron runs.
 *
 * We take the cycle start (1st of the previous month at 00:00 UTC), add ~30 days
 * (one calendar-month approximation), then subtract 1 second to land on the last
 * second of that cycle. This ensures the meter event is attributed to the correct
 * billing period even if months vary between 28-31 days, because Stripe only checks
 * that the timestamp falls within the subscription's billing interval.
 *
 * @param cycleStart - The first day of the billing cycle (UTC midnight)
 * @returns Unix timestamp (seconds) for the last second of the approximate cycle
 */
function getMeterEventTimestamp(cycleStart: Date): number {
  const SecondsIn30Days = 30 * 24 * 60 * 60;
  return Math.floor(cycleStart.getTime() / 1000 + SecondsIn30Days - 1);
}

interface UserContext {
  id: string;
  email: string | null;
  name: string;
  role: string;
}

interface RequestEntitlements {
  accountId?: string | null;
  subscriptionStatus?: string | null;
  tier?: 'free' | 'pro' | 'max' | 'enterprise';
  limits?: {
    maxAgentTasks?: number;
  };
}

interface BillingEnv {
  Variables: {
    user: UserContext | undefined;
    entitlements?: RequestEntitlements | undefined;
  };
}

const app = new OpenAPIHono<BillingEnv>();

// Circuit breaker for Stripe API — fails fast when Stripe is unreachable
const stripeBreaker = new CircuitBreaker({
  failureThreshold: 5,
  resetTimeout: 30_000,
  successThreshold: 2,
});

let cachedStripe: Stripe | undefined;
function getStripeClient(): Stripe {
  if (cachedStripe) return cachedStripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new HTTPException(500, { message: 'Stripe is not configured' });
  }
  cachedStripe = new Stripe(key, { apiVersion: '2026-03-25.dahlia', maxNetworkRetries: 2 });
  return cachedStripe;
}

/** Execute a Stripe operation through the circuit breaker */
async function withStripe<T>(operation: (stripe: Stripe) => Promise<T>): Promise<T> {
  try {
    return await stripeBreaker.execute(() => operation(getStripeClient()));
  } catch (error) {
    if (error instanceof CircuitBreakerOpenError) {
      throw new HTTPException(503, {
        message: 'Payment service temporarily unavailable. Please try again shortly.',
      });
    }
    // Map Stripe-specific errors to actionable HTTP status codes
    if (error instanceof Stripe.errors.StripeCardError) {
      throw new HTTPException(402, {
        message: 'Your card was declined. Please try a different payment method.',
      });
    }
    if (error instanceof Stripe.errors.StripeRateLimitError) {
      throw new HTTPException(429, {
        message: 'Too many requests to payment service. Please try again shortly.',
      });
    }
    if (error instanceof Stripe.errors.StripeInvalidRequestError) {
      throw new HTTPException(400, {
        message: 'Invalid billing request. Please contact support if this persists.',
      });
    }
    throw error;
  }
}

// ─── Schemas ─────────────────────────────────────────────────────────────────

const CheckoutRequestSchema = z.object({
  priceId: z.string().min(1).optional().openapi({
    description: 'Stripe price ID for the subscription',
    example: 'price_abc123',
  }),
  tier: z.enum(['pro', 'max', 'enterprise']).optional().openapi({
    description: 'License tier (defaults to pro)',
    example: 'pro',
  }),
});

const CheckoutResponseSchema = z.object({
  url: z.string().openapi({ description: 'Stripe checkout URL to redirect to' }),
});

const PortalResponseSchema = z.object({
  url: z.string().openapi({ description: 'Stripe billing portal URL' }),
});

const SubscriptionResponseSchema = z.object({
  tier: z
    .enum(['free', 'pro', 'max', 'enterprise'])
    .openapi({ description: 'Current license tier' }),
  status: z.string().openapi({ description: 'License status', example: 'active' }),
  expiresAt: z.string().nullable().openapi({ description: 'Expiration date (ISO 8601)' }),
  licenseKey: z.string().nullable().openapi({ description: 'JWT license key' }),
  graceUntil: z
    .string()
    .nullable()
    .optional()
    .openapi({ description: 'Grace period end date (ISO 8601), present during past_due' }),
});

const ErrorSchema = z.object({
  error: z.string(),
});

const RefundRequestSchema = z.object({
  paymentIntentId: z.string().min(1).optional().openapi({
    description: 'Stripe PaymentIntent ID to refund. Provide either this or chargeId.',
    example: 'pi_abc123',
  }),
  chargeId: z.string().min(1).optional().openapi({
    description: 'Stripe Charge ID to refund. Provide either this or paymentIntentId.',
    example: 'ch_abc123',
  }),
  amount: z.number().int().positive().optional().openapi({
    description: 'Amount to refund in cents. Omit for full refund.',
    example: 4900,
  }),
  reason: z.enum(['duplicate', 'fraudulent', 'requested_by_customer']).optional().openapi({
    description: 'Reason for the refund (Stripe enum)',
    example: 'requested_by_customer',
  }),
});

const RefundResponseSchema = z.object({
  refundId: z.string().openapi({ description: 'Stripe refund ID', example: 're_abc123' }),
  status: z.string().openapi({ description: 'Refund status', example: 'succeeded' }),
  amount: z.number().openapi({ description: 'Amount refunded in cents', example: 4900 }),
  currency: z.string().openapi({ description: 'Currency code', example: 'usd' }),
});

const UpgradeRequestSchema = z.object({
  priceId: z.string().min(1).optional().openapi({
    description: 'Stripe price ID for the target tier',
    example: 'price_enterprise_monthly',
  }),
  targetTier: z.enum(['pro', 'max', 'enterprise']).openapi({
    description: 'Tier to upgrade to',
    example: 'max',
  }),
});

const UpgradeResponseSchema = z.object({
  success: z.boolean(),
  subscriptionId: z.string().openapi({ description: 'Stripe subscription ID that was updated' }),
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function ensureStripeCustomer(userId: string, email: string): Promise<string> {
  const db = getClient();

  const [user] = await db
    .select({ stripeCustomerId: users.stripeCustomerId })
    .from(users)
    .where(eq(users.id, userId));

  if (user?.stripeCustomerId) {
    return user.stripeCustomerId;
  }

  // Create Stripe customer with idempotency key (safe to retry).
  // NeonDB HTTP driver is stateless — db.transaction() is not supported.
  // Instead we use a conditional UPDATE (WHERE stripe_customer_id IS NULL)
  // so concurrent requests can't overwrite the winner.
  const stripe = getStripeClient();
  const customer = await stripe.customers.create(
    {
      email,
      metadata: { revealui_user_id: userId },
    },
    {
      idempotencyKey: `create-customer-${userId}`,
    },
  );

  // Conditional update: only writes if no customer ID is set yet.
  // If another request already wrote one, this is a no-op.
  await db
    .update(users)
    .set({ stripeCustomerId: customer.id, updatedAt: new Date() })
    .where(and(eq(users.id, userId), isNull(users.stripeCustomerId)));

  // Re-read to return whichever customer ID won the race
  const [updated] = await db
    .select({ stripeCustomerId: users.stripeCustomerId })
    .from(users)
    .where(eq(users.id, userId));

  return updated?.stripeCustomerId ?? customer.id;
}

type PaidTier = 'pro' | 'max' | 'enterprise';
type BillingCatalogKind = 'subscription' | 'perpetual' | 'credits' | 'renewal';

async function resolveCatalogPriceId(
  tier: PaidTier,
  kind: BillingCatalogKind,
  requestedPriceId?: string,
): Promise<string> {
  const db = getClient();
  const planId = `${kind}:${tier}`;
  const [catalogEntry] = await db
    .select({ stripePriceId: billingCatalog.stripePriceId })
    .from(billingCatalog)
    .where(
      and(
        eq(billingCatalog.planId, planId),
        eq(billingCatalog.tier, tier),
        eq(billingCatalog.billingModel, kind),
        eq(billingCatalog.active, true),
      ),
    )
    .limit(1);

  const resolvedPriceId = catalogEntry?.stripePriceId;

  if (!resolvedPriceId) {
    throw new HTTPException(500, {
      message: `Billing catalog is not configured for ${kind} ${tier}`,
    });
  }

  if (requestedPriceId?.trim() && requestedPriceId.trim() !== resolvedPriceId) {
    throw new HTTPException(400, {
      message: 'Requested price does not match the server billing catalog.',
    });
  }

  return resolvedPriceId;
}

async function getHostedSubscriptionSnapshot(userId: string): Promise<{
  tier: 'free' | 'pro' | 'max' | 'enterprise';
  status: string;
  graceUntil: string | null;
} | null> {
  const db = getClient();
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
    .where(eq(accountEntitlements.accountId, membership.accountId))
    .limit(1);

  if (!entitlement?.tier) return null;

  // Grace period enforcement: if status is past_due/canceled but graceUntil
  // is in the future, the customer retains access until grace expires
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
    tier: entitlement.tier as 'free' | 'pro' | 'max' | 'enterprise',
    status: effectiveStatus,
    graceUntil: entitlement.graceUntil?.toISOString() ?? null,
  };
}

async function resolveHostedStripeCustomerId(
  userId: string,
  accountId?: string | null,
): Promise<string | null> {
  const db = getClient();
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

function resolveUsageQuota(c: { get: (key: string) => unknown }): number {
  const requestEntitlements = c.get('entitlements') as RequestEntitlements | undefined;
  const accountQuota = requestEntitlements?.limits?.maxAgentTasks;

  if (typeof accountQuota === 'number') {
    return accountQuota;
  }

  return getMaxAgentTasks();
}

// ─── Early Adopter Coupon ─────────────────────────────────────────────────────

/** Early adopter coupon config — set via env vars, not hardcoded */
interface EarlyAdopterConfig {
  endDate: Date | null;
  coupons: Record<string, string | undefined>;
}

function getEarlyAdopterConfig(): EarlyAdopterConfig {
  const endStr = process.env.REVEALUI_EARLY_ADOPTER_END;
  return {
    endDate: endStr && !Number.isNaN(new Date(endStr).getTime()) ? new Date(endStr) : null,
    coupons: {
      pro: process.env.REVEALUI_EARLY_ADOPTER_COUPON_PRO,
      max: process.env.REVEALUI_EARLY_ADOPTER_COUPON_MAX,
      enterprise: process.env.REVEALUI_EARLY_ADOPTER_COUPON_ENT,
    },
  };
}

/**
 * Returns either a `discounts` array (early adopter coupon) or `allow_promotion_codes: true`.
 * Stripe's `discounts` and `allow_promotion_codes` are mutually exclusive — when the early
 * adopter coupon is active, manual promotion codes are disabled.
 */
function getEarlyAdopterDiscount(
  tier: string,
): { discounts: Array<{ coupon: string }> } | { allow_promotion_codes: true } {
  const config = getEarlyAdopterConfig();
  if (!config.endDate || new Date() > config.endDate) {
    return { allow_promotion_codes: true };
  }
  const couponId = config.coupons[tier];
  if (!couponId) {
    return { allow_promotion_codes: true };
  }
  return { discounts: [{ coupon: couponId }] };
}

export type { EarlyAdopterConfig };
// Exported for testing
export { getEarlyAdopterConfig, getEarlyAdopterDiscount };

// ─── Routes ──────────────────────────────────────────────────────────────────

// POST /api/billing/checkout — Create a Stripe checkout session
const checkoutRoute = createRoute({
  method: 'post',
  path: '/checkout',
  tags: ['billing'],
  summary: 'Create a checkout session',
  description:
    'Creates a Stripe checkout session for subscription purchase. Requires authentication.',
  request: {
    body: {
      content: {
        'application/json': { schema: CheckoutRequestSchema },
      },
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: CheckoutResponseSchema } },
      description: 'Checkout session created',
    },
    401: {
      content: { 'application/json': { schema: ErrorSchema } },
      description: 'Not authenticated',
    },
  },
});

app.openapi(checkoutRoute, async (c) => {
  const user = c.get('user');
  if (!user) {
    throw new HTTPException(401, { message: 'Authentication required' });
  }

  const { priceId, tier } = c.req.valid('json');
  const resolvedTier = tier ?? 'pro';
  const resolvedPriceId = await resolveCatalogPriceId(resolvedTier, 'subscription', priceId);

  if (!user.email) {
    throw new HTTPException(400, { message: 'An email address is required for billing' });
  }
  const customerId = await ensureStripeCustomer(user.id, user.email);

  // Prevent duplicate subscriptions — a user with an active, trialing, or incomplete subscription
  // must use upgrade instead. Checking only 'active' previously allowed duplicates when the first
  // subscription was still trialing or had an incomplete initial payment.
  const existingSubs = await withStripe((stripe) =>
    stripe.subscriptions.list({ customer: customerId, limit: 5 }),
  );
  const blockingStatuses = new Set(['active', 'trialing', 'incomplete', 'past_due']);
  const blockingSub = existingSubs.data.find((s) => blockingStatuses.has(s.status));
  if (blockingSub) {
    throw new HTTPException(409, {
      message: `You already have a subscription (status: ${blockingSub.status}). Use the upgrade route to change tiers.`,
    });
  }

  const adminUrl = process.env.ADMIN_URL || process.env.NEXT_PUBLIC_SERVER_URL;
  if (!adminUrl) throw new HTTPException(500, { message: 'ADMIN_URL is not configured' });

  const discountConfig = getEarlyAdopterDiscount(resolvedTier);

  // 10-minute idempotency window: prevents duplicate checkout sessions from
  // double-clicks or network retries while allowing a fresh attempt after 10 min.
  const idempotencyWindow = Math.floor(Date.now() / (10 * 60 * 1000));
  const session = await withStripe((stripe) =>
    stripe.checkout.sessions.create(
      {
        customer: customerId,
        mode: 'subscription',
        payment_method_types: ['card'],
        billing_address_collection: 'required',
        tax_id_collection: { enabled: true },
        automatic_tax: { enabled: true },
        ...discountConfig,
        line_items: [{ price: resolvedPriceId, quantity: 1 }],
        subscription_data: {
          trial_period_days: TRIAL_PERIOD_DAYS,
          metadata: { tier: resolvedTier, revealui_user_id: user.id },
        },
        success_url: `${adminUrl}/account/billing?success=true`,
        cancel_url: `${adminUrl}/account/billing`,
      },
      { idempotencyKey: `checkout-sub-${user.id}-${resolvedTier}-${idempotencyWindow}` },
    ),
  );

  if (!session.url) {
    throw new HTTPException(500, { message: 'Failed to create checkout session' });
  }

  return c.json({ url: session.url }, 200);
});

// POST /api/billing/portal — Create a Stripe billing portal session
const portalRoute = createRoute({
  method: 'post',
  path: '/portal',
  tags: ['billing'],
  summary: 'Create a billing portal session',
  description: 'Creates a Stripe billing portal session for subscription management.',
  responses: {
    200: {
      content: { 'application/json': { schema: PortalResponseSchema } },
      description: 'Portal session created',
    },
    401: {
      content: { 'application/json': { schema: ErrorSchema } },
      description: 'Not authenticated',
    },
  },
});

app.openapi(portalRoute, async (c) => {
  const user = c.get('user');
  if (!user) {
    throw new HTTPException(401, { message: 'Authentication required' });
  }

  const requestEntitlements = c.get('entitlements') as RequestEntitlements | undefined;
  const customerId = await resolveHostedStripeCustomerId(user.id, requestEntitlements?.accountId);
  if (!customerId) {
    throw new HTTPException(400, {
      message: 'No billing account found. Purchase a subscription first.',
    });
  }
  const adminUrl = process.env.ADMIN_URL || process.env.NEXT_PUBLIC_SERVER_URL;
  if (!adminUrl) throw new HTTPException(500, { message: 'ADMIN_URL is not configured' });

  const session = await withStripe((stripe) =>
    stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${adminUrl}/account/billing`,
    }),
  );

  return c.json({ url: session.url }, 200);
});

// GET /api/billing/subscription — Get current user's subscription/license status
const subscriptionRoute = createRoute({
  method: 'get',
  path: '/subscription',
  tags: ['billing'],
  summary: 'Get subscription status',
  description: "Returns the current user's license tier, status, and expiration.",
  responses: {
    200: {
      content: { 'application/json': { schema: SubscriptionResponseSchema } },
      description: 'Current subscription status',
    },
    401: {
      content: { 'application/json': { schema: ErrorSchema } },
      description: 'Not authenticated',
    },
  },
});

app.openapi(subscriptionRoute, async (c) => {
  const user = c.get('user');
  if (!user) {
    throw new HTTPException(401, { message: 'Authentication required' });
  }

  const requestEntitlements = c.get('entitlements') as RequestEntitlements | undefined;
  if (requestEntitlements?.accountId && requestEntitlements.tier) {
    return c.json(
      {
        tier: requestEntitlements.tier,
        status: requestEntitlements.subscriptionStatus ?? 'active',
        expiresAt: null,
        licenseKey: null,
      },
      200,
    );
  }

  const hostedSubscription = await getHostedSubscriptionSnapshot(user.id);
  if (hostedSubscription) {
    return c.json(
      {
        tier: hostedSubscription.tier,
        status: hostedSubscription.status,
        expiresAt: null,
        licenseKey: null,
        graceUntil: hostedSubscription.graceUntil,
      },
      200,
    );
  }

  const db = getClient();
  const [license] = await db
    .select({
      tier: licenses.tier,
      status: licenses.status,
      expiresAt: licenses.expiresAt,
      licenseKey: licenses.licenseKey,
      perpetual: licenses.perpetual,
      supportExpiresAt: licenses.supportExpiresAt,
    })
    .from(licenses)
    .where(and(eq(licenses.userId, user.id), isNull(licenses.deletedAt)))
    .orderBy(desc(licenses.createdAt))
    .limit(1);

  if (!license) {
    return c.json(
      {
        tier: 'free' as const,
        status: 'active',
        expiresAt: null,
        licenseKey: null,
      },
      200,
    );
  }

  return c.json(
    {
      tier: license.tier as 'free' | 'pro' | 'max' | 'enterprise',
      status: license.status,
      expiresAt: license.expiresAt?.toISOString() ?? null,
      licenseKey: license.licenseKey,
      perpetual: license.perpetual ?? false,
      supportExpiresAt: license.supportExpiresAt?.toISOString() ?? null,
    },
    200,
  );
});

/** Tier rank ordering for upgrade/downgrade direction validation */
const TIER_ORDER: Record<string, number> = { free: 0, pro: 1, max: 2, enterprise: 3 };

// POST /api/billing/upgrade — Upgrade an active subscription to a higher tier
const upgradeRoute = createRoute({
  method: 'post',
  path: '/upgrade',
  tags: ['billing'],
  summary: 'Upgrade subscription tier',
  description:
    'Upgrades an active subscription to a new price/tier mid-cycle. Prorations are created automatically. Requires an existing active subscription.',
  request: {
    body: {
      content: {
        'application/json': { schema: UpgradeRequestSchema },
      },
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: UpgradeResponseSchema } },
      description: 'Subscription upgraded — Stripe will fire customer.subscription.updated',
    },
    400: {
      content: { 'application/json': { schema: ErrorSchema } },
      description: 'No active subscription or no billing account',
    },
    401: {
      content: { 'application/json': { schema: ErrorSchema } },
      description: 'Not authenticated',
    },
  },
});

app.openapi(upgradeRoute, async (c) => {
  const user = c.get('user');
  if (!user) {
    throw new HTTPException(401, { message: 'Authentication required' });
  }

  const { priceId, targetTier } = c.req.valid('json');
  const resolvedPriceId = await resolveCatalogPriceId(targetTier, 'subscription', priceId);
  const requestEntitlements = c.get('entitlements') as RequestEntitlements | undefined;

  // Validate upgrade direction — reject downgrades via upgrade route
  const currentTier = (requestEntitlements?.tier as string) ?? 'free';
  const currentRank = TIER_ORDER[currentTier] ?? 0;
  const targetRank = TIER_ORDER[targetTier] ?? 0;

  if (targetRank <= currentRank) {
    throw new HTTPException(400, {
      message: `Cannot downgrade from ${currentTier} to ${targetTier} via upgrade route. Use the downgrade route instead.`,
    });
  }

  const stripeCustomerId = await resolveHostedStripeCustomerId(
    user.id,
    requestEntitlements?.accountId,
  );
  if (!stripeCustomerId) {
    throw new HTTPException(400, {
      message: 'No billing account found. Purchase a subscription first.',
    });
  }

  // Find the user's current active subscription
  const subscriptionList = await withStripe((stripe) =>
    stripe.subscriptions.list({
      customer: stripeCustomerId,
      status: 'active',
      limit: 1,
    }),
  );

  const subscription = subscriptionList.data[0];
  if (!subscription) {
    throw new HTTPException(400, { message: 'No active subscription found to upgrade.' });
  }

  const item = subscription.items.data[0];
  if (!item) {
    throw new HTTPException(400, { message: 'Subscription has no items.' });
  }

  // R5-H10: Reject concurrent subscription modifications (with 15-min staleness expiry)
  if (subscription.metadata?.pending_change) {
    const pendingAt = Number(subscription.metadata.pending_change_at || 0);
    const isStale = pendingAt > 0 && Date.now() - pendingAt > 15 * 60 * 1000;
    if (!isStale) {
      throw new HTTPException(409, {
        message: 'A subscription change is already in progress. Please wait and try again.',
      });
    }
    logger.warn('Stale pending_change detected, allowing override', {
      subscriptionId: subscription.id,
      pendingChange: subscription.metadata.pending_change,
      pendingAt,
    });
  }

  // Swap the price and set tier metadata so the webhook can detect the upgrade.
  // Idempotency key prevents duplicate mutations from concurrent requests (M-13).
  await withStripe((stripe) =>
    stripe.subscriptions.update(
      subscription.id,
      {
        items: [{ id: item.id, price: resolvedPriceId }],
        metadata: {
          tier: targetTier,
          revealui_user_id: user.id,
          pending_change: `upgrade:${targetTier}`,
          pending_change_at: String(Date.now()),
        },
        proration_behavior: 'create_prorations',
      },
      { idempotencyKey: `upgrade-${subscription.id}-${targetTier}-${user.id}` },
    ),
  );

  // Send upgrade confirmation email (fire-and-forget)
  if (user.email) {
    sendUpgradeConfirmationEmail(user.email, {
      fromTier: currentTier,
      toTier: targetTier,
    }).catch((err) => {
      logger.error('Failed to send upgrade confirmation email', undefined, {
        detail: err instanceof Error ? err.message : 'unknown',
      });
    });
  }

  return c.json({ success: true, subscriptionId: subscription.id }, 200);
});

// POST /api/billing/downgrade — Downgrade to free tier (cancel subscription)
const DowngradeResponseSchema = z.object({
  success: z.boolean(),
  effectiveAt: z.string().openapi({ description: 'When the downgrade takes effect (ISO 8601)' }),
});

const downgradeRoute = createRoute({
  method: 'post',
  path: '/downgrade',
  tags: ['billing'],
  summary: 'Downgrade to free tier',
  description:
    'Cancels the active subscription at the end of the current billing period. The user retains Pro/Enterprise access until then.',
  responses: {
    200: {
      content: { 'application/json': { schema: DowngradeResponseSchema } },
      description: 'Subscription scheduled for cancellation at end of billing period',
    },
    400: {
      content: { 'application/json': { schema: ErrorSchema } },
      description: 'No active subscription found',
    },
    401: {
      content: { 'application/json': { schema: ErrorSchema } },
      description: 'Not authenticated',
    },
  },
});

app.openapi(downgradeRoute, async (c) => {
  const user = c.get('user');
  if (!user) {
    throw new HTTPException(401, { message: 'Authentication required' });
  }

  const requestEntitlements = c.get('entitlements') as RequestEntitlements | undefined;
  const stripeCustomerId = await resolveHostedStripeCustomerId(
    user.id,
    requestEntitlements?.accountId,
  );
  if (!stripeCustomerId) {
    throw new HTTPException(400, {
      message: 'No billing account found.',
    });
  }

  const subscriptionList = await withStripe((stripe) =>
    stripe.subscriptions.list({
      customer: stripeCustomerId,
      status: 'active',
      limit: 1,
    }),
  );

  const subscription = subscriptionList.data[0];
  if (!subscription) {
    throw new HTTPException(400, { message: 'No active subscription found to downgrade.' });
  }

  // R5-H10: Reject concurrent subscription modifications (with 15-min staleness expiry)
  if (subscription.metadata?.pending_change) {
    const pendingAt = Number(subscription.metadata.pending_change_at || 0);
    const isStale = pendingAt > 0 && Date.now() - pendingAt > 15 * 60 * 1000;
    if (!isStale) {
      throw new HTTPException(409, {
        message: 'A subscription change is already in progress. Please wait and try again.',
      });
    }
    logger.warn('Stale pending_change detected, allowing override', {
      subscriptionId: subscription.id,
      pendingChange: subscription.metadata.pending_change,
      pendingAt,
    });
  }

  // Cancel at period end so the customer retains access until their billing cycle ends.
  // Set pending_change to block concurrent modifications (cleared by webhook handler).
  // Idempotency key prevents duplicate mutations from concurrent requests (M-13).
  const updated = await withStripe((stripe) =>
    stripe.subscriptions.update(
      subscription.id,
      {
        cancel_at_period_end: true,
        metadata: { pending_change: 'downgrade:free', pending_change_at: String(Date.now()) },
      },
      { idempotencyKey: `downgrade-${subscription.id}-free-${user.id}` },
    ),
  );

  // cancel_at is populated by Stripe when cancel_at_period_end is set
  const cancelAt = updated.cancel_at;
  const effectiveDate = cancelAt
    ? new Date(cancelAt * 1000).toISOString()
    : new Date().toISOString();

  // Stamp the license expiry so the sweep cron and on-demand checks know when to
  // transition the status — without this, the DB record stays 'active' indefinitely
  // until the subscription.deleted webhook fires at period end.
  if (cancelAt) {
    const db = getClient();
    await db
      .update(licenses)
      .set({ expiresAt: new Date(cancelAt * 1000), updatedAt: new Date() })
      .where(
        and(
          eq(licenses.subscriptionId, subscription.id),
          eq(licenses.status, 'active'),
          isNull(licenses.deletedAt),
        ),
      );
  }

  // Send downgrade confirmation email (fire-and-forget)
  if (user.email) {
    const currentTier = (requestEntitlements?.tier as string) ?? 'pro';
    const readableDate = cancelAt
      ? new Date(cancelAt * 1000).toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        })
      : 'soon';
    sendDowngradeConfirmationEmail(user.email, {
      fromTier: currentTier,
      toTier: 'free',
      effectiveDate: readableDate,
    }).catch((err) => {
      logger.error('Failed to send downgrade confirmation email', undefined, {
        detail: err instanceof Error ? err.message : 'unknown',
      });
    });
  }

  return c.json({ success: true, effectiveAt: effectiveDate }, 200);
});

// POST /api/billing/checkout-perpetual — One-time perpetual license purchase
const PerpetualCheckoutRequestSchema = z.object({
  priceId: z.string().min(1).optional().openapi({
    description: 'Stripe price ID for the perpetual license product',
    example: 'price_pro_perpetual',
  }),
  tier: z.enum(['pro', 'max', 'enterprise']).openapi({
    description: 'Perpetual license tier',
    example: 'pro',
  }),
  githubUsername: z.string().optional().openapi({
    description: 'GitHub username for revealui-pro team access provisioning',
    example: 'octocat',
  }),
});

const perpetualCheckoutRoute = createRoute({
  method: 'post',
  path: '/checkout-perpetual',
  tags: ['billing'],
  summary: 'Create a perpetual license checkout session',
  description:
    'Creates a one-time Stripe payment session for a perpetual license. Includes 1 year of support. Requires authentication.',
  request: {
    body: {
      content: {
        'application/json': { schema: PerpetualCheckoutRequestSchema },
      },
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: CheckoutResponseSchema } },
      description: 'Checkout session created',
    },
    401: {
      content: { 'application/json': { schema: ErrorSchema } },
      description: 'Not authenticated',
    },
  },
});

app.openapi(perpetualCheckoutRoute, async (c) => {
  const user = c.get('user');
  if (!user) {
    throw new HTTPException(401, { message: 'Authentication required' });
  }

  if (!user.email) {
    throw new HTTPException(400, { message: 'An email address is required for billing' });
  }

  const { priceId, tier, githubUsername } = c.req.valid('json');

  const db = getClient();

  // Prevent duplicate perpetual purchases for the same tier
  const [existingPerpetual] = await db
    .select({ id: licenses.id })
    .from(licenses)
    .where(
      and(
        eq(licenses.userId, user.id),
        eq(licenses.perpetual, true),
        eq(licenses.tier, tier),
        eq(licenses.status, 'active'),
        isNull(licenses.deletedAt),
      ),
    )
    .limit(1);
  if (existingPerpetual) {
    throw new HTTPException(409, {
      message: `You already have an active perpetual ${tier} license`,
    });
  }

  const resolvedPriceId = await resolveCatalogPriceId(tier, 'perpetual', priceId);
  const customerId = await ensureStripeCustomer(user.id, user.email);

  const adminUrl = process.env.ADMIN_URL || process.env.NEXT_PUBLIC_SERVER_URL;
  if (!adminUrl) throw new HTTPException(500, { message: 'ADMIN_URL is not configured' });

  const perpetualIdempotencyWindow = Math.floor(Date.now() / (10 * 60 * 1000));
  const session = await withStripe((stripe) =>
    stripe.checkout.sessions.create(
      {
        customer: customerId,
        mode: 'payment',
        payment_method_types: ['card'],
        billing_address_collection: 'required',
        tax_id_collection: { enabled: true },
        automatic_tax: { enabled: true },
        allow_promotion_codes: true,
        line_items: [{ price: resolvedPriceId, quantity: 1 }],
        payment_intent_data: {
          metadata: {
            tier,
            perpetual: 'true',
            revealui_user_id: user.id,
            ...(githubUsername && { github_username: githubUsername }),
          },
        },
        metadata: {
          tier,
          perpetual: 'true',
          revealui_user_id: user.id,
          ...(githubUsername && { github_username: githubUsername }),
        },
        success_url: `${adminUrl}/account/billing?perpetual=true`,
        cancel_url: `${adminUrl}/account/billing`,
      },
      { idempotencyKey: `checkout-perpetual-${user.id}-${tier}-${perpetualIdempotencyWindow}` },
    ),
  );

  if (!session.url) {
    throw new HTTPException(500, { message: 'Failed to create checkout session' });
  }

  return c.json({ url: session.url }, 200);
});

// POST /api/billing/checkout-support-renewal — Renew expired/expiring support on a perpetual license
const SupportRenewalCheckoutRequestSchema = z.object({
  priceId: z.string().min(1).optional().openapi({
    description: 'Stripe price ID for the support renewal product',
    example: 'price_renewal_pro',
  }),
  tier: z.enum(['pro', 'max', 'enterprise']).openapi({
    description: 'Perpetual license tier whose support to renew',
    example: 'pro',
  }),
});

const supportRenewalCheckoutRoute = createRoute({
  method: 'post',
  path: '/checkout-support-renewal',
  tags: ['billing'],
  summary: 'Create a support renewal checkout session',
  description:
    'Creates a one-time Stripe payment session to renew the annual support contract on a perpetual license. Requires authentication and an existing perpetual license.',
  request: {
    body: {
      content: {
        'application/json': { schema: SupportRenewalCheckoutRequestSchema },
      },
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: CheckoutResponseSchema } },
      description: 'Checkout session created',
    },
    401: {
      content: { 'application/json': { schema: ErrorSchema } },
      description: 'Not authenticated',
    },
    404: {
      content: { 'application/json': { schema: ErrorSchema } },
      description: 'No perpetual license found for this tier',
    },
  },
});

app.openapi(supportRenewalCheckoutRoute, async (c) => {
  const user = c.get('user');
  if (!user) {
    throw new HTTPException(401, { message: 'Authentication required' });
  }

  if (!user.email) {
    throw new HTTPException(400, { message: 'An email address is required for billing' });
  }

  const { priceId, tier } = c.req.valid('json');

  const db = getClient();

  // Verify the user has an active or support_expired perpetual license for this tier
  const [license] = await db
    .select({ id: licenses.id, supportExpiresAt: licenses.supportExpiresAt })
    .from(licenses)
    .where(
      and(
        eq(licenses.userId, user.id),
        eq(licenses.perpetual, true),
        eq(licenses.tier, tier),
        sql`${licenses.status} IN ('active', 'support_expired')`,
        isNull(licenses.deletedAt),
      ),
    )
    .limit(1);

  if (!license) {
    throw new HTTPException(404, {
      message: `No perpetual ${tier} license found. Purchase a perpetual license first.`,
    });
  }

  const resolvedPriceId = await resolveCatalogPriceId(tier, 'renewal', priceId);
  const customerId = await ensureStripeCustomer(user.id, user.email);

  const adminUrl = process.env.ADMIN_URL || process.env.NEXT_PUBLIC_SERVER_URL;
  if (!adminUrl) throw new HTTPException(500, { message: 'ADMIN_URL is not configured' });

  const renewalIdempotencyWindow = Math.floor(Date.now() / (10 * 60 * 1000));
  const session = await withStripe((stripe) =>
    stripe.checkout.sessions.create(
      {
        customer: customerId,
        mode: 'payment',
        payment_method_types: ['card'],
        billing_address_collection: 'required',
        tax_id_collection: { enabled: true },
        automatic_tax: { enabled: true },
        allow_promotion_codes: true,
        line_items: [{ price: resolvedPriceId, quantity: 1 }],
        payment_intent_data: {
          metadata: {
            tier,
            support_renewal: 'true',
            license_id: license.id,
            revealui_user_id: user.id,
          },
        },
        metadata: {
          tier,
          support_renewal: 'true',
          license_id: license.id,
          revealui_user_id: user.id,
        },
        success_url: `${adminUrl}/account/billing?renewal=true`,
        cancel_url: `${adminUrl}/account/billing`,
      },
      { idempotencyKey: `checkout-renewal-${user.id}-${license.id}-${renewalIdempotencyWindow}` },
    ),
  );

  if (!session.url) {
    throw new HTTPException(500, { message: 'Failed to create checkout session' });
  }

  return c.json({ url: session.url }, 200);
});

// POST /api/billing/checkout-credits — One-time credit bundle purchase
const CreditCheckoutRequestSchema = z.object({
  priceId: z.string().min(1).optional().openapi({
    description: 'Stripe price ID for the credit bundle product',
    example: 'price_credits_standard',
  }),
  bundle: z.enum(['starter', 'standard', 'scale']).openapi({
    description: 'Credit bundle name',
    example: 'standard',
  }),
});

const BUNDLE_TASKS: Record<string, number> = {
  starter: 10_000,
  standard: 60_000,
  scale: 350_000,
};

const creditCheckoutRoute = createRoute({
  method: 'post',
  path: '/checkout-credits',
  tags: ['billing'],
  summary: 'Create a credit bundle checkout session',
  description:
    'Creates a one-time Stripe payment session for an agent task credit bundle. Credits never expire and stack with the monthly tier allowance. Requires authentication.',
  request: {
    body: {
      content: {
        'application/json': { schema: CreditCheckoutRequestSchema },
      },
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: CheckoutResponseSchema } },
      description: 'Checkout session created',
    },
    401: {
      content: { 'application/json': { schema: ErrorSchema } },
      description: 'Not authenticated',
    },
  },
});

app.openapi(creditCheckoutRoute, async (c) => {
  const user = c.get('user');
  if (!user) {
    throw new HTTPException(401, { message: 'Authentication required' });
  }

  if (!user.email) {
    throw new HTTPException(400, { message: 'An email address is required for billing' });
  }

  const { priceId, bundle } = c.req.valid('json');
  const tasks = BUNDLE_TASKS[bundle];
  if (!tasks) {
    throw new HTTPException(400, { message: `Unknown credit bundle: ${bundle}` });
  }

  // Resolve price from catalog (planId = "credits:starter", etc.)
  const db = getClient();
  const planId = `credits:${bundle}`;
  const [catalogEntry] = await db
    .select({ stripePriceId: billingCatalog.stripePriceId })
    .from(billingCatalog)
    .where(
      and(
        eq(billingCatalog.planId, planId),
        eq(billingCatalog.billingModel, 'credits'),
        eq(billingCatalog.active, true),
      ),
    )
    .limit(1);

  const resolvedPriceId = catalogEntry?.stripePriceId;
  if (!resolvedPriceId) {
    throw new HTTPException(500, {
      message: `Billing catalog is not configured for credits ${bundle}`,
    });
  }

  if (priceId?.trim() && priceId.trim() !== resolvedPriceId) {
    throw new HTTPException(400, {
      message: 'Requested price does not match the server billing catalog.',
    });
  }

  const customerId = await ensureStripeCustomer(user.id, user.email);

  const adminUrl = process.env.ADMIN_URL || process.env.NEXT_PUBLIC_SERVER_URL;
  if (!adminUrl) throw new HTTPException(500, { message: 'ADMIN_URL is not configured' });

  const creditIdempotencyWindow = Math.floor(Date.now() / (10 * 60 * 1000));
  const session = await withStripe((stripe) =>
    stripe.checkout.sessions.create(
      {
        customer: customerId,
        mode: 'payment',
        payment_method_types: ['card'],
        automatic_tax: { enabled: true },
        allow_promotion_codes: true,
        line_items: [{ price: resolvedPriceId, quantity: 1 }],
        payment_intent_data: {
          metadata: {
            credits_bundle: bundle,
            credits_tasks: String(tasks),
            revealui_user_id: user.id,
          },
        },
        metadata: {
          credits_bundle: bundle,
          credits_tasks: String(tasks),
          revealui_user_id: user.id,
        },
        success_url: `${adminUrl}/account/billing?credits=${bundle}`,
        cancel_url: `${adminUrl}/account/billing`,
      },
      { idempotencyKey: `checkout-credits-${user.id}-${bundle}-${creditIdempotencyWindow}` },
    ),
  );

  if (!session.url) {
    throw new HTTPException(500, { message: 'Failed to create checkout session' });
  }

  return c.json({ url: session.url }, 200);
});

// GET /api/billing/credits — Current credit balance
const CreditBalanceResponseSchema = z.object({
  balance: z.number().openapi({ description: 'Remaining prepaid credits' }),
  totalPurchased: z.number().openapi({ description: 'Lifetime credits purchased' }),
});

const creditBalanceRoute = createRoute({
  method: 'get',
  path: '/credits',
  tags: ['billing'],
  summary: 'Get current credit balance',
  description: "Returns the authenticated user's prepaid agent task credit balance.",
  responses: {
    200: {
      content: { 'application/json': { schema: CreditBalanceResponseSchema } },
      description: 'Credit balance',
    },
    401: {
      content: { 'application/json': { schema: ErrorSchema } },
      description: 'Not authenticated',
    },
  },
});

app.openapi(creditBalanceRoute, async (c) => {
  const user = c.get('user');
  if (!user) {
    throw new HTTPException(401, { message: 'Authentication required' });
  }

  const db = getClient();
  const [row] = await db
    .select({
      balance: agentCreditBalance.balance,
      totalPurchased: agentCreditBalance.totalPurchased,
    })
    .from(agentCreditBalance)
    .where(eq(agentCreditBalance.userId, user.id))
    .limit(1);

  return c.json({ balance: row?.balance ?? 0, totalPurchased: row?.totalPurchased ?? 0 }, 200);
});

// GET /api/billing/usage — Agent task usage for the current billing cycle
const UsageResponseSchema = z.object({
  used: z.number().openapi({ description: 'Tasks executed this billing cycle' }),
  quota: z.number().openapi({ description: 'Maximum tasks for this tier (-1 = unlimited)' }),
  overage: z.number().openapi({ description: 'Tasks beyond the tier quota' }),
  cycleStart: z.string().openapi({ description: 'Start of current billing cycle (ISO 8601)' }),
  resetAt: z
    .string()
    .openapi({ description: 'When the cycle resets (start of next month, ISO 8601)' }),
});

const usageRoute = createRoute({
  method: 'get',
  path: '/usage',
  tags: ['billing'],
  summary: 'Agent task usage',
  description: 'Returns agent task usage for the current billing cycle.',
  responses: {
    200: {
      content: { 'application/json': { schema: UsageResponseSchema } },
      description: 'Current cycle usage',
    },
    401: {
      content: { 'application/json': { schema: ErrorSchema } },
      description: 'Not authenticated',
    },
  },
});

app.openapi(usageRoute, async (c) => {
  const user = c.get('user');
  if (!user) {
    throw new HTTPException(401, { message: 'Authentication required' });
  }

  const now = new Date();
  const cycle = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const resetAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  const db = getClient();
  const [row] = await db
    .select({ count: agentTaskUsage.count, overage: agentTaskUsage.overage })
    .from(agentTaskUsage)
    .where(and(eq(agentTaskUsage.userId, user.id), eq(agentTaskUsage.cycleStart, cycle)))
    .limit(1);

  const quota = resolveUsageQuota(c);

  return c.json(
    {
      used: row?.count ?? 0,
      quota: quota === Infinity || quota >= Number.MAX_SAFE_INTEGER ? -1 : quota,
      overage: row?.overage ?? 0,
      cycleStart: cycle.toISOString(),
      resetAt: resetAt.toISOString(),
    },
    200,
  );
});

// POST /api/billing/support-renewal-check — Internal cron: send 30-day support renewal reminders
// Called by a Vercel cron job (vercel.json crons) or an external scheduler.
// Protected by X-Cron-Secret header (REVEALUI_CRON_SECRET env var).
const SupportRenewalResponseSchema = z.object({
  reminded: z.number().openapi({ description: 'Number of reminder emails sent' }),
});

const supportRenewalRoute = createRoute({
  method: 'post',
  path: '/support-renewal-check',
  tags: ['billing'],
  summary: 'Send support renewal reminders (internal cron)',
  description:
    'Finds perpetual licenses whose support contract expires within 30 days and sends reminder emails. Protected by X-Cron-Secret.',
  responses: {
    200: {
      content: { 'application/json': { schema: SupportRenewalResponseSchema } },
      description: 'Reminders sent',
    },
    403: {
      content: { 'application/json': { schema: ErrorSchema } },
      description: 'Invalid cron secret',
    },
  },
});

app.openapi(supportRenewalRoute, async (c) => {
  const { timingSafeEqual } = await import('node:crypto');
  const cronSecret = process.env.REVEALUI_CRON_SECRET;
  const provided = c.req.header('X-Cron-Secret');

  if (!(cronSecret && provided)) {
    throw new HTTPException(403, { message: 'Forbidden' });
  }
  const a = Buffer.from(provided);
  const b = Buffer.from(cronSecret);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new HTTPException(403, { message: 'Forbidden' });
  }

  const db = getClient();
  const now = new Date();
  const in30Days = new Date(now.getTime() + SUPPORT_RENEWAL_WINDOW_MS);

  // Find active perpetual licenses with support expiring within the next 30 days.
  // Single query with JOIN eliminates N+1 user lookups.
  const expiringLicenses = await db
    .select({
      id: licenses.id,
      supportExpiresAt: licenses.supportExpiresAt,
      email: users.email,
    })
    .from(licenses)
    .innerJoin(users, eq(users.id, licenses.userId))
    .where(
      and(
        eq(licenses.perpetual, true),
        eq(licenses.status, 'active'),
        gte(licenses.supportExpiresAt, now),
        lte(licenses.supportExpiresAt, in30Days),
        isNull(licenses.deletedAt),
      ),
    );

  const { sendEmail } = await import('../lib/email.js');
  const adminBaseUrl =
    process.env.ADMIN_URL || process.env.NEXT_PUBLIC_SERVER_URL || 'https://admin.revealui.com';
  const billingUrl = `${adminBaseUrl}/account/billing`;
  let reminded = 0;

  for (const row of expiringLicenses) {
    if (!row.email) continue;

    if (!row.supportExpiresAt) continue;
    const expiryDate = row.supportExpiresAt.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });

    await sendEmail({
      to: row.email,
      subject: 'Your RevealUI support contract expires soon',
      text: `Your RevealUI annual support contract expires on ${expiryDate}. Renew at ${billingUrl}. Your perpetual license itself never expires.`,
      html: `<p>Your RevealUI support contract expires on <strong>${expiryDate}</strong>. <a href="${billingUrl}">Renew here</a>. Your perpetual license never expires.</p>`,
    }).catch((err: unknown) => {
      logger.error('Failed to send support renewal email', err instanceof Error ? err : undefined, {
        email: row.email,
      });
    });

    reminded++;
  }

  return c.json({ reminded }, 200);
});

// POST /api/billing/report-agent-overage — Internal cron: report agent task overage to Stripe Billing Meters.
// Reads the previous billing cycle's overage from agent_task_usage and emits Stripe meter events.
// Protected by X-Cron-Secret header. Defaults to "agent_task_overage" if STRIPE_AGENT_METER_EVENT_NAME is not set.
const reportOverageRoute = createRoute({
  method: 'post',
  path: '/report-agent-overage',
  tags: ['billing'],
  summary: 'Report agent task overage to Stripe (internal cron)',
  description:
    'Reads overage from the previous billing cycle and emits Stripe Billing Meter events. Protected by X-Cron-Secret.',
  responses: {
    200: {
      content: {
        'application/json': { schema: z.object({ reported: z.number(), skipped: z.number() }) },
      },
      description: 'Overage reported',
    },
    401: {
      content: { 'application/json': { schema: z.object({ error: z.string() }) } },
      description: 'Invalid cron secret',
    },
  },
});

app.openapi(reportOverageRoute, async (c) => {
  const { timingSafeEqual } = await import('node:crypto');
  const cronSecret = process.env.REVEALUI_CRON_SECRET;
  const provided = c.req.header('X-Cron-Secret');
  if (!(cronSecret && provided)) {
    throw new HTTPException(401, { message: 'Unauthorized' });
  }
  const a = Buffer.from(provided);
  const b = Buffer.from(cronSecret);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new HTTPException(401, { message: 'Unauthorized' });
  }

  const meterEventName = process.env.STRIPE_AGENT_METER_EVENT_NAME ?? 'agent_task_overage';
  if (!process.env.STRIPE_AGENT_METER_EVENT_NAME) {
    logger.warn('STRIPE_AGENT_METER_EVENT_NAME not set — using default "agent_task_overage"');
  }

  const db = getClient();
  const stripe = getStripeClient();

  // Previous billing cycle = last calendar month
  const now = new Date();
  const prevCycle = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));

  // Find all users with non-zero overage in the previous cycle, joined with stripe_customer_id
  const overageRows = await db
    .select({
      userId: agentTaskUsage.userId,
      overage: agentTaskUsage.overage,
      stripeCustomerId: users.stripeCustomerId,
    })
    .from(agentTaskUsage)
    .innerJoin(users, eq(agentTaskUsage.userId, users.id))
    .where(and(eq(agentTaskUsage.cycleStart, prevCycle), gt(agentTaskUsage.overage, 0)));

  let reported = 0;
  let skipped = 0;

  for (const row of overageRows) {
    if (!row.stripeCustomerId) {
      skipped++;
      continue;
    }

    try {
      await stripe.billing.meterEvents.create(
        {
          event_name: meterEventName,
          payload: {
            stripe_customer_id: row.stripeCustomerId,
            value: String(row.overage),
          },
          timestamp: getMeterEventTimestamp(prevCycle),
        },
        { idempotencyKey: `overage-${row.userId}-${prevCycle}` },
      );
      reported++;
    } catch (err) {
      logger.error('Stripe meter event creation failed', err instanceof Error ? err : undefined, {
        userId: row.userId,
        stripeCustomerId: row.stripeCustomerId,
        overage: row.overage,
        meterEventName,
      });
      skipped++;
    }
  }

  return c.json({ reported, skipped }, 200);
});

// POST /api/billing/sweep-expired-licenses — Internal cron: mark expired licenses as 'expired'
// Finds non-perpetual licenses where expiresAt < now() and status = 'active', updates them to
// status = 'expired'. Also finds perpetual licenses where supportExpiresAt < now() and marks
// them as 'support_expired' (license remains valid, premium features downgrade to free).
// Clears the DB status cache so changes take effect immediately.
// Protected by X-Cron-Secret. Run daily (or hourly for tighter enforcement).
const SweepExpiredLicensesResponseSchema = z.object({
  expired: z.number().openapi({ description: 'Number of licenses transitioned to expired' }),
  supportExpired: z
    .number()
    .openapi({ description: 'Number of perpetual licenses with newly expired support' }),
});

const sweepExpiredLicensesRoute = createRoute({
  method: 'post',
  path: '/sweep-expired-licenses',
  tags: ['billing'],
  summary: 'Sweep expired licenses (internal cron)',
  description:
    'Marks non-perpetual licenses whose expiresAt is in the past as expired, and perpetual licenses whose supportExpiresAt is in the past as support_expired. Clears caches so changes take effect immediately. Protected by X-Cron-Secret.',
  responses: {
    200: {
      content: { 'application/json': { schema: SweepExpiredLicensesResponseSchema } },
      description: 'Sweep complete',
    },
    403: {
      content: { 'application/json': { schema: ErrorSchema } },
      description: 'Invalid cron secret',
    },
  },
});

app.openapi(sweepExpiredLicensesRoute, async (c) => {
  const { timingSafeEqual } = await import('node:crypto');
  const cronSecret = process.env.REVEALUI_CRON_SECRET;
  const provided = c.req.header('X-Cron-Secret');

  if (!(cronSecret && provided)) {
    throw new HTTPException(403, { message: 'Forbidden' });
  }
  const a = Buffer.from(provided);
  const b = Buffer.from(cronSecret);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new HTTPException(403, { message: 'Forbidden' });
  }

  const db = getClient();
  const now = new Date();

  // ── Phase 1: Expire non-perpetual licenses with past expiresAt ──────────
  // Fetch matching IDs before updating — Neon HTTP driver does not support
  // columnar .returning() on UPDATE, so we count from a SELECT instead.
  const expiring = await db
    .select({ id: licenses.id })
    .from(licenses)
    .where(
      and(
        eq(licenses.status, 'active'),
        eq(licenses.perpetual, false),
        lt(licenses.expiresAt, now),
        isNull(licenses.deletedAt),
      ),
    );

  const expiredCount = expiring.length;

  if (expiredCount > 0) {
    await db
      .update(licenses)
      .set({ status: 'expired', updatedAt: now })
      .where(
        and(
          eq(licenses.status, 'active'),
          eq(licenses.perpetual, false),
          lt(licenses.expiresAt, now),
          isNull(licenses.deletedAt),
        ),
      );

    resetDbStatusCache();
  }

  // ── Phase 2: Mark perpetual licenses with expired support ───────────────
  // Perpetual licenses never expire, but their support contract does.
  // status = 'support_expired' signals that premium features are downgraded
  // to free tier while basic CMS access remains perpetual.
  const supportExpiring = await db
    .select({ id: licenses.id })
    .from(licenses)
    .where(
      and(
        eq(licenses.status, 'active'),
        eq(licenses.perpetual, true),
        lt(licenses.supportExpiresAt, now),
        isNull(licenses.deletedAt),
      ),
    );

  const supportExpiredCount = supportExpiring.length;

  if (supportExpiredCount > 0) {
    await db
      .update(licenses)
      .set({ status: 'support_expired', updatedAt: now })
      .where(
        and(
          eq(licenses.status, 'active'),
          eq(licenses.perpetual, true),
          lt(licenses.supportExpiresAt, now),
          isNull(licenses.deletedAt),
        ),
      );

    // Invalidate both caches so the middleware picks up the new status
    resetDbStatusCache();
    resetSupportExpiryCache();
  }

  logger.info('License expiry sweep complete', {
    expired: expiredCount,
    supportExpired: supportExpiredCount,
  });

  return c.json({ expired: expiredCount, supportExpired: supportExpiredCount }, 200);
});

// POST /api/billing/refund — Issue a refund (admin-only)
const refundRoute = createRoute({
  method: 'post',
  path: '/refund',
  tags: ['billing'],
  summary: 'Issue a refund',
  description:
    'Creates a Stripe refund for a payment intent or charge. Admin-only. Full or partial refunds supported. License revocation is handled automatically by the charge.refunded webhook.',
  request: {
    body: {
      content: {
        'application/json': { schema: RefundRequestSchema },
      },
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: RefundResponseSchema } },
      description: 'Refund created',
    },
    400: {
      content: { 'application/json': { schema: ErrorSchema } },
      description: 'Invalid request (missing payment reference)',
    },
    401: {
      content: { 'application/json': { schema: ErrorSchema } },
      description: 'Not authenticated',
    },
    403: {
      content: { 'application/json': { schema: ErrorSchema } },
      description: 'Admin access required',
    },
  },
});

app.openapi(refundRoute, async (c) => {
  const user = c.get('user');
  if (!user) {
    throw new HTTPException(401, { message: 'Authentication required' });
  }
  if (user.role !== 'admin' && user.role !== 'owner') {
    throw new HTTPException(403, { message: 'Admin access required to issue refunds' });
  }

  const { paymentIntentId, chargeId, amount, reason } = c.req.valid('json');

  if (!(paymentIntentId || chargeId)) {
    throw new HTTPException(400, {
      message: 'Either paymentIntentId or chargeId is required',
    });
  }

  // R5-H14: Idempotency key prevents duplicate refunds on network retries
  const idempotencyKey = `refund-${chargeId ?? paymentIntentId}-${user.id}`;

  const refundParams: Stripe.RefundCreateParams = {
    ...(paymentIntentId ? { payment_intent: paymentIntentId } : {}),
    ...(chargeId ? { charge: chargeId } : {}),
    ...(amount ? { amount } : {}),
    ...(reason ? { reason } : {}),
  };

  const refund = await withStripe((stripe) =>
    stripe.refunds.create(refundParams, { idempotencyKey }),
  );

  logger.info('Refund issued', {
    refundId: refund.id,
    amount: refund.amount,
    status: refund.status,
    issuedBy: user.id,
    paymentIntentId,
    chargeId,
  });

  return c.json(
    {
      refundId: refund.id,
      status: refund.status ?? 'pending',
      amount: refund.amount,
      currency: refund.currency,
    },
    200,
  );
});

// =============================================================================
// RVUI Payment — RevealCoin subscription payment with on-chain verification
// =============================================================================

const rvuiPaymentRoute = createRoute({
  method: 'post',
  path: '/rvui-payment',
  tags: ['billing'],
  summary: 'Pay for subscription with RevealCoin',
  description:
    'Verifies an on-chain RVUI payment transaction and activates the subscription tier. ' +
    'Applies the 15% RVUI discount. Requires wallet address and transaction signature.',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            txSignature: z.string().min(1, 'Transaction signature required'),
            tier: z.enum(['Pro', 'Max']),
            walletAddress: z.string().min(1, 'Wallet address required'),
            network: z.enum(['devnet', 'mainnet-beta']).default('devnet'),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Payment verified and subscription activated',
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            tier: z.string(),
            message: z.string(),
          }),
        },
      },
    },
    400: { description: 'Validation failed' },
    401: { description: 'Authentication required' },
    403: { description: 'Payment rejected by safeguards' },
  },
});

app.openapi(rvuiPaymentRoute, async (c) => {
  // DISABLED (B-01): RVUI/RevealCoin payment is disabled until real pricing is
  // implemented. The on-chain verification used a hardcoded minimum of 1 token
  // (1n), which would allow any 1-token payment to activate Pro/Max for free.
  // Re-enable once TWAP-based pricing and proper amount calculation are in place.
  // See: GAP-100, git history for the full handler implementation.
  return c.json(
    {
      success: false,
      tier: 'none',
      message: 'RVUI payment is not yet available. Please use Stripe for subscription payments.',
    },
    501,
  );
});

// ─── Admin Revenue Metrics ────────────────────────────────────────────────────

/** Fallback monthly prices (cents) for MRR estimation when catalog has no Stripe price */
const FALLBACK_TIER_PRICE_CENTS: Record<string, number> = Object.fromEntries(
  Object.entries(CANONICAL_TIER_PRICES).map(([tier, usd]) => [tier, usd * 100]),
);

const MetricsTierBreakdownSchema = z.object({
  pro: z.number().openapi({ description: 'Active pro subscriptions' }),
  max: z.number().openapi({ description: 'Active max subscriptions' }),
  enterprise: z.number().openapi({ description: 'Active enterprise subscriptions' }),
});

const MetricsRecentEventSchema = z.object({
  type: z.string().openapi({ description: 'Billing event type' }),
  tier: z.string().openapi({ description: 'Associated tier (if determinable)' }),
  createdAt: z.string().openapi({ description: 'When the event was processed (ISO 8601)' }),
});

const MetricsResponseSchema = z.object({
  activeSubscriptions: z.number().openapi({ description: 'Count of active subscriptions' }),
  totalCustomers: z.number().openapi({ description: 'Count of unique Stripe customers' }),
  mrr: z.number().openapi({ description: 'Estimated monthly recurring revenue in cents' }),
  tierBreakdown: MetricsTierBreakdownSchema,
  recentEvents: z.array(MetricsRecentEventSchema),
});

const MetricsQuerySchema = z.object({
  from: z.string().datetime().optional().openapi({
    description: 'Start of date range for recent events (ISO 8601). Defaults to 30 days ago.',
  }),
  to: z.string().datetime().optional().openapi({
    description: 'End of date range for recent events (ISO 8601). Defaults to now.',
  }),
});

const metricsRoute = createRoute({
  method: 'get',
  path: '/metrics',
  tags: ['billing'],
  summary: 'Revenue metrics (admin)',
  description:
    'Returns aggregate revenue metrics for the admin dashboard. Requires admin or owner role.',
  request: { query: MetricsQuerySchema },
  responses: {
    200: {
      content: { 'application/json': { schema: MetricsResponseSchema } },
      description: 'Revenue metrics snapshot',
    },
    401: {
      content: { 'application/json': { schema: ErrorSchema } },
      description: 'Not authenticated',
    },
    403: {
      content: { 'application/json': { schema: ErrorSchema } },
      description: 'Admin access required',
    },
  },
});

app.openapi(metricsRoute, async (c) => {
  const user = c.get('user');
  if (!user) {
    throw new HTTPException(401, { message: 'Authentication required' });
  }
  if (user.role !== 'admin' && user.role !== 'owner') {
    throw new HTTPException(403, { message: 'Admin access required to view revenue metrics' });
  }

  // Parse and validate date range for recent events
  const { from: fromParam, to: toParam } = c.req.valid('query');
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const maxRangeMs = 365 * 24 * 60 * 60 * 1000;

  const fromDate = fromParam ? new Date(fromParam) : thirtyDaysAgo;
  const toDate = toParam ? new Date(toParam) : now;

  if (Number.isNaN(fromDate.getTime())) {
    throw new HTTPException(400, { message: 'Invalid "from" date format.' });
  }
  if (Number.isNaN(toDate.getTime())) {
    throw new HTTPException(400, { message: 'Invalid "to" date format.' });
  }
  if (fromDate >= toDate) {
    throw new HTTPException(400, { message: '"from" must be before "to".' });
  }
  if (fromDate > now || toDate > now) {
    throw new HTTPException(400, { message: 'Date range must not extend into the future.' });
  }
  if (toDate.getTime() - fromDate.getTime() > maxRangeMs) {
    throw new HTTPException(400, { message: 'Date range must not exceed 365 days.' });
  }

  const db = getClient();

  // 1. Count active subscriptions and unique customers
  const [subStats] = await db
    .select({
      activeCount: count(),
      uniqueCustomers: countDistinct(accountSubscriptions.stripeCustomerId),
    })
    .from(accountSubscriptions)
    .where(eq(accountSubscriptions.status, 'active'));

  const activeSubscriptions = subStats?.activeCount ?? 0;
  const totalCustomers = subStats?.uniqueCustomers ?? 0;

  // 2. Tier breakdown from entitlements (active subscriptions only)
  const tierRows = await db
    .select({
      tier: accountEntitlements.tier,
      tierCount: count(),
    })
    .from(accountEntitlements)
    .where(eq(accountEntitlements.status, 'active'))
    .groupBy(accountEntitlements.tier);

  const tierBreakdown = { pro: 0, max: 0, enterprise: 0 };
  for (const row of tierRows) {
    if (row.tier === 'pro' || row.tier === 'max' || row.tier === 'enterprise') {
      tierBreakdown[row.tier] = row.tierCount;
    }
  }

  // 3. Estimate MRR from catalog prices or fallback constants
  const catalogRows = await db
    .select({
      tier: billingCatalog.tier,
      metadata: billingCatalog.metadata,
    })
    .from(billingCatalog)
    .where(and(eq(billingCatalog.billingModel, 'subscription'), eq(billingCatalog.active, true)));

  const catalogPriceCents: Record<string, number> = {};
  for (const entry of catalogRows) {
    const amount =
      typeof entry.metadata === 'object' &&
      entry.metadata !== null &&
      'unitAmountCents' in entry.metadata
        ? Number(entry.metadata.unitAmountCents)
        : undefined;
    if (typeof amount === 'number' && amount > 0) {
      catalogPriceCents[entry.tier] = amount;
    }
  }

  let mrr = 0;
  for (const tier of ['pro', 'max', 'enterprise'] as const) {
    const priceCents = catalogPriceCents[tier] ?? FALLBACK_TIER_PRICE_CENTS[tier] ?? 0;
    mrr += tierBreakdown[tier] * priceCents;
  }

  // 4. Recent billing events from the processed webhook events table
  const billingEventTypes = [
    'checkout.session.completed',
    'customer.subscription.created',
    'customer.subscription.deleted',
    'customer.subscription.updated',
    'invoice.payment_succeeded',
    'invoice.payment_failed',
  ];

  const recentRows = await db
    .select({
      eventType: processedWebhookEvents.eventType,
      processedAt: processedWebhookEvents.processedAt,
    })
    .from(processedWebhookEvents)
    .where(
      and(
        sql`${processedWebhookEvents.eventType} IN (${sql.join(
          billingEventTypes.map((t) => sql`${t}`),
          sql`, `,
        )})`,
        gte(processedWebhookEvents.processedAt, fromDate),
        lte(processedWebhookEvents.processedAt, toDate),
      ),
    )
    .orderBy(desc(processedWebhookEvents.processedAt))
    .limit(50);

  const eventTypeMap: Record<string, string> = {
    'checkout.session.completed': 'subscription_created',
    'customer.subscription.created': 'subscription_created',
    'customer.subscription.deleted': 'subscription_cancelled',
    'customer.subscription.updated': 'subscription_updated',
    'invoice.payment_succeeded': 'payment_succeeded',
    'invoice.payment_failed': 'payment_failed',
  };

  const recentEvents = recentRows.map((row) => ({
    type: eventTypeMap[row.eventType] ?? row.eventType,
    tier: 'unknown',
    createdAt: row.processedAt.toISOString(),
  }));

  return c.json(
    {
      activeSubscriptions,
      totalCustomers,
      mrr,
      tierBreakdown,
      recentEvents,
    },
    200,
  );
});

export default app;

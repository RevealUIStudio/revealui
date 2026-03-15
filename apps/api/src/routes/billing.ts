/**
 * Billing Routes — Stripe checkout, portal, and subscription status
 *
 * Uses RevealUI session auth (not Supabase). Bridges the NeonDB users table
 * with Stripe customer records via the `stripe_customer_id` column.
 */

import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { CircuitBreaker, CircuitBreakerOpenError } from '@revealui/core/error-handling';
import { getMaxAgentTasks } from '@revealui/core/license';
import { logger } from '@revealui/core/observability/logger';
import { getClient } from '@revealui/db';
import {
  accountEntitlements,
  accountMemberships,
  accountSubscriptions,
  agentTaskUsage,
  billingCatalog,
  licenses,
  users,
} from '@revealui/db/schema';
import { and, desc, eq, gt } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import Stripe from 'stripe';

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
  // biome-ignore lint/style/useNamingConvention: Hono requires PascalCase `Variables` in its generic type parameter
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

function getStripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new HTTPException(500, { message: 'Stripe is not configured' });
  }
  return new Stripe(key, { maxNetworkRetries: 2 });
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
});

const ErrorSchema = z.object({
  error: z.string(),
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

  // Create Stripe customer, then persist the ID in a transaction so we don't
  // end up with a dangling Stripe customer if the DB write fails.
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

  await db.transaction(async (tx) => {
    // Re-check inside the transaction to handle concurrent requests
    const [existing] = await tx
      .select({ stripeCustomerId: users.stripeCustomerId })
      .from(users)
      .where(eq(users.id, userId));

    if (existing?.stripeCustomerId) {
      return;
    }

    await tx
      .update(users)
      .set({ stripeCustomerId: customer.id, updatedAt: new Date() })
      .where(eq(users.id, userId));
  });

  // Re-read to handle race: if another request won, return their customer ID
  const [updated] = await db
    .select({ stripeCustomerId: users.stripeCustomerId })
    .from(users)
    .where(eq(users.id, userId));

  return updated?.stripeCustomerId ?? customer.id;
}

type PaidTier = 'pro' | 'max' | 'enterprise';
type BillingCatalogKind = 'subscription' | 'perpetual';

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

  if (requestedPriceId && requestedPriceId !== resolvedPriceId) {
    throw new HTTPException(400, {
      message: 'Requested price does not match the server billing catalog.',
    });
  }

  return resolvedPriceId;
}

async function getHostedSubscriptionSnapshot(userId: string): Promise<{
  tier: 'free' | 'pro' | 'max' | 'enterprise';
  status: string;
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
    })
    .from(accountEntitlements)
    .where(eq(accountEntitlements.accountId, membership.accountId))
    .limit(1);

  if (!entitlement?.tier) return null;

  return {
    tier: entitlement.tier as 'free' | 'pro' | 'max' | 'enterprise',
    status: entitlement.status,
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

// Exported for testing
export { getEarlyAdopterConfig, getEarlyAdopterDiscount };
export type { EarlyAdopterConfig };

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
  const customerId = await ensureStripeCustomer(user.id, user.email ?? '');

  const cmsUrl = process.env.CMS_URL || process.env.NEXT_PUBLIC_SERVER_URL;
  if (!cmsUrl) throw new HTTPException(500, { message: 'CMS_URL is not configured' });

  const discountConfig = getEarlyAdopterDiscount(resolvedTier);

  const session = await withStripe((stripe) =>
    stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      billing_address_collection: 'required',
      ...discountConfig,
      line_items: [{ price: resolvedPriceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: 7,
        metadata: { tier: resolvedTier, revealui_user_id: user.id },
      },
      success_url: `${cmsUrl}/account/billing?success=true`,
      cancel_url: `${cmsUrl}/account/billing`,
    }),
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
  const cmsUrl = process.env.CMS_URL || process.env.NEXT_PUBLIC_SERVER_URL;
  if (!cmsUrl) throw new HTTPException(500, { message: 'CMS_URL is not configured' });

  const session = await withStripe((stripe) =>
    stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${cmsUrl}/account/billing`,
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
    })
    .from(licenses)
    .where(eq(licenses.userId, user.id))
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

  // Swap the price and set tier metadata so the webhook can detect the upgrade
  await withStripe((stripe) =>
    stripe.subscriptions.update(subscription.id, {
      items: [{ id: item.id, price: resolvedPriceId }],
      metadata: { tier: targetTier, revealui_user_id: user.id },
      proration_behavior: 'create_prorations',
    }),
  );

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

  // Cancel at period end so the customer retains access until their billing cycle ends
  const updated = await withStripe((stripe) =>
    stripe.subscriptions.update(subscription.id, {
      cancel_at_period_end: true,
    }),
  );

  // cancel_at is populated by Stripe when cancel_at_period_end is set
  const cancelAt = updated.cancel_at;
  const effectiveDate = cancelAt
    ? new Date(cancelAt * 1000).toISOString()
    : new Date().toISOString();

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

  const { priceId, tier, githubUsername } = c.req.valid('json');
  const resolvedPriceId = await resolveCatalogPriceId(tier, 'perpetual', priceId);
  const customerId = await ensureStripeCustomer(user.id, user.email ?? '');

  const cmsUrl = process.env.CMS_URL || process.env.NEXT_PUBLIC_SERVER_URL;
  if (!cmsUrl) throw new HTTPException(500, { message: 'CMS_URL is not configured' });

  const session = await withStripe((stripe) =>
    stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'payment',
      payment_method_types: ['card'],
      billing_address_collection: 'required',
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
      success_url: `${cmsUrl}/account/billing?perpetual=true`,
      cancel_url: `${cmsUrl}/account/billing`,
    }),
  );

  if (!session.url) {
    throw new HTTPException(500, { message: 'Failed to create checkout session' });
  }

  return c.json({ url: session.url }, 200);
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
      quota: quota === Infinity ? -1 : quota,
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
    return c.json({ error: 'Forbidden' }, 403);
  }
  const a = Buffer.from(provided);
  const b = Buffer.from(cronSecret);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const db = getClient();
  const now = new Date();
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  // Find active perpetual licenses with support expiring within the next 30 days
  const expiringLicenses = await db
    .select({
      id: licenses.id,
      userId: licenses.userId,
      supportExpiresAt: licenses.supportExpiresAt,
    })
    .from(licenses)
    .where(and(eq(licenses.perpetual, true), eq(licenses.status, 'active')));

  const { sendEmail } = await import('../lib/email.js');
  let reminded = 0;

  for (const row of expiringLicenses) {
    if (!row.supportExpiresAt) continue;
    if (row.supportExpiresAt > in30Days || row.supportExpiresAt < now) continue;

    const [user] = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, row.userId))
      .limit(1);

    if (!user?.email) continue;

    const expiryDate = row.supportExpiresAt.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });

    await sendEmail({
      to: user.email,
      subject: 'Your RevealUI support contract expires soon',
      text: `Your RevealUI annual support contract expires on ${expiryDate}. Renew at https://revealui.com/pricing. Your perpetual license itself never expires.`,
      html: `<p>Your RevealUI support contract expires on <strong>${expiryDate}</strong>. <a href="https://revealui.com/pricing">Renew here</a>. Your perpetual license never expires.</p>`,
    }).catch((err: unknown) => {
      logger.warn('Support renewal email failed (best-effort)', {
        error: err instanceof Error ? err.message : String(err),
      });
    });

    reminded++;
  }

  return c.json({ reminded }, 200);
});

// POST /api/billing/report-agent-overage — Internal cron: report agent task overage to Stripe Billing Meters.
// Reads the previous billing cycle's overage from agent_task_usage and emits Stripe meter events.
// Protected by X-Cron-Secret header. Skips silently if STRIPE_AGENT_METER_EVENT_NAME is not set.
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
    return c.json({ error: 'Unauthorized' }, 401);
  }
  const a = Buffer.from(provided);
  const b = Buffer.from(cronSecret);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const meterEventName = process.env.STRIPE_AGENT_METER_EVENT_NAME;
  if (!meterEventName) {
    // Not configured yet — skip silently (owner action required to create Stripe Billing Meter)
    return c.json({ reported: 0, skipped: 0 }, 200);
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
      await stripe.billing.meterEvents.create({
        event_name: meterEventName,
        payload: {
          stripe_customer_id: row.stripeCustomerId,
          value: String(row.overage),
        },
        timestamp: Math.floor(prevCycle.getTime() / 1000 + 30 * 24 * 60 * 60 - 1),
      });
      reported++;
    } catch {
      skipped++;
    }
  }

  return c.json({ reported, skipped }, 200);
});

export default app;

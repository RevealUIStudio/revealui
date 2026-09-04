/**
 * Billing Routes  -  Stripe checkout, portal, and subscription status
 *
 * Uses RevealUI session auth (not Supabase). Bridges the NeonDB users table
 * with Stripe customer records via the `stripe_customer_id` column.
 */

import { getConfiguredStripeMode } from '@revealui/config/stripe-mode';
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
  usageMeters,
  users,
} from '@revealui/db/schema';
import { createRoute, OpenAPIHono, z } from '@revealui/openapi';
import {
  and,
  count,
  countDistinct,
  desc,
  eq,
  gt,
  gte,
  isNull,
  lt,
  lte,
  ne,
  sql,
} from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import type Stripe from 'stripe';
import { hasApiRole } from '../../lib/api-roles.js';
import { getServices } from '../../lib/services-loader.js';
import { getHostedLimitsForTier } from '../../lib/tier-limits.js';
import { MRR_TIER_PRICE_FALLBACK_CENTS } from '../../lib/tier-pricing.js';
import {
  sendDowngradeConfirmationEmail,
  sendUpgradeConfirmationEmail,
} from '../../lib/webhook-emails.js';
import { utcIsoWeekBounds, weeklyUsagePercent } from '../../lib/weekly-agent-usage.js';
import { assertAccountOwner } from '../../middleware/account-owner.js';
import { resetDbStatusCache, resetSupportExpiryCache } from '../../middleware/license.js';

/** Default trial period for new subscriptions (overridable via env) */

import {
  assertLiveCatalogComplete,
  assertUnattendedCheckoutAllowed,
  assertUnattendedPerpetualCheckoutAllowed,
  type BillingEnv,
  billingPortalConfigId,
  CheckoutRequestSchema,
  CheckoutResponseSchema,
  ErrorSchema,
  ensureStripeCustomer,
  getAllCatalogSubscriptionPriceIds,
  getEarlyAdopterDiscount,
  getHostedSubscriptionSnapshot,
  getMeterEventTimestamp,
  getStripeSubscriptionFallback,
  InvoicesResponseSchema,
  isStripeTaxEnabled,
  PortalResponseSchema,
  RefundRequestSchema,
  RefundResponseSchema,
  type RequestEntitlements,
  resolveCatalogPriceId,
  resolveHostedStripeCustomerId,
  resolveUsageQuota,
  SUPPORT_RENEWAL_WINDOW_MS,
  SubscriptionResponseSchema,
  stripePriceIsUsable,
  TRIAL_PERIOD_DAYS,
  UpgradeRequestSchema,
  UpgradeResponseSchema,
  withStripe,
} from './helpers.js';

const app = new OpenAPIHono<BillingEnv>();
// ─── Routes ──────────────────────────────────────────────────────────────────

// POST /api/billing/checkout  -  Create a Stripe checkout session
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
  assertAccountOwner(c);

  // A2: fail fast with a precise, named error if the LIVE catalog is incomplete,
  // rather than 500ing deep inside the Stripe price lookup on the first real
  // checkout (Vercel cold starts skip the boot-time validator). Cached per cold
  // instance; no-op in test mode.
  await assertLiveCatalogComplete();

  const { priceId, tier, interval } = c.req.valid('json');
  const resolvedTier = tier ?? 'pro';
  assertUnattendedCheckoutAllowed(resolvedTier);
  const resolvedInterval = interval ?? 'month';
  const resolvedPriceId = await resolveCatalogPriceId(
    resolvedTier,
    'subscription',
    priceId,
    resolvedInterval,
  );

  if (!user.email) {
    throw new HTTPException(400, { message: 'An email address is required for billing' });
  }
  const customerId = await ensureStripeCustomer(user.id, user.email);

  // Prevent duplicate subscriptions  -  a user with an active, trialing, or incomplete subscription
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

  const meterPriceId = process.env.STRIPE_AGENT_OVERAGE_PRICE_ID;
  let includeMeter = Boolean(meterPriceId) && (resolvedTier === 'pro' || resolvedTier === 'max');
  // Resilience: only attach the metered overage item if its price actually
  // exists + is active in the current Stripe mode. A misconfigured/cross-mode
  // STRIPE_AGENT_OVERAGE_PRICE_ID (e.g. a live price while the deployment runs
  // test keys) would otherwise fail the WHOLE checkout with "No such price"
  // ("Invalid billing request"). The overage add-on must never block the core
  // subscription — skip it and warn instead.
  if (
    includeMeter &&
    meterPriceId &&
    !(await withStripe((s) => stripePriceIsUsable(s, meterPriceId)))
  ) {
    logger.warn(
      'checkout: agent-overage meter price not usable in current Stripe mode — omitting meter line item',
      { meterPriceId, tier: resolvedTier },
    );
    includeMeter = false;
  }

  // 10-minute idempotency window: prevents duplicate checkout sessions from
  // double-clicks or network retries while allowing a fresh attempt after 10 min.
  const idempotencyWindow = Math.floor(Date.now() / (10 * 60 * 1000));
  const session = await withStripe((stripe) =>
    stripe.checkout.sessions.create(
      {
        customer: customerId,
        mode: 'subscription',
        // Top-level session metadata is REQUIRED: the webhook reads
        // resolveTier(session.metadata), and Stripe does NOT copy
        // subscription_data.metadata onto the Checkout Session. Without this,
        // checkout.session.completed throws in resolveTier -> 500 -> the paid
        // customer never gets a license. Keep in lockstep with the
        // subscription_data.metadata below.
        metadata: { tier: resolvedTier, revealui_user_id: user.id },
        payment_method_types: ['card'],
        billing_address_collection: 'required',
        tax_id_collection: { enabled: true },
        // Required by Stripe when tax_id_collection is enabled AND an existing
        // `customer` is supplied: it lets Checkout persist the collected tax ID,
        // business name, and billing address back onto the customer. Without it
        // Stripe rejects the session with a StripeInvalidRequestError ("Tax ID
        // collection requires updating business name on the customer…"), which
        // surfaced to users as the generic "Invalid billing request".
        customer_update: { name: 'auto', address: 'auto' },
        automatic_tax: { enabled: isStripeTaxEnabled },
        ...discountConfig,
        line_items: [
          { price: resolvedPriceId, quantity: 1 },
          ...(includeMeter ? [{ price: meterPriceId }] : []),
        ],
        subscription_data: {
          trial_period_days: TRIAL_PERIOD_DAYS,
          metadata: { tier: resolvedTier, revealui_user_id: user.id },
        },
        // First-time subscribers land on /welcome (3 concrete first actions:
        // install CLI / clone source / read quick-start). Existing customers
        // upgrading also see it — the page reads "Welcome" only when
        // ?success=true, which Stripe appends here. See
        // apps/admin/src/app/(backend)/welcome/page.tsx. Perpetual + renewal +
        // credits success_urls (further down this file) intentionally stay on
        // /account/billing — those flows are for known returning customers
        // buying additional things, not first-action onboarding.
        success_url: `${adminUrl}/welcome?success=true&tier=${resolvedTier}`,
        cancel_url: `${adminUrl}/account/billing`,
      },
      {
        idempotencyKey: `checkout-sub-${user.id}-${resolvedTier}-${resolvedInterval}-${idempotencyWindow}`,
      },
    ),
  );

  if (!session.url) {
    throw new HTTPException(500, { message: 'Failed to create checkout session' });
  }

  return c.json({ url: session.url }, 200);
});

// POST /api/billing/portal  -  Create a Stripe billing portal session
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
  assertAccountOwner(c);

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
      ...(billingPortalConfigId && { configuration: billingPortalConfigId }),
    }),
  );

  return c.json({ url: session.url }, 200);
});

// GET /api/billing/subscription  -  Get current user's subscription/license status
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

/**
 * The user's most-recent active (non-deleted) license JWT, or null (A9).
 *
 * Surfaced on the hosted entitlement + snapshot short-circuit paths below so a
 * paying customer can always retrieve the key they need to activate a
 * self-hosted framework deploy AND the RevDev daemon — one Ed25519-signed JWT
 * that both accept. Previously those paths returned licenseKey:null even after
 * the checkout webhook had issued and stored a license (the webhook's
 * syncHostedSubscriptionState creates the hosted rows that trigger the
 * short-circuit), so a hosted subscriber could never see their key.
 * Trial end is the same license row (`expiresAt` from Stripe `trial_end`).
 *
 * GAP-300 pro-license-wire (durable): when a non-null JWT is returned to the
 * authenticated user, record first-ever `license_key_fetched` on the account.
 * Server-side only — client-reported events are not trusted for this milestone.
 */
interface UserLicenseSnapshot {
  licenseKey: string | null;
  expiresAt: string | null;
}

function serializeExpiresAt(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return value;
}

/**
 * Hosted entitlement / snapshot short-circuits used to return `expiresAt: null`
 * even when the license row already stored Stripe `trial_end`. Trial UI (billing
 * + account) reads this field; a null here hid the real expiry for Pro and Max.
 */
async function getUserLicenseSnapshot(
  userId: string,
  accountId?: string | null,
): Promise<UserLicenseSnapshot> {
  const [row] = await getClient()
    .select({ licenseKey: licenses.licenseKey, expiresAt: licenses.expiresAt })
    .from(licenses)
    .where(
      and(
        eq(licenses.userId, userId),
        isNull(licenses.deletedAt),
        eq(licenses.mode, getConfiguredStripeMode()),
      ),
    )
    .orderBy(desc(licenses.createdAt))
    .limit(1);
  const licenseKey = row?.licenseKey ?? null;
  const expiresAt = serializeExpiresAt(row?.expiresAt);
  if (!licenseKey) return { licenseKey: null, expiresAt };

  const { recordMilestoneMeterFirstSafe, LICENSE_KEY_FETCHED_METER_NAME } = await import(
    '../../lib/nudges/milestone-meters.js'
  );
  let resolvedAccountId = accountId ?? null;
  if (!resolvedAccountId) {
    const [membership] = await getClient()
      .select({ accountId: accountMemberships.accountId })
      .from(accountMemberships)
      .where(and(eq(accountMemberships.userId, userId), eq(accountMemberships.status, 'active')))
      .limit(1);
    resolvedAccountId = membership?.accountId ?? null;
  }
  recordMilestoneMeterFirstSafe(resolvedAccountId, LICENSE_KEY_FETCHED_METER_NAME, {
    userId,
    path: 'billing/subscription',
  });
  return { licenseKey, expiresAt };
}

app.openapi(subscriptionRoute, async (c) => {
  const user = c.get('user');
  if (!user) {
    throw new HTTPException(401, { message: 'Authentication required' });
  }

  const requestEntitlements = c.get('entitlements') as RequestEntitlements | undefined;
  if (requestEntitlements?.accountId && requestEntitlements.tier) {
    const snapshot = await getUserLicenseSnapshot(user.id, requestEntitlements.accountId);
    return c.json(
      {
        tier: requestEntitlements.tier,
        status: requestEntitlements.subscriptionStatus ?? 'active',
        expiresAt: snapshot.expiresAt,
        licenseKey: snapshot.licenseKey,
      },
      200,
    );
  }

  const hostedSubscription = await getHostedSubscriptionSnapshot(user.id);
  if (hostedSubscription) {
    const snapshot = await getUserLicenseSnapshot(user.id, requestEntitlements?.accountId);
    const trialingFallback =
      hostedSubscription.status === 'trialing' ? hostedSubscription.graceUntil : null;
    return c.json(
      {
        tier: hostedSubscription.tier,
        status: hostedSubscription.status,
        expiresAt: snapshot.expiresAt ?? trialingFallback,
        licenseKey: snapshot.licenseKey,
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
    .where(
      and(
        eq(licenses.userId, user.id),
        isNull(licenses.deletedAt),
        eq(licenses.mode, getConfiguredStripeMode()),
      ),
    )
    .orderBy(desc(licenses.createdAt))
    .limit(1);

  if (!license) {
    // No local license row — but a Stripe subscription may already exist (a
    // trial whose webhook hasn't landed or failed). Reconcile against Stripe so
    // the UI doesn't show a misleading "free" + dead-end Upgrade button. Only
    // users with an existing Stripe customer incur the lookup.
    const stripeSnapshot = await getStripeSubscriptionFallback(
      user.id,
      requestEntitlements?.accountId,
    );
    if (stripeSnapshot) {
      return c.json(stripeSnapshot, 200);
    }
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

  // Durable fetch meter via the same helper path as entitlement short-circuits.
  const licenseKey = license.licenseKey
    ? (await getUserLicenseSnapshot(user.id, requestEntitlements?.accountId)).licenseKey
    : null;

  return c.json(
    {
      tier: license.tier as 'free' | 'pro' | 'max' | 'enterprise',
      status: license.status,
      expiresAt: license.expiresAt?.toISOString() ?? null,
      licenseKey: licenseKey ?? license.licenseKey,
      perpetual: license.perpetual ?? false,
      supportExpiresAt: license.supportExpiresAt?.toISOString() ?? null,
    },
    200,
  );
});

// GET /api/billing/invoices  -  List invoices for the current user
const invoicesRoute = createRoute({
  method: 'get',
  path: '/invoices',
  tags: ['billing'],
  summary: 'List invoices',
  description:
    "Returns the current user's Stripe invoices with amounts, status, and PDF download links.",
  request: {
    query: z.object({
      limit: z
        .string()
        .optional()
        .openapi({ description: 'Max invoices to return (1-100, default 10)', example: '10' }),
      starting_after: z
        .string()
        .optional()
        .openapi({ description: 'Cursor for pagination (Stripe invoice ID)', example: 'in_abc' }),
    }),
  },
  responses: {
    200: {
      content: { 'application/json': { schema: InvoicesResponseSchema } },
      description: 'List of invoices',
    },
    401: {
      content: { 'application/json': { schema: ErrorSchema } },
      description: 'Not authenticated',
    },
  },
});

app.openapi(invoicesRoute, async (c) => {
  const user = c.get('user');
  if (!user) {
    throw new HTTPException(401, { message: 'Authentication required' });
  }

  const db = getClient();
  const [dbUser] = await db
    .select({ stripeCustomerId: users.stripeCustomerId })
    .from(users)
    .where(eq(users.id, user.id));

  if (!dbUser?.stripeCustomerId) {
    return c.json({ invoices: [], hasMore: false }, 200);
  }

  const query = c.req.query();
  const limit = Math.min(Math.max(Number.parseInt(query.limit ?? '10', 10) || 10, 1), 100);

  // Non-null here: guarded by the early return above. Bind to a const so the
  // narrowing survives into the withStripe closure.
  const stripeCustomerId = dbUser.stripeCustomerId;
  const stripeInvoices = await withStripe((stripe) =>
    stripe.invoices.list({
      customer: stripeCustomerId,
      limit,
      ...(query.starting_after ? { starting_after: query.starting_after } : {}),
    }),
  );

  const invoices = stripeInvoices.data.map((inv) => ({
    id: inv.id,
    number: inv.number ?? null,
    status: inv.status ?? 'unknown',
    amountDue: inv.amount_due,
    amountPaid: inv.amount_paid,
    currency: inv.currency,
    created: new Date(inv.created * 1000).toISOString(),
    periodStart: new Date(inv.period_start * 1000).toISOString(),
    periodEnd: new Date(inv.period_end * 1000).toISOString(),
    pdfUrl: inv.invoice_pdf ?? null,
    hostedUrl: inv.hosted_invoice_url ?? null,
  }));

  return c.json({ invoices, hasMore: stripeInvoices.has_more }, 200);
});

/** Tier rank ordering for upgrade/downgrade direction validation */
const TIER_ORDER: Record<string, number> = { free: 0, pro: 1, max: 2, enterprise: 3 };

// POST /api/billing/upgrade  -  Upgrade an active subscription to a higher tier
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
      description: 'Subscription upgraded  -  Stripe will fire customer.subscription.updated',
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
  assertAccountOwner(c);

  const { priceId, targetTier } = c.req.valid('json');
  assertUnattendedCheckoutAllowed(targetTier);
  const resolvedPriceId = await resolveCatalogPriceId(targetTier, 'subscription', priceId);
  const requestEntitlements = c.get('entitlements') as RequestEntitlements | undefined;

  // Validate upgrade direction  -  reject downgrades via upgrade route
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

  // Find the user's current subscription eligible to upgrade.
  //
  // Stripe's `subscriptions.list({ status })` accepts one status (or 'all'),
  // not a union. We need `active` AND `trialing` — trial customers need to
  // be able to upgrade to a paid tier before the trial ends. Filtering with
  // `status: 'active'` alone made this impossible; the error "No active
  // subscription found" was the symptom. Fetch with `status: 'all'` and
  // filter client-side.
  const subscriptionList = await withStripe((stripe) =>
    stripe.subscriptions.list({
      customer: stripeCustomerId,
      status: 'all',
      limit: 10,
    }),
  );

  const subscription = subscriptionList.data.find(
    (s) => s.status === 'active' || s.status === 'trialing',
  );
  if (!subscription) {
    throw new HTTPException(400, {
      message: 'No active or trialing subscription found to upgrade.',
    });
  }

  // A.1 fix: resolve items by price ID, not by index. Index [0] is not
  // guaranteed stable across SDK versions or after portal-side modifications.
  const catalogFlatPriceIds = await getAllCatalogSubscriptionPriceIds();
  const flatItem = subscription.items.data.find((i) => catalogFlatPriceIds.has(i.price.id));
  const meterPriceId = process.env.STRIPE_AGENT_OVERAGE_PRICE_ID ?? null;
  const meterItem = meterPriceId
    ? subscription.items.data.find((i) => i.price.id === meterPriceId)
    : undefined;

  if (!flatItem) {
    throw new HTTPException(400, { message: 'Subscription has no recognized flat-tier item.' });
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

  // Build the desired item set explicitly:
  //   - always swap the flat-tier price
  //   - remove the meter item when upgrading to Enterprise (no overage on Enterprise)
  //   - add the meter item if upgrading to Pro/Max and it isn't already present
  //   - leave the meter item unchanged when switching between Pro and Max (same SKU)
  let includeMeter = Boolean(meterPriceId) && (targetTier === 'pro' || targetTier === 'max');
  // Same resilience as checkout: a missing/cross-mode overage price must not
  // fail the upgrade. Skip the meter item + warn if its price isn't usable.
  if (
    includeMeter &&
    meterPriceId &&
    !(await withStripe((s) => stripePriceIsUsable(s, meterPriceId)))
  ) {
    logger.warn(
      'upgrade: agent-overage meter price not usable in current Stripe mode — omitting meter line item',
      { meterPriceId, targetTier },
    );
    includeMeter = false;
  }
  const upgradeItems: Stripe.SubscriptionUpdateParams.Item[] = [
    { id: flatItem.id, price: resolvedPriceId },
  ];
  if (meterItem && !includeMeter) {
    upgradeItems.push({ id: meterItem.id, deleted: true });
  } else if (!meterItem && includeMeter && meterPriceId) {
    upgradeItems.push({ price: meterPriceId });
  }

  // Swap the price and set tier metadata so the webhook can detect the upgrade.
  // Idempotency key prevents duplicate mutations from concurrent requests (M-13).
  await withStripe((stripe) =>
    stripe.subscriptions.update(
      subscription.id,
      {
        items: upgradeItems,
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

// POST /api/billing/downgrade  -  Downgrade to free tier (cancel subscription)
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
  assertAccountOwner(c);

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

  // See upgrade route for why we don't use Stripe's `status` filter directly.
  // Trial users must also be able to cancel before the trial ends.
  const subscriptionList = await withStripe((stripe) =>
    stripe.subscriptions.list({
      customer: stripeCustomerId,
      status: 'all',
      limit: 10,
    }),
  );

  const subscription = subscriptionList.data.find(
    (s) => s.status === 'active' || s.status === 'trialing',
  );
  if (!subscription) {
    throw new HTTPException(400, {
      message: 'No active or trialing subscription found to downgrade.',
    });
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
  // transition the status  -  without this, the DB record stays 'active' indefinitely
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

// POST /api/billing/pause  -  Pause an active subscription
const PauseResponseSchema = z.object({
  success: z.boolean(),
  resumesAt: z.string().nullable().openapi({ description: 'When billing resumes (ISO 8601)' }),
});

const pauseRoute = createRoute({
  method: 'post',
  path: '/pause',
  tags: ['billing'],
  summary: 'Pause subscription',
  description:
    'Pauses billing for the current subscription. Access is retained during the pause period.',
  responses: {
    200: {
      content: { 'application/json': { schema: PauseResponseSchema } },
      description: 'Subscription paused',
    },
    401: {
      content: { 'application/json': { schema: ErrorSchema } },
      description: 'Not authenticated',
    },
  },
});

app.openapi(pauseRoute, async (c) => {
  const user = c.get('user');
  if (!user) {
    throw new HTTPException(401, { message: 'Authentication required' });
  }
  assertAccountOwner(c);

  // Read-only resolution: pause/resume require an existing active subscription,
  // so there is never a reason to create a Stripe customer here (the create-
  // capable ensureStripeCustomer with an empty-email fallback could mint a
  // customer for someone who never checked out). Mirror upgrade/downgrade/portal.
  const requestEntitlements = c.get('entitlements') as RequestEntitlements | undefined;
  const stripeCustomerId = await resolveHostedStripeCustomerId(
    user.id,
    requestEntitlements?.accountId,
  );
  if (!stripeCustomerId) {
    throw new HTTPException(400, { message: 'No active subscription found.' });
  }

  const subscriptionList = await withStripe((stripe) =>
    stripe.subscriptions.list({ customer: stripeCustomerId, status: 'active', limit: 1 }),
  );

  const subscription = subscriptionList.data[0];
  if (!subscription) {
    throw new HTTPException(400, { message: 'No active subscription found to pause.' });
  }

  if (subscription.pause_collection) {
    throw new HTTPException(400, { message: 'Subscription is already paused.' });
  }

  const updated = await withStripe((stripe) =>
    stripe.subscriptions.update(
      subscription.id,
      { pause_collection: { behavior: 'keep_as_draft' } },
      { idempotencyKey: `pause-${subscription.id}-${user.id}-${Math.floor(Date.now() / 60_000)}` },
    ),
  );

  const resumesAt = updated.pause_collection?.resumes_at
    ? new Date(updated.pause_collection.resumes_at * 1000).toISOString()
    : null;

  return c.json({ success: true, resumesAt }, 200);
});

// POST /api/billing/resume  -  Resume a paused subscription
const ResumeResponseSchema = z.object({
  success: z.boolean(),
});

const resumeRoute = createRoute({
  method: 'post',
  path: '/resume',
  tags: ['billing'],
  summary: 'Resume subscription',
  description: 'Resumes billing for a paused subscription.',
  responses: {
    200: {
      content: { 'application/json': { schema: ResumeResponseSchema } },
      description: 'Subscription resumed',
    },
    401: {
      content: { 'application/json': { schema: ErrorSchema } },
      description: 'Not authenticated',
    },
  },
});

app.openapi(resumeRoute, async (c) => {
  const user = c.get('user');
  if (!user) {
    throw new HTTPException(401, { message: 'Authentication required' });
  }
  assertAccountOwner(c);

  // Read-only resolution: pause/resume require an existing active subscription,
  // so there is never a reason to create a Stripe customer here (the create-
  // capable ensureStripeCustomer with an empty-email fallback could mint a
  // customer for someone who never checked out). Mirror upgrade/downgrade/portal.
  const requestEntitlements = c.get('entitlements') as RequestEntitlements | undefined;
  const stripeCustomerId = await resolveHostedStripeCustomerId(
    user.id,
    requestEntitlements?.accountId,
  );
  if (!stripeCustomerId) {
    throw new HTTPException(400, { message: 'No active subscription found.' });
  }

  const subscriptionList = await withStripe((stripe) =>
    stripe.subscriptions.list({ customer: stripeCustomerId, status: 'active', limit: 1 }),
  );

  const subscription = subscriptionList.data[0];
  if (!subscription) {
    throw new HTTPException(400, { message: 'No active subscription found to resume.' });
  }

  if (!subscription.pause_collection) {
    throw new HTTPException(400, { message: 'Subscription is not paused.' });
  }

  await withStripe((stripe) =>
    stripe.subscriptions.update(
      subscription.id,
      { pause_collection: '' as unknown as Stripe.SubscriptionUpdateParams.PauseCollection },
      { idempotencyKey: `resume-${subscription.id}-${user.id}-${Math.floor(Date.now() / 60_000)}` },
    ),
  );

  return c.json({ success: true }, 200);
});

// POST /api/billing/checkout-perpetual  -  One-time perpetual license purchase
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
  assertAccountOwner(c);

  if (!user.email) {
    throw new HTTPException(400, { message: 'An email address is required for billing' });
  }

  const { priceId, tier, githubUsername } = c.req.valid('json');
  assertUnattendedPerpetualCheckoutAllowed(tier);

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
        // Required by Stripe when tax_id_collection is enabled AND an existing
        // `customer` is supplied: it lets Checkout persist the collected tax ID,
        // business name, and billing address back onto the customer. Without it
        // Stripe rejects the session with a StripeInvalidRequestError ("Tax ID
        // collection requires updating business name on the customer…"), which
        // surfaced to users as the generic "Invalid billing request".
        customer_update: { name: 'auto', address: 'auto' },
        automatic_tax: { enabled: isStripeTaxEnabled },
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

// POST /api/billing/checkout-support-renewal  -  Renew expired/expiring support on a perpetual license
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
  assertAccountOwner(c);

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
        // Required by Stripe when tax_id_collection is enabled AND an existing
        // `customer` is supplied: it lets Checkout persist the collected tax ID,
        // business name, and billing address back onto the customer. Without it
        // Stripe rejects the session with a StripeInvalidRequestError ("Tax ID
        // collection requires updating business name on the customer…"), which
        // surfaced to users as the generic "Invalid billing request".
        customer_update: { name: 'auto', address: 'auto' },
        automatic_tax: { enabled: isStripeTaxEnabled },
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

// POST /api/billing/checkout-credits — leftover door, fail closed.
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

const creditCheckoutRoute = createRoute({
  method: 'post',
  path: '/checkout-credits',
  tags: ['billing'],
  summary: 'Reject leftover credit-bundle checkout',
  description:
    'Credit bundles are not sold. The route stays registered so leftover clients receive a closed rejection instead of an unattended Stripe session.',
  request: {
    body: {
      content: {
        'application/json': { schema: CreditCheckoutRequestSchema },
      },
    },
  },
  responses: {
    400: {
      content: { 'application/json': { schema: ErrorSchema } },
      description: 'Credit bundles are not sold',
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
  assertAccountOwner(c);
  c.req.valid('json');
  throw new HTTPException(400, {
    message: 'Credit bundles are not sold. Agent tasks are included in your plan.',
  });
});

// GET /api/billing/credits  -  Current credit balance
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

// GET /api/billing/usage  -  Agent task usage for the current billing cycle
const UsageResponseSchema = z.object({
  used: z.number().openapi({ description: 'Tasks executed this billing cycle' }),
  quota: z.number().openapi({ description: 'Maximum tasks for this tier (-1 = unlimited)' }),
  overage: z.number().openapi({ description: 'Tasks beyond the tier quota' }),
  cycleStart: z.string().openapi({ description: 'Start of current billing cycle (ISO 8601)' }),
  resetAt: z
    .string()
    .openapi({ description: 'When the cycle resets (start of next month, ISO 8601)' }),
  weekUsed: z.number().openapi({ description: 'Agent-sourced meter events this ISO week (UTC)' }),
  weekStart: z.string().openapi({ description: 'UTC Monday 00:00 of the current ISO week' }),
  weekResetAt: z.string().openapi({ description: 'UTC Monday 00:00 of the next ISO week' }),
  percent: z.number().nullable().openapi({
    description: 'weekUsed / quota as a whole-number percent; null when unlimited or no allotment',
  }),
});

const usageRoute = createRoute({
  method: 'get',
  path: '/usage',
  tags: ['billing'],
  summary: 'Agent task usage',
  description:
    'Returns agent task usage for the current monthly billing cycle plus this ISO week (UTC). Monthly fields are unchanged.',
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

  const quotaRaw = resolveUsageQuota(c);
  const quota = quotaRaw === Infinity || quotaRaw >= Number.MAX_SAFE_INTEGER ? -1 : quotaRaw;
  const { weekStart, weekResetAt } = utcIsoWeekBounds(now);

  const entitlements = c.get('entitlements');
  const accountId = entitlements?.accountId;
  let weekUsed = 0;
  if (accountId) {
    const [weekRow] = await db
      .select({
        value: sql<number>`coalesce(sum(${usageMeters.quantity}), 0)`,
      })
      .from(usageMeters)
      .where(
        and(
          eq(usageMeters.accountId, accountId),
          eq(usageMeters.source, 'agent'),
          gte(usageMeters.createdAt, weekStart),
          lt(usageMeters.createdAt, weekResetAt),
        ),
      );
    weekUsed = Number(weekRow?.value ?? 0);
  }

  return c.json(
    {
      used: row?.count ?? 0,
      quota,
      overage: row?.overage ?? 0,
      cycleStart: cycle.toISOString(),
      resetAt: resetAt.toISOString(),
      weekUsed,
      weekStart: weekStart.toISOString(),
      weekResetAt: weekResetAt.toISOString(),
      percent: weeklyUsagePercent(weekUsed, quota),
    },
    200,
  );
});

// GET /api/billing/seats  -  Active member count vs the tier seat cap for the current account
const SeatsResponseSchema = z.object({
  active: z.number().openapi({ description: 'Active members on the account' }),
  max: z
    .number()
    .nullable()
    .openapi({ description: 'Seat cap for the tier (null = unlimited / Enterprise)' }),
  tier: z
    .enum(['free', 'pro', 'max', 'enterprise'])
    .openapi({ description: 'Current account tier' }),
});

const seatsRoute = createRoute({
  method: 'get',
  path: '/seats',
  tags: ['billing'],
  summary: 'Seat usage',
  description: 'Returns active member count and the tier seat cap for the current account.',
  responses: {
    200: {
      content: { 'application/json': { schema: SeatsResponseSchema } },
      description: 'Current seat usage',
    },
    401: {
      content: { 'application/json': { schema: ErrorSchema } },
      description: 'Not authenticated',
    },
  },
});

app.openapi(seatsRoute, async (c) => {
  const user = c.get('user');
  if (!user) {
    throw new HTTPException(401, { message: 'Authentication required' });
  }

  const db = getClient();
  const [membership] = await db
    .select({ accountId: accountMemberships.accountId })
    .from(accountMemberships)
    .where(and(eq(accountMemberships.userId, user.id), eq(accountMemberships.status, 'active')))
    .limit(1);

  // No account membership = solo/free context: the user is the only active seat.
  if (!membership?.accountId) {
    const soloLimits = getHostedLimitsForTier('free');
    return c.json({ active: 1, max: soloLimits.maxUsers ?? null, tier: 'free' as const }, 200);
  }

  const [activeRow] = await db
    .select({ value: count() })
    .from(accountMemberships)
    .where(
      and(
        eq(accountMemberships.accountId, membership.accountId),
        eq(accountMemberships.status, 'active'),
      ),
    );

  const snapshot = await getHostedSubscriptionSnapshot(user.id);
  const tier = snapshot?.tier ?? 'free';
  const limits = getHostedLimitsForTier(tier);

  return c.json({ active: activeRow?.value ?? 0, max: limits.maxUsers ?? null, tier }, 200);
});

// POST /api/billing/support-renewal-check  -  Internal cron: send 30-day support renewal reminders
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

  const { sendEmail } = await import('../../lib/email.js');
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

// POST /api/billing/report-agent-overage  -  Internal cron: report agent task overage to Stripe Billing Meters.
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
    logger.warn('STRIPE_AGENT_METER_EVENT_NAME not set  -  using default "agent_task_overage"');
  }

  const services = await getServices();
  if (!services) {
    throw new HTTPException(503, {
      message: 'Payment service not available. Please try again shortly.',
    });
  }
  const protectedStripe = services.protectedStripe;

  const db = getClient();
  // GAP-131: `billing.meterEvents.create` is now wrapped by protectedStripe;
  // every Stripe call across RevFleet shares one circuit breaker.

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
      await protectedStripe.billing.meterEvents.create(
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

// POST /api/billing/sweep-expired-licenses  -  Internal cron: mark expired licenses as 'expired'
// Finds non-perpetual licenses where expiresAt < now() and status = 'active', updates them to
// status = 'expired'. Also finds perpetual licenses where supportExpiresAt < now() and marks
// them as 'support_expired' (license and its purchased tier remain valid; updates and support stop).
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
  // Fetch matching IDs before updating  -  Neon HTTP driver does not support
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
  // status = 'support_expired' signals that the support contract lapsed. The
  // purchased tier and its entitlements are retained; only updates and support stop.
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

// POST /api/billing/refund  -  Issue a refund (admin-only)
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
  if (!hasApiRole(user, 'admin', 'owner')) {
    throw new HTTPException(403, { message: 'Admin access required to issue refunds' });
  }

  const { paymentIntentId, chargeId, amount, reason } = c.req.valid('json');

  if (!(paymentIntentId || chargeId)) {
    throw new HTTPException(400, {
      message: 'Either paymentIntentId or chargeId is required',
    });
  }

  // R5-H14: Idempotency key prevents duplicate refunds on network retries
  // AND deduplicates across concurrent admins working the same support ticket.
  // Binding to `amount || 'full'` (not `user.id`) keeps partial refunds of
  // different amounts distinct while converging full refunds and any two
  // admins issuing the same partial to one Stripe refund.
  const idempotencyKey = `refund-${chargeId ?? paymentIntentId}-${amount ?? 'full'}`;

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

// ─── Admin Revenue Metrics ────────────────────────────────────────────────────

/**
 * Fallback monthly prices (cents) for MRR estimation when catalog has no
 * Stripe price. Imported from `../lib/tier-pricing.ts` so the cron-level
 * parity check and this route share the same source of truth.
 */
const FALLBACK_TIER_PRICE_CENTS = MRR_TIER_PRICE_FALLBACK_CENTS;

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
  if (!hasApiRole(user, 'admin', 'owner')) {
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

  // 2. Tier breakdown from paid live entitlements only (GAP-444: exclude gifts).
  // Mode-scoped to `live` so test-mode comps and sandbox rows never inflate MRR.
  const tierRows = await db
    .select({
      tier: accountEntitlements.tier,
      tierCount: count(),
    })
    .from(accountEntitlements)
    .where(
      and(
        eq(accountEntitlements.status, 'active'),
        eq(accountEntitlements.mode, 'live'),
        ne(accountEntitlements.source, 'grant'),
      ),
    )
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
    .where(
      and(
        eq(billingCatalog.billingModel, 'subscription'),
        eq(billingCatalog.mode, getConfiguredStripeMode()),
        eq(billingCatalog.active, true),
      ),
    );

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

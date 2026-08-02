/**
 * Billing Routes  -  Stripe checkout, portal, and subscription status
 *
 * Uses RevealUI session auth (not Supabase). Bridges the NeonDB users table
 * with Stripe customer records via the `stripe_customer_id` column.
 */

import { getConfiguredStripeMode } from '@revealui/config/stripe-mode';
import { CircuitBreakerOpenError } from '@revealui/core/error-handling';
import { getMaxAgentTasks } from '@revealui/core/license';
import { logger } from '@revealui/core/observability/logger';
import { getClient, getRestPool } from '@revealui/db';
import {
  accountEntitlements,
  accountMemberships,
  accountSubscriptions,
  billingCatalog,
  users,
} from '@revealui/db/schema';
import { z } from '@revealui/openapi';
import { and, eq, isNull } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import Stripe from 'stripe';
import { getServices, type ProtectedStripe } from '../../lib/services-loader.js';
import {
  type BillingCatalogRow,
  fetchLiveBillingCatalogRows,
  findBillingCatalogGaps,
} from '../../lib/validate-startup.js';

/** Default trial period for new subscriptions (overridable via env) */
export const TRIAL_PERIOD_DAYS = Number.parseInt(process.env.REVEALUI_TRIAL_DAYS ?? '7', 10);

/**
 * Per-cold-instance live-catalog completeness gate (A2).
 *
 * Vercel cold starts deliberately skip `validateBillingCatalogAtStartup`
 * (apps/server/src/index.ts) to avoid a DB round-trip on the request path, so
 * only the Fly worker validates the catalog at boot. The hole: a live deploy
 * with a missing/null `stripe_price_id` row boots clean on Vercel, then 500s the
 * FIRST real checkout deep inside the Stripe price lookup with an opaque
 * "catalog is not configured" error mid-customer-transaction.
 *
 * This gate runs the SAME completeness check the Fly validator runs at boot —
 * derived from the SAME `EXPECTED_LIVE_PLAN_IDS` + `findBillingCatalogGaps` +
 * `fetchLiveBillingCatalogRows`, so the two enforcement points cannot drift —
 * once per cold instance, and fails the checkout up front with a precise named
 * error listing the offending plan ids. Only enforced in live mode (the
 * post-flip risk); test-mode catalogs may be partially seeded and resolve
 * lazily per request as before.
 *
 * Caches SUCCESS only: re-seeding the live catalog recovers without a redeploy
 * (a still-incomplete catalog re-checks on the next request until it passes).
 */
let liveCatalogVerified = false;

/** Test-only: clear the per-instance success cache between cases. */
export function resetLiveCatalogGateForTests(): void {
  liveCatalogVerified = false;
}

export async function assertLiveCatalogComplete(
  mode: 'live' | 'test' = getConfiguredStripeMode(),
  fetchRows: () => Promise<BillingCatalogRow[]> = fetchLiveBillingCatalogRows,
): Promise<void> {
  if (liveCatalogVerified) return;
  if (mode !== 'live') return;

  const { missing, incomplete } = findBillingCatalogGaps(await fetchRows());
  if (missing.length === 0 && incomplete.length === 0) {
    liveCatalogVerified = true;
    return;
  }

  const details: string[] = [];
  if (missing.length > 0) details.push(`missing rows: ${missing.join(', ')}`);
  if (incomplete.length > 0) details.push(`null stripe_price_id: ${incomplete.join(', ')}`);
  logger.error('Checkout blocked: live billing catalog incomplete', undefined, {
    missing,
    incomplete,
  });
  throw new HTTPException(503, {
    message:
      `Billing catalog incomplete (live mode): ${details.join('; ')}. ` +
      'Checkout is temporarily disabled until the live Stripe catalog is re-seeded.',
  });
}

/** Gate automatic_tax on Stripe Tax being active in this account (#828) */
export const isStripeTaxEnabled = process.env.STRIPE_TAX_ENABLED === 'true';

/** Billing portal configuration ID — controls plan-switching options shown in the portal (#827) */
export const billingPortalConfigId = process.env.REVEALUI_BILLING_PORTAL_CONFIG_ID ?? null;

/** How far ahead to look for expiring support contracts (overridable via env, default 30 days) */
export const SUPPORT_RENEWAL_WINDOW_MS =
  Number.parseInt(process.env.REVEALUI_SUPPORT_RENEWAL_DAYS ?? '30', 10) * 24 * 60 * 60 * 1000;

/**
 * Computes a Stripe meter event timestamp for the last second of a billing cycle.
 *
 * Stripe Billing Meters require event timestamps to fall within the billing period
 * they are associated with. Since we report overage for the *previous* calendar month,
 * the timestamp must be within that month — not in the current month when the cron runs.
 *
 * We use proper calendar arithmetic: advance cycleStart by one month to get the first
 * instant of the next cycle, then subtract one second. This correctly handles months
 * of any length (Feb 28/29, Apr/Jun/Sep/Nov 30, and 31-day months) without any
 * fixed-day approximation.
 *
 * @param cycleStart - The first day of the billing cycle (UTC midnight)
 * @returns Unix timestamp (seconds) for the last second of that cycle
 */
export function getMeterEventTimestamp(cycleStart: Date): number {
  const nextCycleStart = new Date(
    Date.UTC(cycleStart.getUTCFullYear(), cycleStart.getUTCMonth() + 1, 1),
  );
  return Math.floor(nextCycleStart.getTime() / 1000) - 1;
}

interface UserContext {
  id: string;
  email: string | null;
  name: string;
  role: string;
}

export interface RequestEntitlements {
  accountId?: string | null;
  subscriptionStatus?: string | null;
  tier?: 'free' | 'pro' | 'max' | 'enterprise';
  limits?: {
    maxAgentTasks?: number;
  };
}

export interface BillingEnv {
  Variables: {
    user: UserContext | undefined;
    entitlements?: RequestEntitlements | undefined;
  };
}

/**
 * Execute a Stripe operation through the shared DB-backed circuit breaker
 * (protectedStripe from @revealui/services). Maps Stripe errors to HTTP status codes.
 *
 * All billing routes use this single entry point — one Stripe instance,
 * one circuit breaker, shared state across serverless instances via DB.
 *
 * Lazy-loads @revealui/services per the optional-peer Pro boundary
 * (8c19db537). Returns 503 when the package is unavailable.
 */
export async function withStripe<T>(
  operation: (stripe: ProtectedStripe) => Promise<T>,
): Promise<T> {
  const services = await getServices();
  if (!services) {
    throw new HTTPException(503, {
      message: 'Payment service not available. Please try again shortly.',
    });
  }
  try {
    return await operation(services.protectedStripe);
  } catch (error) {
    // DB-backed circuit breaker throws with "circuit breaker is OPEN" message
    if (
      error instanceof CircuitBreakerOpenError ||
      (error instanceof Error && error.message.includes('circuit breaker is OPEN'))
    ) {
      throw new HTTPException(503, {
        message: 'Payment service temporarily unavailable. Please try again shortly.',
      });
    }
    // Surface the original Stripe error before it is remapped to a user-safe
    // message below. Stripe's diagnostic fields (type/code/param/statusCode/
    // requestId/message) describe the API misuse  -  e.g. "No such price: …; a
    // similar object exists in live mode, but a test mode key was used"  -  and
    // carry no secret material. Without this, a price/coupon/meter mode mismatch
    // surfaces only as an opaque "Invalid billing request" with no way to
    // identify the offending parameter from logs.
    if (error instanceof Stripe.errors.StripeError) {
      const diagnostics = {
        type: error.type,
        code: error.code,
        statusCode: error.statusCode,
        requestId: error.requestId,
        param: error instanceof Stripe.errors.StripeInvalidRequestError ? error.param : undefined,
        stripeMessage: error.message,
      };
      // Card declines and rate limits are expected outcomes, not system faults.
      if (
        error instanceof Stripe.errors.StripeCardError ||
        error instanceof Stripe.errors.StripeRateLimitError
      ) {
        logger.warn('Stripe operation rejected', diagnostics);
      } else {
        logger.error('Stripe operation failed before remap', error, diagnostics);
      }
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

export const CheckoutRequestSchema = z.object({
  priceId: z.string().min(1).optional().openapi({
    description: 'Stripe price ID for the subscription',
    example: 'price_abc123',
  }),
  tier: z.enum(['pro', 'max', 'enterprise']).optional().openapi({
    description: 'License tier (defaults to pro)',
    example: 'pro',
  }),
  interval: z.enum(['month', 'year']).optional().openapi({
    description: 'Billing interval (defaults to month). "year" selects the annual price.',
    example: 'month',
  }),
});

export const CheckoutResponseSchema = z.object({
  url: z.string().openapi({ description: 'Stripe checkout URL to redirect to' }),
});

export const PortalResponseSchema = z.object({
  url: z.string().openapi({ description: 'Stripe billing portal URL' }),
});

export const SubscriptionResponseSchema = z.object({
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

export const ErrorSchema = z.object({
  error: z.string(),
});

export const RefundRequestSchema = z.object({
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

export const RefundResponseSchema = z.object({
  refundId: z.string().openapi({ description: 'Stripe refund ID', example: 're_abc123' }),
  status: z.string().openapi({ description: 'Refund status', example: 'succeeded' }),
  amount: z.number().openapi({ description: 'Amount refunded in cents', example: 4900 }),
  currency: z.string().openapi({ description: 'Currency code', example: 'usd' }),
});

export const InvoiceItemSchema = z.object({
  id: z.string().openapi({ description: 'Stripe invoice ID', example: 'in_abc123' }),
  number: z.string().nullable().openapi({ description: 'Invoice number', example: 'INV-0001' }),
  status: z.string().openapi({ description: 'Invoice status', example: 'paid' }),
  amountDue: z.number().openapi({ description: 'Amount due in cents', example: 4900 }),
  amountPaid: z.number().openapi({ description: 'Amount paid in cents', example: 4900 }),
  currency: z.string().openapi({ description: 'Currency code', example: 'usd' }),
  created: z.string().openapi({ description: 'Created date (ISO 8601)' }),
  periodStart: z.string().openapi({ description: 'Billing period start (ISO 8601)' }),
  periodEnd: z.string().openapi({ description: 'Billing period end (ISO 8601)' }),
  pdfUrl: z.string().nullable().openapi({ description: 'URL to download invoice PDF' }),
  hostedUrl: z.string().nullable().openapi({ description: 'URL to view invoice online' }),
});

export const InvoicesResponseSchema = z.object({
  invoices: z.array(InvoiceItemSchema),
  hasMore: z.boolean().openapi({ description: 'Whether more invoices exist' }),
});

export const UpgradeRequestSchema = z.object({
  priceId: z.string().min(1).optional().openapi({
    description: 'Stripe price ID for the target tier',
    example: 'price_enterprise_monthly',
  }),
  targetTier: z.enum(['pro', 'max', 'enterprise']).openapi({
    description: 'Tier to upgrade to',
    example: 'max',
  }),
});

export const UpgradeResponseSchema = z.object({
  success: z.boolean(),
  subscriptionId: z.string().openapi({ description: 'Stripe subscription ID that was updated' }),
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Returns true when `customerId` resolves to a live (non-deleted) customer in
 * the Stripe account the current key targets. Returns false when the customer
 * is missing ("No such customer" — e.g. an id created under a different mode's
 * key) or has been deleted. Re-throws other errors (network, auth, rate-limit)
 * so a transient Stripe failure does not trigger spurious re-provisioning.
 */
export async function stripeCustomerIsUsable(
  stripe: ProtectedStripe,
  customerId: string,
): Promise<boolean> {
  try {
    const customer = await stripe.customers.retrieve(customerId);
    return !('deleted' in customer && customer.deleted === true);
  } catch (err) {
    if (err instanceof Stripe.errors.StripeInvalidRequestError) {
      return false;
    }
    throw err;
  }
}

/**
 * Returns true when `priceId` resolves to an ACTIVE price in the Stripe account
 * the current key targets. Returns false when the price is missing ("No such
 * price" — e.g. a live price id while running test keys) or archived. Re-throws
 * other errors (network/auth/rate-limit) so a transient failure does not
 * silently drop the metered line item. Used to keep a misconfigured overage
 * add-on from failing the entire subscription checkout.
 */
export async function stripePriceIsUsable(
  stripe: ProtectedStripe,
  priceId: string,
): Promise<boolean> {
  try {
    const price = await stripe.prices.retrieve(priceId);
    return price.active === true;
  } catch (err) {
    if (err instanceof Stripe.errors.StripeInvalidRequestError) {
      return false;
    }
    throw err;
  }
}

export async function ensureStripeCustomer(userId: string, email: string): Promise<string> {
  const db = getClient();

  // Fast path: user already has a Stripe customer id — but verify it still
  // exists in the CURRENT Stripe mode before reusing it. A customer created
  // under a different key (e.g. a live customer when the deployment later runs
  // test keys, or vice versa) or one deleted in the dashboard would otherwise
  // be handed to checkout.sessions.create and fail with "No such customer",
  // surfacing as a generic "Invalid billing request". When unusable we clear it
  // and re-provision via the create paths below.
  const [user] = await db
    .select({ stripeCustomerId: users.stripeCustomerId })
    .from(users)
    .where(eq(users.id, userId));

  // protectedStripe is needed to verify an existing customer AND to create a
  // new one — load it up front and 503 if absent.
  const services = await getServices();
  if (!services) {
    throw new HTTPException(503, {
      message: 'Payment service not available. Please try again shortly.',
    });
  }
  const protectedStripe = services.protectedStripe;

  const storedCustomerId = user?.stripeCustomerId;
  if (storedCustomerId) {
    if (await stripeCustomerIsUsable(protectedStripe, storedCustomerId)) {
      return storedCustomerId;
    }
    // Stale (wrong-mode or deleted). Clear it — guarded on the stale value so a
    // concurrent re-provision isn't clobbered — then fall through to create a
    // fresh customer. The lock/fallback paths below treat a null id as
    // "needs creation".
    logger.warn(
      'ensureStripeCustomer: stored customer not usable in current Stripe mode; re-provisioning',
      { userId, storedCustomerId },
    );
    await db
      .update(users)
      .set({ stripeCustomerId: null, updatedAt: new Date() })
      .where(and(eq(users.id, userId), eq(users.stripeCustomerId, storedCustomerId)));
  }

  // Slow path: need to create a Stripe customer. This is the race-prone
  // section that issue #394 tracks. Two kinds of race exist:
  //
  //  1. Concurrent-request race: two ensureStripeCustomer() calls for the
  //     same user at the same time — both see stripe_customer_id=null, both
  //     create Stripe customers, only one write wins. Previously handled by
  //     the Stripe idempotency key (`create-customer-${userId}`) — same key
  //     returns the same Stripe customer.
  //  2. Delayed-retry race: request creates Stripe customer, DB update
  //     fails, then >24h later a subsequent call retries. Stripe idempotency
  //     keys have a ~24h TTL, so the retry creates a NEW customer. Two
  //     Stripe customers for one user, billing state splits.
  //
  // Fix: serialize the read→create→write critical section per-user using a
  // Postgres advisory lock. Needs a real pg connection (not the NeonDB HTTP
  // driver). The shared pg.Pool primitive landed by #390 (getRestPool) makes
  // this reachable from here.
  const pool = getRestPool();
  if (pool) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Per-user advisory lock. Scope string 'stripe:ensure:<userId>' is
      // hashed by Postgres into a 64-bit lock id. Auto-released on
      // COMMIT/ROLLBACK (pg_advisory_xact_lock, not pg_advisory_lock).
      await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`stripe:ensure:${userId}`]);

      // Re-read inside the lock — a racing request may have won while we
      // waited for the lock.
      const winnerResult = await client.query<{ stripe_customer_id: string | null }>(
        `SELECT stripe_customer_id FROM users WHERE id = $1`,
        [userId],
      );
      const alreadyCreated = winnerResult.rows[0]?.stripe_customer_id;
      if (alreadyCreated) {
        await client.query('COMMIT');
        return alreadyCreated;
      }

      // We hold the lock and no customer exists. Create and persist
      // atomically.
      const customer = await protectedStripe.customers.create(
        {
          email,
          metadata: { revealui_user_id: userId },
        },
        {
          idempotencyKey: `create-customer-${userId}`,
        },
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
      } catch (rollbackErr) {
        logger.error('ensureStripeCustomer rollback failed after error', {
          userId,
          rollbackErr: String(rollbackErr),
        });
      }
      throw err;
    } finally {
      client.release();
    }
  }

  // Fallback path: pool unavailable (e.g. build-time with no DATABASE_URL).
  // Use the prior conditional-UPDATE best-effort pattern. Safe for the
  // common single-request case; does NOT defend against the delayed-retry
  // race — but that path is not reachable in production where POSTGRES_URL
  // is set. Logged so any production hit is visible.
  logger.warn('ensureStripeCustomer: shared pg.Pool unavailable, falling back to non-locked path', {
    userId,
  });

  const customer = await protectedStripe.customers.create(
    {
      email,
      metadata: { revealui_user_id: userId },
    },
    {
      idempotencyKey: `create-customer-${userId}`,
    },
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

type PaidTier = 'pro' | 'max' | 'enterprise';
type BillingCatalogKind = 'subscription' | 'perpetual' | 'credits' | 'renewal';

export async function resolveCatalogPriceId(
  tier: PaidTier,
  kind: BillingCatalogKind,
  requestedPriceId?: string,
  interval: 'month' | 'year' = 'month',
): Promise<string> {
  const db = getClient();
  const mode = getConfiguredStripeMode();
  // Annual subscriptions carry the interval in the planId (`subscription:<tier>:year`);
  // monthly subscriptions and all non-subscription kinds keep the 2-part planId.
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
    throw new HTTPException(500, {
      message: `Billing catalog is not configured for ${kind} ${tier} (${mode} mode)`,
    });
  }

  if (requestedPriceId?.trim() && requestedPriceId.trim() !== resolvedPriceId) {
    throw new HTTPException(400, {
      message: 'Requested price does not match the server billing catalog.',
    });
  }

  return resolvedPriceId;
}

export async function getAllCatalogSubscriptionPriceIds(): Promise<Set<string>> {
  const db = getClient();
  const rows = await db
    .select({ stripePriceId: billingCatalog.stripePriceId })
    .from(billingCatalog)
    .where(
      and(
        eq(billingCatalog.billingModel, 'subscription'),
        eq(billingCatalog.mode, getConfiguredStripeMode()),
        eq(billingCatalog.active, true),
      ),
    );
  return new Set(rows.map((r) => r.stripePriceId).filter((id): id is string => id !== null));
}

export async function getHostedSubscriptionSnapshot(userId: string): Promise<{
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
    .where(
      and(
        eq(accountEntitlements.accountId, membership.accountId),
        eq(accountEntitlements.mode, getConfiguredStripeMode()),
      ),
    )
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

export async function resolveHostedStripeCustomerId(
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

/** Non-throwing tier resolver for Stripe subscription metadata (cf. webhook resolveTier). */
export function resolveTierFromMetadata(
  metadata: Record<string, string> | null | undefined,
): 'pro' | 'max' | 'enterprise' | null {
  const tier = metadata?.tier;
  if (tier === 'pro' || tier === 'max' || tier === 'enterprise') return tier;
  return null;
}

/**
 * Reconcile the subscription view against Stripe when no local license row
 * exists yet. The checkout guard reads Stripe directly, so a trial whose
 * `checkout.session.completed` webhook hasn't landed (or failed) would otherwise
 * leave the UI showing "free" + an Upgrade button that dead-ends on the checkout
 * 409. Returns a snapshot derived from the user's live Stripe subscription, or
 * null when the user has no Stripe customer or no live subscription. Best-effort:
 * a Stripe outage must never break the billing page, so it logs and returns null
 * on failure rather than throwing.
 */
export async function getStripeSubscriptionFallback(
  userId: string,
  accountId?: string | null,
): Promise<{
  tier: 'pro' | 'max' | 'enterprise';
  status: string;
  expiresAt: string | null;
  licenseKey: null;
} | null> {
  try {
    const customerId = await resolveHostedStripeCustomerId(userId, accountId);
    if (!customerId) return null;

    const subs = await withStripe((stripe) =>
      stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 10 }),
    );
    // Match the checkout guard's notion of an existing subscription so the UI
    // and the guard agree (active / trialing / incomplete / past_due).
    const liveStatuses = new Set(['trialing', 'active', 'incomplete', 'past_due']);
    const sub = subs.data.find((s) => liveStatuses.has(s.status));
    if (!sub) return null;

    const tier = resolveTierFromMetadata(sub.metadata);
    // Never guess a paid tier from an unlabeled subscription.
    if (!tier) return null;

    const expiresAt =
      typeof sub.trial_end === 'number' ? new Date(sub.trial_end * 1000).toISOString() : null;

    return { tier, status: sub.status, expiresAt, licenseKey: null };
  } catch (error) {
    logger.warn('subscription: Stripe reconciliation fallback failed; defaulting to free', {
      detail: error instanceof Error ? error.message : 'unknown',
    });
    return null;
  }
}

export function resolveUsageQuota(c: { get: (key: string) => unknown }): number {
  const requestEntitlements = c.get('entitlements') as RequestEntitlements | undefined;
  const accountQuota = requestEntitlements?.limits?.maxAgentTasks;

  if (typeof accountQuota === 'number') {
    return accountQuota;
  }

  return getMaxAgentTasks();
}

// ─── Early Adopter Coupon ─────────────────────────────────────────────────────

/** Early adopter coupon config  -  set via env vars, not hardcoded */
interface EarlyAdopterConfig {
  endDate: Date | null;
  coupons: Record<string, string | undefined>;
}

export function getEarlyAdopterConfig(): EarlyAdopterConfig {
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
 * Stripe's `discounts` and `allow_promotion_codes` are mutually exclusive  -  when the early
 * adopter coupon is active, manual promotion codes are disabled.
 */
export function getEarlyAdopterDiscount(
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

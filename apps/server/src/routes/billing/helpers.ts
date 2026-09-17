/**
 * Billing Routes  -  Stripe checkout, portal, and subscription status
 *
 * Uses RevealUI session auth (not Supabase). Bridges the NeonDB users table
 * with Stripe customer records via the `stripe_customer_id` column.
 */

import { getConfiguredStripeMode } from '@revealui/config/stripe-mode';
import {
  checkoutRequestSchema,
  checkoutResponseSchema,
  paymentIntentRequestSchema,
  paymentIntentResponseSchema,
  portalResponseSchema,
  refundRequestSchema,
  refundResponseSchema,
  upgradeRequestSchema,
} from '@revealui/contracts';
import {
  allowsUnattendedCheckout,
  allowsUnattendedPerpetualCheckout,
  ENTERPRISE_SALES_HREF,
  type LicenseTierId,
} from '@revealui/contracts/pricing';
import { CircuitBreakerOpenError } from '@revealui/core/error-handling';
import { getMaxAgentTasks } from '@revealui/core/license';
import { logger } from '@revealui/core/observability/logger';
import { getClient, getRestPool } from '@revealui/db';
import { billingCatalog } from '@revealui/db/schema';
import { z } from '@revealui/openapi';
import {
  buildCheckoutMetadata,
  createSubscriptionWithIncompleteIntent as createSubscriptionWithIncompleteIntentPaywall,
  type EarlyAdopterConfig,
  ensureStripeCustomer as ensureStripeCustomerPaywall,
  getEarlyAdopterConfig as getEarlyAdopterConfigPaywall,
  getEarlyAdopterDiscount as getEarlyAdopterDiscountPaywall,
  getHostedSubscriptionSnapshot as getHostedSubscriptionSnapshotPaywall,
  getMeterEventTimestamp,
  type IncompleteSubscriptionIntent,
  type PaidTier,
  PaywallBillingError,
  resolveCatalogPriceId as resolveCatalogPriceIdPaywall,
  resolveHostedStripeCustomerId as resolveHostedStripeCustomerIdPaywall,
  resolveUsageQuota as resolveUsageQuotaPaywall,
} from '@revealui/paywall/stripe';
import { and, eq } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
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
export { buildCheckoutMetadata, getMeterEventTimestamp };

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

export const CheckoutRequestSchema = checkoutRequestSchema;
export const CheckoutResponseSchema = checkoutResponseSchema;
export const PaymentIntentRequestSchema = paymentIntentRequestSchema;
export const PaymentIntentResponseSchema = paymentIntentResponseSchema;
export const PortalResponseSchema = portalResponseSchema;

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

export const RefundRequestSchema = refundRequestSchema;
export const RefundResponseSchema = refundResponseSchema;

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

/**
 * Enterprise subscription is sales-assisted. A crafted POST with an
 * Enterprise price id must not open Stripe Checkout or apply a mid-cycle
 * upgrade. Max subscription remains self-serve.
 */
export function assertUnattendedCheckoutAllowed(tier: string): void {
  if (allowsUnattendedCheckout(tier as LicenseTierId)) return;
  throw new HTTPException(400, {
    message: `Enterprise plans require a sales conversation. Contact sales at ${ENTERPRISE_SALES_HREF}`,
  });
}

/**
 * Perpetual keep-list is Pro only. Leftover Agency (`tier: max`) and
 * Enterprise perpetual stay mint/display leftovers for already-issued keys.
 */
export function assertUnattendedPerpetualCheckoutAllowed(tier: string): void {
  if (allowsUnattendedPerpetualCheckout(tier as LicenseTierId)) return;
  throw new HTTPException(400, {
    message: `This perpetual license is not sold. Contact sales at ${ENTERPRISE_SALES_HREF}`,
  });
}

export const UpgradeRequestSchema = upgradeRequestSchema;

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

function paywallHttpStatus(status: number): ContentfulStatusCode {
  if (status >= 400 && status <= 599) {
    return status as ContentfulStatusCode;
  }
  return 500;
}

function rethrowPaywall(err: unknown): never {
  if (err instanceof PaywallBillingError) {
    throw new HTTPException(paywallHttpStatus(err.status), { message: err.message });
  }
  throw err;
}

export const ensureStripeCustomer = async (userId: string, email: string): Promise<string> => {
  const services = await getServices();
  if (!services) {
    throw new HTTPException(503, {
      message: 'Payment service not available. Please try again shortly.',
    });
  }
  try {
    return await ensureStripeCustomerPaywall(
      getClient(),
      getRestPool(),
      services.protectedStripe,
      userId,
      email,
    );
  } catch (err) {
    rethrowPaywall(err);
  }
};

export async function createSubscriptionWithIncompleteIntent(
  customerId: string,
  priceId: string,
  metadata?: Record<string, string>,
): Promise<IncompleteSubscriptionIntent> {
  const services = await getServices();
  if (!services) {
    throw new HTTPException(503, {
      message: 'Payment service not available. Please try again shortly.',
    });
  }
  try {
    return await createSubscriptionWithIncompleteIntentPaywall(services.protectedStripe, {
      customerId,
      priceId,
      metadata,
    });
  } catch (err) {
    rethrowPaywall(err);
  }
}

export const resolveCatalogPriceId = async (
  tier: PaidTier,
  kind: 'subscription' | 'perpetual' | 'credits' | 'renewal',
  requestedPriceId?: string,
  interval: 'month' | 'year' = 'month',
): Promise<string> => {
  try {
    return await resolveCatalogPriceIdPaywall(getClient(), tier, kind, requestedPriceId, interval);
  } catch (err) {
    rethrowPaywall(err);
  }
};

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

export const getHostedSubscriptionSnapshot = async (userId: string) => {
  return getHostedSubscriptionSnapshotPaywall(getClient(), userId);
};

export const resolveHostedStripeCustomerId = async (
  userId: string,
  accountId?: string | null,
): Promise<string | null> => {
  return resolveHostedStripeCustomerIdPaywall(getClient(), userId, accountId);
};

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

export const resolveUsageQuota = (c: { get: (key: string) => unknown }): number => {
  return resolveUsageQuotaPaywall(
    c.get('entitlements') as RequestEntitlements | undefined,
    getMaxAgentTasks,
  );
};

export const getEarlyAdopterConfig = getEarlyAdopterConfigPaywall;
export const getEarlyAdopterDiscount = getEarlyAdopterDiscountPaywall;

export type { EarlyAdopterConfig };
// Exported for testing

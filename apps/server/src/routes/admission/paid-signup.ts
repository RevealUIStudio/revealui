/**
 * GAP-256 PR-4b — public paid_signup escape (K14 / K20).
 *
 * POST /paid-signup  { email, password, name, tier: pro|max|enterprise }
 *
 * Mounted under /api/admission and /api/v1/admission.
 * Always bypasses waitlist; never grants free cohort AI (paid-pending).
 */

import { admitFreeIntake, isSignupAllowed, signUp } from '@revealui/auth/server';
import { logger } from '@revealui/core/observability/logger';
import { zValidator } from '@revealui/openapi';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { ensurePaidPendingEntitlement } from '../../lib/ensure-paid-pending-entitlement.js';
import {
  assertLiveCatalogComplete,
  ensureStripeCustomer,
  getEarlyAdopterDiscount,
  isStripeTaxEnabled,
  resolveCatalogPriceId,
  stripePriceIsUsable,
  TRIAL_PERIOD_DAYS,
  withStripe,
} from '../billing/helpers.js';

const app = new Hono();

const PaidSignupBodySchema = z.object({
  email: z.string().email().max(320),
  // Lockstep with SignUpRequestSchema / waitlist claim (GAP-244): min 12
  password: z.string().min(12).max(128),
  name: z.string().min(1).max(100),
  tier: z.enum(['pro', 'max', 'enterprise']),
});

/**
 * Create Stripe Checkout for a freshly signed-up paid-pending user.
 * Throws HTTPException or Error on hard failure; caller maps to partial response.
 */
async function createPaidSignupCheckoutSession(params: {
  userId: string;
  email: string;
  tier: 'pro' | 'max' | 'enterprise';
}): Promise<string> {
  await assertLiveCatalogComplete();

  const resolvedPriceId = await resolveCatalogPriceId(params.tier, 'subscription');
  const customerId = await ensureStripeCustomer(params.userId, params.email);

  const adminUrl = process.env.ADMIN_URL || process.env.NEXT_PUBLIC_SERVER_URL;
  if (!adminUrl) {
    throw new HTTPException(500, { message: 'ADMIN_URL is not configured' });
  }

  const discountConfig = getEarlyAdopterDiscount(params.tier);
  const meterPriceId = process.env.STRIPE_AGENT_OVERAGE_PRICE_ID;
  let includeMeter = Boolean(meterPriceId) && (params.tier === 'pro' || params.tier === 'max');
  if (
    includeMeter &&
    meterPriceId &&
    !(await withStripe((s) => stripePriceIsUsable(s, meterPriceId)))
  ) {
    logger.warn('paid-signup: agent-overage meter price not usable — omitting meter line item', {
      meterPriceId,
      tier: params.tier,
    });
    includeMeter = false;
  }

  const sessionMetadata = {
    tier: params.tier,
    revealui_user_id: params.userId,
    paid_pending: 'true',
  };

  const idempotencyWindow = Math.floor(Date.now() / (10 * 60 * 1000));
  const session = await withStripe((stripe) =>
    stripe.checkout.sessions.create(
      {
        customer: customerId,
        mode: 'subscription',
        metadata: sessionMetadata,
        payment_method_types: ['card'],
        billing_address_collection: 'required',
        tax_id_collection: { enabled: true },
        customer_update: { name: 'auto', address: 'auto' },
        automatic_tax: { enabled: isStripeTaxEnabled },
        ...discountConfig,
        line_items: [
          { price: resolvedPriceId, quantity: 1 },
          ...(includeMeter && meterPriceId ? [{ price: meterPriceId }] : []),
        ],
        subscription_data: {
          trial_period_days: TRIAL_PERIOD_DAYS,
          metadata: sessionMetadata,
        },
        success_url: `${adminUrl}/welcome?success=true&tier=${params.tier}`,
        cancel_url: `${adminUrl}/account/billing`,
      },
      {
        idempotencyKey: `paid-signup-${params.userId}-${params.tier}-${idempotencyWindow}`,
      },
    ),
  );

  if (!session.url) {
    throw new HTTPException(500, { message: 'Failed to create checkout session' });
  }
  return session.url;
}

/**
 * POST /paid-signup
 * Admit paying intent, create user, paid-pending entitlement, Stripe Checkout URL.
 */
app.post('/paid-signup', zValidator('json', PaidSignupBodySchema), async (c) => {
  const { email, password, name, tier } = c.req.valid('json');
  const normalizedEmail = email.trim().toLowerCase();

  if (!isSignupAllowed(normalizedEmail)) {
    return c.json(
      { success: false, error: 'Signups are currently restricted', code: 'SIGNUP_RESTRICTED' },
      403,
    );
  }

  // K14: always bypass waitlist for paid_signup (never free cohort limits).
  const admit = await admitFreeIntake({
    channel: 'paid_signup',
    email: normalizedEmail,
    payingIntent: { kind: 'checkout', tier },
  });

  if (admit.decision !== 'admit') {
    logger.warn('[admission-paid-signup] paid_signup did not admit', {
      decision: admit.decision,
      reason: admit.reason,
    });
    return c.json(
      {
        success: false,
        error: 'Unable to start paid signup right now',
        code: 'PAID_SIGNUP_NOT_ADMITTED',
      },
      503,
    );
  }

  const result = await signUp(normalizedEmail, password, name, {
    userAgent: c.req.header('user-agent'),
    ipAddress: c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip'),
  });

  if (!result.success || !result.user?.id) {
    logger.warn('[admission-paid-signup] signUp failed', { error: result.error });
    return c.json(
      {
        success: false,
        error: result.error ?? 'Sign up failed',
        code: 'SIGNUP_FAILED',
      },
      400,
    );
  }

  const userId = result.user.id;

  // K20: paid-pending before Checkout — never freeCohortLimitsForMode.
  try {
    await ensurePaidPendingEntitlement({
      userId,
      displayName: name,
      pendingTier: tier,
    });
  } catch (err) {
    logger.error(
      '[admission-paid-signup] paid-pending entitlement failed (non-fatal; continue checkout)',
      err instanceof Error ? err : undefined,
      { userId },
    );
  }

  let checkoutUrl: string | null = null;
  let checkoutError = false;
  try {
    checkoutUrl = await createPaidSignupCheckoutSession({
      userId,
      email: result.user.email ?? normalizedEmail,
      tier,
    });
  } catch (err) {
    checkoutError = true;
    const message = err instanceof Error ? err.message : String(err);
    logger.error(
      '[admission-paid-signup] Stripe checkout failed after user create (paid-pending retained)',
      err instanceof Error ? err : undefined,
      { userId, tier },
    );
    // User + paid-pending exist; no free AI. Surface partial success for client retry via billing.
    return c.json(
      {
        success: true,
        user: { id: userId, email: result.user.email },
        sessionToken: result.sessionToken,
        checkoutUrl: null,
        checkoutError: true,
        message:
          'Account created. Checkout could not start. Sign in and open billing to complete payment.',
        error: message,
      },
      502,
    );
  }

  logger.info('[admission-paid-signup] created', {
    userId,
    tier,
    admitReason: admit.reason,
    checkoutError,
  });

  return c.json(
    {
      success: true,
      user: { id: userId, email: result.user.email },
      sessionToken: result.sessionToken,
      checkoutUrl,
    },
    201,
  );
});

export default app;

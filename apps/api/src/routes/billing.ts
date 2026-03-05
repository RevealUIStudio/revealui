/**
 * Billing Routes — Stripe checkout, portal, and subscription status
 *
 * Uses RevealUI session auth (not Supabase). Bridges the NeonDB users table
 * with Stripe customer records via the `stripe_customer_id` column.
 */

import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { getClient } from '@revealui/db'
import { licenses, users } from '@revealui/db/schema'
import { desc, eq } from 'drizzle-orm'
import { HTTPException } from 'hono/http-exception'
import Stripe from 'stripe'

interface UserContext {
  id: string
  email: string | null
  name: string
  role: string
}

// biome-ignore lint/style/useNamingConvention: Hono requires PascalCase `Variables` in its generic type parameter
const app = new OpenAPIHono<{ Variables: { user: UserContext | undefined } }>()

function getStripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) {
    throw new HTTPException(500, { message: 'Stripe is not configured' })
  }
  return new Stripe(key)
}

// ─── Schemas ─────────────────────────────────────────────────────────────────

const CheckoutRequestSchema = z.object({
  priceId: z.string().min(1).openapi({
    description: 'Stripe price ID for the subscription',
    example: 'price_abc123',
  }),
  tier: z.enum(['pro', 'enterprise']).optional().openapi({
    description: 'License tier (defaults to pro)',
    example: 'pro',
  }),
})

const CheckoutResponseSchema = z.object({
  url: z.string().openapi({ description: 'Stripe checkout URL to redirect to' }),
})

const PortalResponseSchema = z.object({
  url: z.string().openapi({ description: 'Stripe billing portal URL' }),
})

const SubscriptionResponseSchema = z.object({
  tier: z.enum(['free', 'pro', 'enterprise']).openapi({ description: 'Current license tier' }),
  status: z.string().openapi({ description: 'License status', example: 'active' }),
  expiresAt: z.string().nullable().openapi({ description: 'Expiration date (ISO 8601)' }),
  licenseKey: z.string().nullable().openapi({ description: 'JWT license key' }),
})

const ErrorSchema = z.object({
  error: z.string(),
})

const UpgradeRequestSchema = z.object({
  priceId: z.string().min(1).openapi({
    description: 'Stripe price ID for the target tier',
    example: 'price_enterprise_monthly',
  }),
  targetTier: z.enum(['pro', 'enterprise']).openapi({
    description: 'Tier to upgrade to',
    example: 'enterprise',
  }),
})

const UpgradeResponseSchema = z.object({
  success: z.boolean(),
  subscriptionId: z.string().openapi({ description: 'Stripe subscription ID that was updated' }),
})

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function ensureStripeCustomer(userId: string, email: string): Promise<string> {
  const db = getClient()

  const [user] = await db
    .select({ stripeCustomerId: users.stripeCustomerId })
    .from(users)
    .where(eq(users.id, userId))

  if (user?.stripeCustomerId) {
    return user.stripeCustomerId
  }

  const stripe = getStripeClient()
  const customer = await stripe.customers.create({
    email,
    metadata: { revealui_user_id: userId },
  })

  await db
    .update(users)
    .set({ stripeCustomerId: customer.id, updatedAt: new Date() })
    .where(eq(users.id, userId))

  return customer.id
}

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
})

app.openapi(checkoutRoute, async (c) => {
  const user = c.get('user')
  if (!user) {
    throw new HTTPException(401, { message: 'Authentication required' })
  }

  const { priceId, tier } = c.req.valid('json')
  const customerId = await ensureStripeCustomer(user.id, user.email ?? '')

  const stripe = getStripeClient()
  const cmsUrl =
    process.env.CMS_URL || process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:4000'

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    payment_method_types: ['card'],
    billing_address_collection: 'required',
    allow_promotion_codes: true,
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: {
      trial_period_days: 7,
      metadata: { tier: tier || 'pro', revealui_user_id: user.id },
    },
    success_url: `${cmsUrl}/account/billing?success=true`,
    cancel_url: `${cmsUrl}/account/billing`,
  })

  if (!session.url) {
    throw new HTTPException(500, { message: 'Failed to create checkout session' })
  }

  return c.json({ url: session.url }, 200)
})

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
})

app.openapi(portalRoute, async (c) => {
  const user = c.get('user')
  if (!user) {
    throw new HTTPException(401, { message: 'Authentication required' })
  }

  const db = getClient()
  const [dbUser] = await db
    .select({ stripeCustomerId: users.stripeCustomerId })
    .from(users)
    .where(eq(users.id, user.id))

  if (!dbUser?.stripeCustomerId) {
    throw new HTTPException(400, {
      message: 'No billing account found. Purchase a subscription first.',
    })
  }

  const stripe = getStripeClient()
  const cmsUrl =
    process.env.CMS_URL || process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:4000'

  const session = await stripe.billingPortal.sessions.create({
    customer: dbUser.stripeCustomerId,
    return_url: `${cmsUrl}/account/billing`,
  })

  return c.json({ url: session.url }, 200)
})

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
})

app.openapi(subscriptionRoute, async (c) => {
  const user = c.get('user')
  if (!user) {
    throw new HTTPException(401, { message: 'Authentication required' })
  }

  const db = getClient()
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
    .limit(1)

  if (!license) {
    return c.json(
      {
        tier: 'free' as const,
        status: 'active',
        expiresAt: null,
        licenseKey: null,
      },
      200,
    )
  }

  return c.json(
    {
      tier: license.tier as 'free' | 'pro' | 'enterprise',
      status: license.status,
      expiresAt: license.expiresAt?.toISOString() ?? null,
      licenseKey: license.licenseKey,
    },
    200,
  )
})

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
})

app.openapi(upgradeRoute, async (c) => {
  const user = c.get('user')
  if (!user) {
    throw new HTTPException(401, { message: 'Authentication required' })
  }

  const { priceId, targetTier } = c.req.valid('json')

  const db = getClient()
  const [dbUser] = await db
    .select({ stripeCustomerId: users.stripeCustomerId })
    .from(users)
    .where(eq(users.id, user.id))

  if (!dbUser?.stripeCustomerId) {
    throw new HTTPException(400, {
      message: 'No billing account found. Purchase a subscription first.',
    })
  }

  const stripe = getStripeClient()

  // Find the user's current active subscription
  const subscriptionList = await stripe.subscriptions.list({
    customer: dbUser.stripeCustomerId,
    status: 'active',
    limit: 1,
  })

  const subscription = subscriptionList.data[0]
  if (!subscription) {
    throw new HTTPException(400, { message: 'No active subscription found to upgrade.' })
  }

  const item = subscription.items.data[0]
  if (!item) {
    throw new HTTPException(400, { message: 'Subscription has no items.' })
  }

  // Swap the price and set tier metadata so the webhook can detect the upgrade
  await stripe.subscriptions.update(subscription.id, {
    items: [{ id: item.id, price: priceId }],
    metadata: { tier: targetTier, revealui_user_id: user.id },
    proration_behavior: 'create_prorations',
  })

  return c.json({ success: true, subscriptionId: subscription.id }, 200)
})

// POST /api/billing/downgrade — Downgrade to free tier (cancel subscription)
const DowngradeResponseSchema = z.object({
  success: z.boolean(),
  effectiveAt: z.string().openapi({ description: 'When the downgrade takes effect (ISO 8601)' }),
})

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
})

app.openapi(downgradeRoute, async (c) => {
  const user = c.get('user')
  if (!user) {
    throw new HTTPException(401, { message: 'Authentication required' })
  }

  const db = getClient()
  const [dbUser] = await db
    .select({ stripeCustomerId: users.stripeCustomerId })
    .from(users)
    .where(eq(users.id, user.id))

  if (!dbUser?.stripeCustomerId) {
    throw new HTTPException(400, {
      message: 'No billing account found.',
    })
  }

  const stripe = getStripeClient()

  const subscriptionList = await stripe.subscriptions.list({
    customer: dbUser.stripeCustomerId,
    status: 'active',
    limit: 1,
  })

  const subscription = subscriptionList.data[0]
  if (!subscription) {
    throw new HTTPException(400, { message: 'No active subscription found to downgrade.' })
  }

  // Cancel at period end so the customer retains access until their billing cycle ends
  await stripe.subscriptions.update(subscription.id, {
    cancel_at_period_end: true,
  })

  // cancel_at is populated by Stripe when cancel_at_period_end is set
  const cancelAt = subscription.cancel_at
  const effectiveDate = cancelAt
    ? new Date(cancelAt * 1000).toISOString()
    : new Date().toISOString()

  return c.json({ success: true, effectiveAt: effectiveDate }, 200)
})

export default app

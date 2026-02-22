/**
 * Billing Checkout API Route
 *
 * POST /api/billing/checkout
 *
 * Creates a Stripe checkout session for subscription purchase.
 */

import { getSession } from '@revealui/auth/server'
import { logger } from '@revealui/core/utils/logger'
import { getClient } from '@revealui/db'
import { users } from '@revealui/db/schema'
import { eq } from 'drizzle-orm'
import { type NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function getStripeClient(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) return null
  return new Stripe(key)
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getSession(request.headers)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const stripe = getStripeClient()
    if (!stripe) {
      return NextResponse.json({ error: 'Stripe is not configured' }, { status: 500 })
    }

    const body = (await request.json()) as { priceId?: string; tier?: string }
    const { priceId, tier = 'pro' } = body

    if (!priceId) {
      return NextResponse.json({ error: 'priceId is required' }, { status: 400 })
    }

    const db = getClient()

    // Ensure user has a Stripe customer ID
    const [dbUser] = await db
      .select({ stripeCustomerId: users.stripeCustomerId })
      .from(users)
      .where(eq(users.id, session.user.id))

    let customerId = dbUser?.stripeCustomerId
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: session.user.email ?? undefined,
        metadata: { revealui_user_id: session.user.id },
      })
      customerId = customer.id
      await db
        .update(users)
        .set({ stripeCustomerId: customerId, updatedAt: new Date() })
        .where(eq(users.id, session.user.id))
    }

    const cmsUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:4000'

    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      billing_address_collection: 'required',
      allow_promotion_codes: true,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: 7,
        metadata: { tier, revealui_user_id: session.user.id },
      },
      success_url: `${cmsUrl}/account/billing?success=true`,
      cancel_url: `${cmsUrl}/account/billing`,
    })

    if (!checkoutSession.url) {
      return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 })
    }

    return NextResponse.json({ url: checkoutSession.url })
  } catch (error) {
    logger.error('Error creating checkout session', { error })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * Billing Portal API Route
 *
 * POST /api/billing/portal
 *
 * Creates a Stripe billing portal session for subscription management.
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

    const db = getClient()
    const [dbUser] = await db
      .select({ stripeCustomerId: users.stripeCustomerId })
      .from(users)
      .where(eq(users.id, session.user.id))

    if (!dbUser?.stripeCustomerId) {
      return NextResponse.json(
        { error: 'No billing account found. Purchase a subscription first.' },
        { status: 400 },
      )
    }

    const cmsUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:4000'

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: dbUser.stripeCustomerId,
      return_url: `${cmsUrl}/account/billing`,
    })

    return NextResponse.json({ url: portalSession.url })
  } catch (error) {
    logger.error('Error creating portal session', { error })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

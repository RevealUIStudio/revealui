/**
 * Stripe Webhook Handler — CMS (Next.js)
 *
 * POST /api/webhooks/stripe
 *
 * Processes Stripe webhook events for subscription lifecycle:
 * - checkout.session.completed → generate license JWT, store in NeonDB
 * - customer.subscription.updated → expire/reactivate license on payment status
 * - customer.subscription.deleted → revoke all licenses for customer
 * - customer.subscription.created → log for observability
 *
 * Ported from apps/api/src/routes/webhooks.ts (Hono) to Next.js route handler.
 */

import { generateLicenseKey } from '@revealui/core/license'
import { logger } from '@revealui/core/utils/logger'
import { getClient } from '@revealui/db'
import { licenses, users } from '@revealui/db/schema'
import { eq } from 'drizzle-orm'
import { type NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getStripeClient(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) return null
  return new Stripe(key)
}

function getWebhookSecret(): string | null {
  return process.env.STRIPE_WEBHOOK_SECRET_LIVE || process.env.STRIPE_WEBHOOK_SECRET || null
}

/** In-memory idempotency tracking to prevent duplicate processing */
const processedEvents = new Map<string, number>()
const IDEMPOTENCY_TTL_MS = 5 * 60 * 1000

function isAlreadyProcessed(eventId: string): boolean {
  const ts = processedEvents.get(eventId)
  if (!ts) return false
  if (Date.now() - ts > IDEMPOTENCY_TTL_MS) {
    processedEvents.delete(eventId)
    return false
  }
  return true
}

function markProcessed(eventId: string): void {
  processedEvents.set(eventId, Date.now())
  if (processedEvents.size % 100 === 0) {
    const now = Date.now()
    for (const [id, ts] of processedEvents) {
      if (now - ts > IDEMPOTENCY_TTL_MS) processedEvents.delete(id)
    }
  }
}

function resolveTier(metadata: Record<string, string> | null | undefined): 'pro' | 'enterprise' {
  const tier = metadata?.tier
  if (tier === 'enterprise') return 'enterprise'
  return 'pro'
}

function resolveCustomerId(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null,
): string | null {
  if (!customer) return null
  if (typeof customer === 'string') return customer
  return customer.id
}

function resolveSubscriptionId(subscription: string | Stripe.Subscription | null): string | null {
  if (!subscription) return null
  if (typeof subscription === 'string') return subscription
  return subscription.id
}

// ─── Relevant Events ─────────────────────────────────────────────────────────

const relevantEvents = new Set([
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
])

// ─── POST Handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  const stripe = getStripeClient()
  if (!stripe) {
    logger.error('STRIPE_SECRET_KEY not configured')
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 })
  }

  const webhookSecret = getWebhookSecret()
  if (!webhookSecret) {
    logger.error('STRIPE_WEBHOOK_SECRET not configured')
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
  }

  const body = await request.text()
  const sig = request.headers.get('stripe-signature')

  if (!sig) {
    return NextResponse.json({ error: 'Missing Stripe-Signature header' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    logger.error('Webhook signature verification failed', { detail: msg })
    return NextResponse.json(
      { error: `Webhook signature verification failed: ${msg}` },
      { status: 400 },
    )
  }

  if (isAlreadyProcessed(event.id)) {
    return NextResponse.json({ received: true, duplicate: true })
  }

  if (!relevantEvents.has(event.type)) {
    return NextResponse.json({ received: true })
  }

  const db = getClient()

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.mode !== 'subscription' || !session.subscription) break

        const customerId = resolveCustomerId(session.customer)
        const subscriptionId = resolveSubscriptionId(session.subscription)
        if (!(customerId && subscriptionId)) break

        const tier = resolveTier(session.metadata)
        const userId = session.metadata?.revealui_user_id ?? null

        // Resolve userId from Stripe customer if not in metadata
        let resolvedUserId = userId
        if (!resolvedUserId) {
          const [user] = await db
            .select({ id: users.id })
            .from(users)
            .where(eq(users.stripeCustomerId, customerId))
            .limit(1)
          resolvedUserId = user?.id ?? null
        }

        if (!resolvedUserId) {
          logger.error('CRITICAL: Cannot resolve user for checkout', {
            customerId,
            subscriptionId,
          })
          break
        }

        // Generate license key
        const privateKey = process.env.REVEALUI_LICENSE_PRIVATE_KEY
        if (!privateKey) {
          logger.error('REVEALUI_LICENSE_PRIVATE_KEY not configured — license not generated', {
            customerId,
            subscriptionId,
            tier,
          })
          break
        }

        const licenseKey = await generateLicenseKey({ tier, customerId }, privateKey)

        // Store license in NeonDB
        const licenseId = crypto.randomUUID()
        await db.insert(licenses).values({
          id: licenseId,
          userId: resolvedUserId,
          licenseKey,
          tier,
          subscriptionId,
          customerId,
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date(),
        })

        // Also store in Stripe subscription metadata for retrieval
        await stripe.subscriptions.update(subscriptionId, {
          metadata: { license_key: licenseKey, license_tier: tier },
        })

        logger.info('License generated and stored', { tier, customerId, licenseId })
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = resolveCustomerId(subscription.customer)
        if (!customerId) break

        await db
          .update(licenses)
          .set({ status: 'revoked', updatedAt: new Date() })
          .where(eq(licenses.customerId, customerId))

        logger.info('License revoked on subscription deletion', {
          customerId,
          subscriptionId: subscription.id,
        })
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = resolveCustomerId(subscription.customer)
        if (!customerId) break

        if (subscription.status === 'past_due' || subscription.status === 'unpaid') {
          await db
            .update(licenses)
            .set({ status: 'expired', updatedAt: new Date() })
            .where(eq(licenses.customerId, customerId))

          logger.info('License expired due to payment failure', {
            customerId,
            subscriptionStatus: subscription.status,
          })
        }

        if (subscription.status === 'active') {
          await db
            .update(licenses)
            .set({ status: 'active', updatedAt: new Date() })
            .where(eq(licenses.customerId, customerId))
        }
        break
      }

      case 'customer.subscription.created': {
        const subscription = event.data.object as Stripe.Subscription
        logger.info('Subscription created', {
          customerId: resolveCustomerId(subscription.customer),
          subscriptionId: subscription.id,
          status: subscription.status,
        })
        break
      }
    }

    markProcessed(event.id)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    logger.error('Webhook handler error', { detail: msg, eventType: event.type })
    return NextResponse.json({ error: `Webhook handler failed: ${msg}` }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

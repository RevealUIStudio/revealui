/**
 * Stripe Webhook Handler — NeonDB-native
 *
 * Replaces the Supabase-dependent webhook in packages/services.
 * Writes license records to the NeonDB licenses table via Drizzle,
 * handles subscription lifecycle events, and triggers license revocation.
 */

import { generateLicenseKey } from '@revealui/core/license'
import { logger } from '@revealui/core/observability/logger'
import { getClient } from '@revealui/db'
import { licenses, users } from '@revealui/db/schema'
import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import Stripe from 'stripe'

const app = new Hono()

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getStripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY?.trim()
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY not configured')
  }
  return new Stripe(key)
}

function getWebhookSecret(): string {
  const secret = (
    process.env.STRIPE_WEBHOOK_SECRET_LIVE || process.env.STRIPE_WEBHOOK_SECRET
  )?.trim()
  if (!secret) {
    throw new Error('STRIPE_WEBHOOK_SECRET must be configured')
  }
  return secret
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

// ─── Webhook Endpoint ────────────────────────────────────────────────────────

const relevantEvents = new Set([
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
])

app.post('/stripe', async (c) => {
  const webhookSecret = getWebhookSecret()
  const stripe = getStripeClient()

  const body = await c.req.text()
  const sig = c.req.header('Stripe-Signature')

  if (!sig) {
    return c.json({ error: 'Missing Stripe-Signature header' }, 400)
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    logger.error('Webhook signature verification failed', undefined, { detail: msg })
    return c.json({ error: `Webhook signature verification failed: ${msg}` }, 400)
  }

  if (isAlreadyProcessed(event.id)) {
    return c.json({ received: true, duplicate: true }, 200)
  }

  if (!relevantEvents.has(event.type)) {
    return c.json({ received: true }, 200)
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
          logger.error('CRITICAL: Cannot resolve user for checkout', undefined, {
            customerId,
            subscriptionId,
          })
          break
        }

        // Generate license key
        const privateKey = process.env.REVEALUI_LICENSE_PRIVATE_KEY
        if (!privateKey) {
          logger.error(
            'CRITICAL: REVEALUI_LICENSE_PRIVATE_KEY not configured — license not generated',
            undefined,
            {
              customerId,
              subscriptionId,
              tier,
            },
          )
          break
        }

        // Unescape literal \n sequences — Vercel stores multi-line PEM keys
        // with \n escaped in the .env format; the runtime preserves the literal
        // \n chars, so we must convert them to real newlines for jose/importPKCS8.
        const normalizedKey = privateKey.replace(/\\n/g, '\n')
        const licenseKey = await generateLicenseKey({ tier, customerId }, normalizedKey)

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

        // Revoke all licenses for this customer
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

        // If subscription went past_due or unpaid, mark license as expired
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

        // If subscription went active again (e.g. payment recovered), reactivate
        if (subscription.status === 'active') {
          await db
            .update(licenses)
            .set({ status: 'active', updatedAt: new Date() })
            .where(eq(licenses.customerId, customerId))
        }
        break
      }

      case 'customer.subscription.created': {
        // Logged for observability; license generation happens on checkout.session.completed
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
    logger.error('Webhook handler error', undefined, { detail: msg, eventType: event.type })
    return c.json({ error: `Webhook handler failed: ${msg}` }, 500)
  }

  return c.json({ received: true }, 200)
})

export default app

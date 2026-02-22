import { generateLicenseKey, type LicenseTier } from '@revealui/core/license'
import { logger } from '@revealui/core/utils/logger'
import type Stripe from 'stripe'
import { protectedStripe } from '../../stripe/stripeClient.js'
import { createServerClientFromRequest } from '../../supabase/index.js'
import { manageSubscriptionStatusChange, upsertPriceRecord, upsertProductRecord } from '../utils.js'

const relevantEvents = new Set([
  'product.created',
  'product.updated',
  'price.created',
  'price.updated',
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
])

/**
 * Resolve the webhook secret from environment variables.
 * Throws at startup/request time if no secret is configured, preventing
 * unsigned webhook acceptance.
 */
function getWebhookSecret(): string {
  const secret =
    (typeof import.meta.env.STRIPE_WEBHOOK_SECRET_LIVE === 'string'
      ? import.meta.env.STRIPE_WEBHOOK_SECRET_LIVE
      : undefined) ??
    (typeof import.meta.env.STRIPE_WEBHOOK_SECRET === 'string'
      ? import.meta.env.STRIPE_WEBHOOK_SECRET
      : undefined)

  if (!secret) {
    throw new Error(
      'STRIPE_WEBHOOK_SECRET or STRIPE_WEBHOOK_SECRET_LIVE must be configured. ' +
        'Refusing to process webhooks without signature verification.',
    )
  }

  return secret
}

/**
 * In-memory idempotency tracking to prevent duplicate webhook processing.
 * Maps event ID to processing timestamp.
 */
const processedEvents = new Map<string, number>()
const IDEMPOTENCY_TTL_MS = 5 * 60 * 1000 // 5 minutes

function isEventAlreadyProcessed(eventId: string): boolean {
  const processedAt = processedEvents.get(eventId)
  if (!processedAt) return false

  // Check if the entry has expired
  if (Date.now() - processedAt > IDEMPOTENCY_TTL_MS) {
    processedEvents.delete(eventId)
    return false
  }

  return true
}

function markEventProcessed(eventId: string): void {
  processedEvents.set(eventId, Date.now())

  // Periodically clean up expired entries (every 100 events)
  if (processedEvents.size % 100 === 0) {
    const now = Date.now()
    for (const [id, timestamp] of processedEvents) {
      if (now - timestamp > IDEMPOTENCY_TTL_MS) {
        processedEvents.delete(id)
      }
    }
  }
}

export async function POST(request: Request): Promise<Response> {
  const supabase = createServerClientFromRequest(request)
  if (!supabase) {
    return new Response('Supabase client not available', { status: 500 })
  }

  let webhookSecret: string
  try {
    webhookSecret = getWebhookSecret()
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    logger.error('Webhook secret not configured', { error: msg })
    return new Response('Webhook endpoint not configured', { status: 500 })
  }

  const body = await request.text()
  const sig = request.headers.get('Stripe-Signature')

  if (!sig) {
    return new Response('Missing Stripe-Signature header', { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = protectedStripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'
    logger.error('Webhook signature verification failed', {
      error: errorMessage,
    })
    return new Response(`Webhook Error: ${errorMessage}`, { status: 400 })
  }

  // Idempotency check: skip already-processed events
  if (isEventAlreadyProcessed(event.id)) {
    logger.debug('Skipping duplicate webhook event', { eventId: event.id })
    return new Response(JSON.stringify({ received: true, duplicate: true }), { status: 200 })
  }

  if (relevantEvents.has(event.type)) {
    try {
      switch (event.type) {
        case 'product.created':
        case 'product.updated': {
          const product = event.data.object
          if (product.object === 'product') {
            await upsertProductRecord(supabase, product)
          }
          break
        }
        case 'price.created':
        case 'price.updated': {
          const price = event.data.object
          if (price.object === 'price') {
            await upsertPriceRecord(supabase, price)
          }
          break
        }
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
        case 'customer.subscription.deleted': {
          const subscription = event.data.object
          if (subscription.object === 'subscription') {
            const customerId =
              typeof subscription.customer === 'string'
                ? subscription.customer
                : subscription.customer?.id
            if (!customerId) {
              throw new Error('Subscription missing customer')
            }

            await manageSubscriptionStatusChange(
              subscription.id,
              customerId,
              event.type === 'customer.subscription.created',
              supabase,
            )
          }
          break
        }
        case 'checkout.session.completed': {
          const checkoutSession = event.data.object
          if (checkoutSession.object === 'checkout.session') {
            const session = checkoutSession
            if (session.mode === 'subscription' && session.subscription) {
              const subscriptionId =
                typeof session.subscription === 'string'
                  ? session.subscription
                  : session.subscription.id
              const customerId =
                typeof session.customer === 'string' ? session.customer : session.customer?.id
              if (subscriptionId && customerId) {
                await manageSubscriptionStatusChange(subscriptionId, customerId, true, supabase)

                // Generate license key for Pro/Enterprise subscriptions
                const tier = resolveTierFromMetadata(session.metadata)
                const privateKey = process.env.REVEALUI_LICENSE_PRIVATE_KEY
                if (privateKey && tier !== 'free') {
                  const licenseKey = await generateLicenseKey({ tier, customerId }, privateKey)
                  // Store license key in subscription metadata for retrieval
                  await protectedStripe.subscriptions.update(subscriptionId, {
                    metadata: { license_key: licenseKey, license_tier: tier },
                  })
                  logger.info('License key generated for checkout', { tier, customerId })
                }

                logger.info('Subscription session completed')
              }
            }
          }
          break
        }
        default:
          throw new Error('Unhandled relevant event!')
      }

      // Mark event as processed after successful handling
      markEventProcessed(event.id)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.error('Webhook handler error', { error: errorMessage })

      return new Response(
        `Webhook error: "Webhook handler failed. View logs." Error: ${errorMessage}`,
        {
          status: 400,
        },
      )
    }
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 })
}

/**
 * Resolve license tier from checkout session metadata.
 * Products should include `tier: "pro" | "enterprise"` in their metadata.
 * Defaults to "pro" if not specified.
 */
function resolveTierFromMetadata(metadata: Record<string, string> | null | undefined): LicenseTier {
  const tier = metadata?.tier
  if (tier === 'enterprise') return 'enterprise'
  if (tier === 'pro') return 'pro'
  // Default to pro for any paid subscription without explicit tier
  return 'pro'
}

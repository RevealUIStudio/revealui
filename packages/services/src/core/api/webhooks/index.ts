import type Stripe from 'stripe'
import { protectedStripe } from '../../stripe/stripeClient'
import { createServerClientFromRequest } from '../../supabase'
import { manageSubscriptionStatusChange, upsertPriceRecord, upsertProductRecord } from '../utils'

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

export async function POST(request: Request): Promise<Response> {
  const supabase = createServerClientFromRequest(request)
  if (!supabase) {
    return new Response('Supabase client not available', { status: 500 })
  }

  console.log('request:', request)
  console.log('relevantEvents:', relevantEvents)

  const body = await request.text()
  const sig = request.headers.get('Stripe-Signature')

  const webhookSecret: string =
    (typeof import.meta.env.STRIPE_WEBHOOK_SECRET_LIVE === 'string'
      ? import.meta.env.STRIPE_WEBHOOK_SECRET_LIVE
      : undefined) ??
    (typeof import.meta.env.STRIPE_WEBHOOK_SECRET === 'string'
      ? import.meta.env.STRIPE_WEBHOOK_SECRET
      : undefined) ??
    ''

  if (!sig || !webhookSecret) {
    return new Response('Missing signature or webhook secret', { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = protectedStripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'
    console.log(`❌ Error message: ${errorMessage}`)
    return new Response(`Webhook Error: ${errorMessage}`, { status: 400 })
  }

  const checkoutSession = event.data.object

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
                console.log('Subscription session completed!')
              }
            }
          }
          break
        }
        default:
          throw new Error('Unhandled relevant event!')
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.log(errorMessage)

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

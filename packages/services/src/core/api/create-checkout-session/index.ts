import { logger } from '@revealui/core/utils/logger'
import { protectedStripe } from '../../stripe/stripeClient'
import { createServerClientFromRequest } from '../../supabase'
import { createOrRetrieveCustomer, getURL } from '../utils'

interface CheckoutSessionRequest {
  price: { id: string }
  quantity?: number
  metadata?: Record<string, string>
}

export async function POST(request: Request): Promise<Response> {
  logger.debug('Checkout session request received')
  const body = (await request.json()) as CheckoutSessionRequest
  const { price, quantity = 1, metadata = {} } = body

  const supabase = createServerClientFromRequest(request)
  if (!supabase) {
    return new Response('Supabase client not available', { status: 500 })
  }

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    logger.debug('User retrieved for checkout', { userId: user?.id })

    const customer = await createOrRetrieveCustomer({
      uuid: user?.id || '',

      email: user?.email || '',
      supabase,
    })

    const customerId =
      typeof customer === 'string'
        ? customer
        : typeof customer === 'object' && customer !== null && 'stripe_customer_id' in customer
          ? // biome-ignore lint/style/useNamingConvention: Database column names use snake_case (Supabase/PostgreSQL convention)
            (customer as { stripe_customer_id: string | null }).stripe_customer_id
          : null

    if (!customerId) {
      return new Response('Failed to create or retrieve customer', { status: 500 })
    }

    const session = await protectedStripe.checkout.sessions.create({
      // biome-ignore lint/style/useNamingConvention: Stripe API uses snake_case for payment_method_types
      payment_method_types: ['card'],
      // biome-ignore lint/style/useNamingConvention: Stripe API uses snake_case for billing_address_collection
      billing_address_collection: 'required',
      customer: customerId,
      // biome-ignore lint/style/useNamingConvention: Stripe API uses snake_case for line_items
      line_items: [
        {
          price: price.id,
          quantity,
        },
      ],
      mode: 'subscription',
      // biome-ignore lint/style/useNamingConvention: Stripe API uses snake_case for allow_promotion_codes
      allow_promotion_codes: true,
      // biome-ignore lint/style/useNamingConvention: Stripe API uses snake_case for subscription_data
      subscription_data: {
        // biome-ignore lint/style/useNamingConvention: Stripe API uses snake_case for trial_period_days
        trial_period_days: 7,
        metadata: metadata,
      },
      // biome-ignore lint/style/useNamingConvention: Stripe API uses snake_case for success_url
      success_url: `${getURL()}/account`,
      // biome-ignore lint/style/useNamingConvention: Stripe API uses snake_case for cancel_url
      cancel_url: `${getURL()}/`,
    })

    return new Response(JSON.stringify({ sessionId: session.id }), {
      headers: {
        'Content-Type': 'application/json',
      },
    })
  } catch (err) {
    logger.error('Error creating checkout session', { error: err })
    return new Response('Internal Error', { status: 500 })
  }
}

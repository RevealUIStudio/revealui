import { logger } from '@revealui/core/utils/logger';
import { protectedStripe } from '../../stripe/stripeClient.js';
import { createServerClientFromRequest } from '../../supabase/index.js';
import { createOrRetrieveCustomer, getURL } from '../utils.js';

interface CheckoutSessionRequest {
  price: { id: string };
  quantity?: number;
  metadata?: Record<string, string>;
}

export async function POST(request: Request): Promise<Response> {
  logger.debug('Checkout session request received');
  const body = (await request.json()) as CheckoutSessionRequest;
  const { price, quantity = 1, metadata = {} } = body;

  const supabase = createServerClientFromRequest(request);
  if (!supabase) {
    return new Response('Supabase client not available', { status: 500 });
  }

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    logger.debug('User retrieved for checkout', { userId: user?.id });

    const customer = await createOrRetrieveCustomer({
      uuid: user?.id || '',

      email: user?.email || '',
      supabase,
    });

    const customerId =
      typeof customer === 'string'
        ? customer
        : typeof customer === 'object' && customer !== null && 'stripe_customer_id' in customer
          ? (customer as { stripe_customer_id: string | null }).stripe_customer_id
          : null;

    if (!customerId) {
      return new Response('Failed to create or retrieve customer', {
        status: 500,
      });
    }

    const session = await protectedStripe.checkout.sessions.create({
      payment_method_types: ['card'],
      billing_address_collection: 'required',
      customer: customerId,
      line_items: [
        {
          price: price.id,
          quantity,
        },
      ],
      mode: 'subscription',
      allow_promotion_codes: true,
      subscription_data: {
        trial_period_days: 7,
        metadata: metadata,
      },
      success_url: `${getURL()}/account`,
      cancel_url: `${getURL()}/`,
    });

    return new Response(JSON.stringify({ sessionId: session.id }), {
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (err) {
    logger.error('Error creating checkout session', { error: err });
    return new Response('Internal Error', { status: 500 });
  }
}

import { logger } from '@revealui/core/utils/logger';
import { protectedStripe } from '../../stripe/stripeClient.js';
import { createServerClientFromRequest } from '../../supabase/index.js';
import { createOrRetrieveCustomer, getURL } from '../utils.js';

export async function POST(request: Request): Promise<Response> {
  const supabase = createServerClientFromRequest(request);
  if (!supabase) {
    return new Response('Supabase client not available', { status: 500 });
  }

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw Error('Could not get user');

    const customer = await createOrRetrieveCustomer({
      uuid: user.id || '',

      email: user.email || '',
      supabase,
    });
    const customerId =
      typeof customer === 'string'
        ? customer
        : typeof customer === 'object' && customer !== null && 'stripe_customer_id' in customer
          ? (customer as { stripe_customer_id: string | null }).stripe_customer_id
          : null;

    if (!customerId) throw Error('Could not get customer');
    const { url } = await protectedStripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${getURL()}/account`,
    });
    return Response.json({ url });
  } catch (err) {
    logger.error('Error creating portal link', { error: err });
    return new Response('Internal Error', { status: 500 });
  }
}

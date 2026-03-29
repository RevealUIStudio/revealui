/**
 * Customer and billing handlers for Stripe webhooks
 */

import { logger } from '@revealui/core/utils/logger';
import type Stripe from 'stripe';
import { protectedStripe } from '../../stripe/stripeClient.js';
import type { SupabaseClient } from '../../supabase/index.js';
import type { Database, TablesInsert } from '../../supabase/types.js';
import type { StripeWebhookEvent } from '../types/stripe.js';
import { extractCustomerId } from '../types/stripe.js';

export const createOrRetrieveCustomer = async ({
  email,
  uuid,
  supabase,
}: {
  email: string;
  uuid: string | number;
  supabase: SupabaseClient<Database>;
}): Promise<string | { stripe_customer_id: string | null }> => {
  const { data, error } = await supabase
    .from('users')
    .select('stripe_customer_id')
    .eq('id', String(uuid))
    .single();
  if (error || !data) {
    const customerData: Stripe.CustomerCreateParams = {
      metadata: {
        supabaseUUID: String(uuid),
        ...(email ? { email } : {}),
      },
    };
    const customer = await protectedStripe.customers.create(customerData);
    const { error: supabaseError } = await supabase.from('users').insert([
      {
        email: email,
        stripe_customer_id: customer.id,
      },
    ] as TablesInsert<'users'>[]);
    if (supabaseError) throw supabaseError;
    logger.info('New customer created and inserted', { uuid });
    return customer.id;
  }
  return data;
};

export const copyBillingDetailsToCustomer = async (
  uuid: string | number,
  paymentMethod: Stripe.PaymentMethod,
  supabase: SupabaseClient<Database>,
): Promise<void> => {
  const customerId = extractCustomerId(paymentMethod.customer);
  if (!customerId) {
    throw new Error('Payment method does not have a valid customer ID');
  }

  const { name, phone, address } = paymentMethod.billing_details;
  if (!(name && phone && address)) return;

  const updateParams: Stripe.CustomerUpdateParams = {
    ...(name ? { name } : {}),
    ...(phone ? { phone } : {}),
    ...(address
      ? {
          address: {
            city: address.city ?? undefined,
            country: address.country ?? undefined,
            line1: address.line1 ?? undefined,
            line2: address.line2 ?? undefined,
            postal_code: address.postal_code ?? undefined,
            state: address.state ?? undefined,
          },
        }
      : {}),
  };

  await protectedStripe.customers.update(customerId, updateParams);
  const { error } = await supabase.from('users').update({}).eq('id', String(uuid));
  if (error) throw error;
};

/**
 * Log customer creation events. The RevealUI user record is created during
 * checkout via createOrRetrieveCustomer; this handler covers customers created
 * outside that flow (e.g., from the Stripe dashboard or another integration).
 */
export const handleCustomerCreated = (event: StripeWebhookEvent<'customer.created'>): void => {
  const customer = event.data.object;
  logger.info('Stripe customer created', {
    customerId: customer.id,
    email: customer.email ?? '(no email)',
  });
};

/**
 * Log customer update events. Billing detail syncing is handled by
 * handlePaymentMethodAttached; no additional action is required here.
 */
export const handleCustomerUpdated = (event: StripeWebhookEvent<'customer.updated'>): void => {
  const customer = event.data.object;
  logger.info('Stripe customer updated', {
    customerId: customer.id,
    email: customer.email ?? '(no email)',
  });
};
